import {ArrayUtils, ObservableValueImpl, Parameter, Terminable, TerminableVoid, Terminator} from "../../lib/common.js"
import {dbToGain, Transport} from "../common.js"
import {MeterWorklet} from "../meter/worklet.js"
import {ChannelIndex, Memory, Step} from "./memory.js"
import {ProcessorOptions, ToMainMessage, ToWorkletMessage} from "./messages.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

export class TR909Machine implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()

    readonly worklet: AudioWorkletNode
    readonly preset: Preset
    readonly memory: Memory
    readonly transport: Transport
    readonly meterWorklet: MeterWorklet
    readonly master: GainNode
    readonly stepIndex = new ObservableValueImpl<number>(0)

    private patternSubscription: Terminable = TerminableVoid
    private processing: boolean = false

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
                path: path.join('.'),
                unipolar: parameter.getUnipolar()
            } as ToWorkletMessage)
        }))
        this.terminator.with(this.memory.patternIndex.addObserver((index: number) => {
            const pattern = this.memory.current()
            this.patternSubscription.terminate()
            this.patternSubscription = pattern.addObserver(() => this.worklet.port.postMessage({
                type: 'update-pattern',
                index,
                format: pattern.serialize()
            } as ToWorkletMessage), false)
        }, true))
        this.worklet.port.onmessage = event => {
            if (!this.processing) {
                this.worklet.port.postMessage({
                    type: "update-outputLatency",
                    outputLatency: context.outputLatency
                } as ToWorkletMessage)
                this.processing = true
            }
            this.stepIndex.set((event.data as ToMainMessage).index)
        }
    }

    play(channelIndex: ChannelIndex, step: Step) {
        this.worklet.port.postMessage({type: 'play-channel', channelIndex, step} as ToWorkletMessage)
    }

    connect(destinationNode: AudioNode): AudioNode {
        return this.master.connect(destinationNode)
    }

    terminate(): void {
        this.terminator.terminate()
    }
}