import {ArrayUtils, ObservableValueImpl, Parameter, Terminable, Terminator} from "../../lib/common.js"
import {dbToGain, Transport} from "../common.js"
import {MeterWorklet} from "../meter/worklet.js"
import {BankGroupIndex, Memory, MemoryBank, PatternGroupIndex, PatternIndex} from "./memory.js"
import {ProcessorOptions, ToMainMessage, ToWorkletMessage} from "./messages.js"
import {ChannelIndex, Pattern, Step} from "./pattern.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"
import {State} from "./state.js"

export class TR909Machine implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()
    private readonly scheduleStepIndexUpdates: { index: number, time: number }[] = []
    private running: boolean = true

    readonly worklet: AudioWorkletNode
    readonly state: State
    readonly preset: Preset
    readonly memory: Memory
    readonly transport: Transport
    readonly meterWorklet: MeterWorklet
    readonly master: GainNode

    readonly processorStepIndex = new ObservableValueImpl<number>(0)

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
        this.memory = [new MemoryBank(), new MemoryBank()]
        this.state = new State(this.memory)
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
        this.terminator.with(this.state.changeNotification.addObserver(() => this.worklet.port.postMessage({
            type: 'update-state',
            format: this.state.serialize()
        } as ToWorkletMessage)))
        this.terminator.merge(this.memory
            .map((bank: MemoryBank, bankGroupIndex: BankGroupIndex) => bank.patterns
                .map((pattern: Pattern, arrayIndex: PatternIndex) => pattern
                    .addObserver(() => this.worklet.port.postMessage({
                        type: 'update-pattern', bankGroupIndex, arrayIndex, format: pattern.serialize()
                    } as ToWorkletMessage), false))).flat())
        this.worklet.port.onmessage = event => {
            const index = (event.data as ToMainMessage).index
            const time = Date.now() + context.outputLatency
            this.scheduleStepIndexUpdates.push({index, time})
        }
        this.startScheduler()

        // TODO > Test Data < REMOVE WHEN DONE TESTING
        this.state.patternBy(0, 0).testB()
        this.state.patternBy(PatternGroupIndex.III, 6).testA()
        this.state.activeBank().tracks[0].push(this.state.indexOf(PatternGroupIndex.III, 6), 1, 0, 1)
    }

    play(channelIndex: ChannelIndex, step: Step) {
        this.worklet.port.postMessage({type: 'play-channel', channelIndex, step} as ToWorkletMessage)
    }

    terminate(): void {
        this.running = false
        this.terminator.terminate()
    }

    private startScheduler() {
        const schedule = () => {
            if (this.scheduleStepIndexUpdates.length > 0) {
                if (Date.now() >= this.scheduleStepIndexUpdates[0].time) {
                    this.processorStepIndex.set(this.scheduleStepIndexUpdates.shift().index)
                }
            }
            if (this.running) {
                requestAnimationFrame(schedule)
            }
        }
        schedule()
    }
}
