import {ArrayUtils, ObservableValueImpl, Parameter, Terminable, Terminator} from "../../lib/common.js"
import {dbToGain, Transport} from "../common.js"
import {MeterWorklet} from "../meter/worklet.js"
import {Memory} from "./memory.js"
import {ProcessorOptions, ToMainMessage, ToWorkletMessage} from "./messages.js"
import {ChannelIndex, Step} from "./pattern.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

export class TR909Machine implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()
    private readonly scheduleStepIndexUpdates: { index: number, time: number }[] = []
    private running: boolean = true

    readonly worklet: AudioWorkletNode
    readonly preset: Preset
    readonly memory: Memory
    readonly transport: Transport
    readonly meterWorklet: MeterWorklet
    readonly master: GainNode
    readonly stepIndex = new ObservableValueImpl<number>(0)

    constructor(context, resources: Resources) {
        this.worklet = new AudioWorkletNode(context, "tr-909", {
            numberOfInputs: 1,
            numberOfOutputs: ChannelIndex.End,
            outputChannelCount: ArrayUtils.fill(ChannelIndex.End, () => 1),
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
            processorOptions: {resources} as ProcessorOptions
        })
        this.preset = new Preset()
        this.memory = new Memory()
        this.transport = new Transport()
        this.transport.addObserver(message => this.worklet.port.postMessage(message), false)
        this.meterWorklet = new MeterWorklet(context, 10, 1)
        this.master = context.createGain()
        for (let index = 0; index < ChannelIndex.End; index++) {
            this.worklet.connect(this.meterWorklet, index, index).connect(this.master, index, 0)
        }
        this.terminator.with(this.preset.volume.addObserver(value => this.master.gain.value = dbToGain(value), true))
        this.terminator.with(this.preset.observeAll((parameter: Parameter<any>, path: string[]) => {
            this.worklet.port.postMessage({
                type: 'update-parameter',
                path,
                unipolar: parameter.getUnipolar()
            } as ToWorkletMessage)
        }))
        this.terminator.with(this.memory.userPatternChangeNotification.addObserver(() => {
            this.worklet.port.postMessage({
                type: 'update-pattern-index',
                bankGroupIndex: this.memory.bankGroupIndex.get(),
                patternGroupIndex: this.memory.patternGroupIndex.get(),
                patternIndex: this.memory.patternIndex.get()
            } as ToWorkletMessage)
        }))
        this.terminator.merge(this.memory.patterns.map(pattern =>
            pattern.addObserver(() => this.worklet.port.postMessage({
                type: 'update-pattern-data',
                index: pattern.index,
                format: pattern.serialize()
            } as ToWorkletMessage), false)))
        this.worklet.port.onmessage = event => {
            const index = (event.data as ToMainMessage).index
            const time = Date.now() + context.outputLatency
            this.scheduleStepIndexUpdates.push({index, time})
        }
        const schedule = () => {
            if (this.scheduleStepIndexUpdates.length > 0) {
                if (Date.now() >= this.scheduleStepIndexUpdates[0].time) {
                    this.stepIndex.set(this.scheduleStepIndexUpdates.shift().index)
                }
            }
            if (this.running) {
                requestAnimationFrame(schedule)
            }
        }
        schedule()
    }

    play(channelIndex: ChannelIndex, step: Step) {
        this.worklet.port.postMessage({type: 'play-channel', channelIndex, step} as ToWorkletMessage)
    }

    terminate(): void {
        this.running = false
        this.terminator.terminate()
    }
}