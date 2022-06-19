import {ArrayUtils, Terminable, Terminator} from "../../lib/common.js"
import {Message} from "./messages.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

export class TR909Worklet extends AudioWorkletNode implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()

    readonly preset: Preset = new Preset()

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

        this.terminator.with(this.preset.observeAll(parameter => {
            this.port.postMessage({
                type: 'update-parameter',
                path: this.preset.serializePath(parameter),
                unipolar: parameter.getUnipolar()
            } as Message)
        }))

        // setTimeout(() => this.preset.bassdrum.decay.setUnipolar(1.0), 1000)
    }

    terminate(): void {
        this.terminator.terminate()
    }
}