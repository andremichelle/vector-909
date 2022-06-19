import {ArrayUtils, Terminable, Terminator} from "../../lib/common.js"
import {Message} from "./messages.js"
import {Preset} from "./preset.js"

export class TR909Worklet extends AudioWorkletNode implements Terminable {
    static loadModule(context: AudioContext): Promise<void> {
        return context.audioWorklet.addModule("bin/audio/tr909/processor.js")
    }

    private readonly terminator: Terminator = new Terminator()

    readonly preset: Preset = new Preset()

    constructor(context) {
        super(context, "tr-909", {
            numberOfInputs: 1,
            numberOfOutputs: 9,
            outputChannelCount: ArrayUtils.fill(9, () => 1),
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
            processorOptions: {
                bassdrum: {
                    attack: new Float32Array([7, 8, 9]),
                    cycle: new Float32Array([1, 2, 3])
                }
            }
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