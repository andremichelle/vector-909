import {ArrayUtils, Parameter, Terminable, TerminableVoid, Terminator} from "../../lib/common.js"
import {Transport} from "../common.js"
import {Message} from "./messages.js"
import {Instrument, PatternMemory} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

export class TR909Worklet implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()
    private readonly worklet: AudioWorkletNode

    private patternSubscription: Terminable = TerminableVoid

    readonly preset: Preset = new Preset()
    readonly memory: PatternMemory = new PatternMemory()
    readonly master: GainNode

    constructor(context, resources: Resources) {
        this.master = context.createGain()
        this.worklet = new AudioWorkletNode(context, "tr-909", {
            numberOfInputs: 1,
            numberOfOutputs: 9,
            outputChannelCount: ArrayUtils.fill(9, () => 1),
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
            processorOptions: resources
        })
        this.worklet.connect(this.master)

        this.terminator.with(this.preset.observeAll((parameter: Parameter<any>, path: string[]) => {
            this.worklet.port.postMessage({
                type: 'update-parameter',
                path: path.join('.'),
                unipolar: parameter.getUnipolar()
            } as Message)
        }))
        this.terminator.with(this.memory.index.addObserver((index: number) => {
            const pattern = this.memory.current()
            this.patternSubscription.terminate()
            this.patternSubscription = pattern.addObserver(() => this.worklet.port.postMessage({
                type: 'update-pattern',
                index,
                format: pattern.serialize()
            } as Message), false)
        }, true))
    }

    play(instrument: Instrument, accent: boolean) {
        this.worklet.port.postMessage({
            type: 'play-instrument',
            instrument,
            accent
        } as Message)
    }

    listenToTransport(transport: Transport): Terminable {
        return transport.addObserver(message => this.worklet.port.postMessage(message), false)
    }

    terminate(): void {
        this.terminator.terminate()
    }
}