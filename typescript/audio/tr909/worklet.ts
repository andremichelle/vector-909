import {ArrayUtils, Parameter, Terminable, TerminableVoid, Terminator} from "../../lib/common.js"
import {Transport} from "../common.js"
import {Message} from "./messages.js"
import {PatternMemory} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

export class TR909Worklet extends AudioWorkletNode implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()

    private patternSubscription: Terminable = TerminableVoid

    readonly preset: Preset = new Preset()
    readonly memory: PatternMemory = new PatternMemory()

    constructor(context, resources: Resources) {
        super(context, "tr-909", {
            numberOfInputs: 1,
            numberOfOutputs: 9,
            outputChannelCount: ArrayUtils.fill(9, () => 1),
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
            processorOptions: resources
        })

        this.terminator.with(this.preset.observeAll((parameter: Parameter<any>, path: string[]) => {
            this.port.postMessage({
                type: 'update-parameter',
                path: path.join('.'),
                unipolar: parameter.getUnipolar()
            } as Message)
        }))
        this.terminator.with(this.memory.index.addObserver((index: number) => {
            const pattern = this.memory.current()
            this.patternSubscription.terminate()
            this.patternSubscription = pattern.addObserver(() => this.port.postMessage({
                type: 'update-pattern',
                index,
                format: pattern.serialize()
            } as Message), false)
        }, true))
    }

    listenToTransport(transport: Transport): Terminable {
        return transport.addObserver(message => this.port.postMessage(message), false)
    }

    terminate(): void {
        this.terminator.terminate()
    }
}