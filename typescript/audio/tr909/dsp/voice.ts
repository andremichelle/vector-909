import {Terminable, Terminator} from "../../../lib/common.js"
import {dbToGain} from "../../common.js"

export const SilentGain = dbToGain(-72.0)

export type isRunning = boolean

export abstract class Voice implements Terminable {
    protected readonly terminator: Terminator = new Terminator()

    protected readonly sampleRateInv: number = 1.0 / this.sampleRate

    protected constructor(readonly sampleRate: number) {
    }

    abstract stop(): void

    abstract process(output: Float32Array, from: number, to: number): isRunning

    terminate(): void {
        this.terminator.terminate()
    }
}