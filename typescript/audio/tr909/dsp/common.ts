import {Terminable, Terminator} from "../../../lib/common.js"
import {dbToGain} from "../../common.js"

export const SilentGain = dbToGain(-72.0)

export enum Channel {
    Bassdrum, Snaredrum, TomLow, TomMid, TomHi, Rim, Clap, Hihat, Crash, Ride
}

export type isRunning = boolean

export abstract class Voice implements Terminable {
    protected readonly terminator: Terminator = new Terminator()

    protected readonly sampleRateInv: number = 1.0 / this.sampleRate

    protected constructor(readonly channel: Channel, readonly sampleRate: number, protected offset: number) {
    }

    abstract stop(offset: number): void

    abstract process(output: Float32Array): isRunning

    terminate(): void {
        this.terminator.terminate()
    }
}

export class Interpolator {
    private static DefaultSeconds = 0.007

    private readonly length: number

    private value: number = NaN
    private target: number = NaN
    private delta: number = 0.0
    private remaining: number = 0 | 0

    constructor(sampleRate: number) {
        this.length = (Interpolator.DefaultSeconds * sampleRate) | 0
    }

    set(target: number, smooth: boolean): void {
        if (target === this.value) {
            return
        }
        if (!smooth || isNaN(this.value)) {
            this.value = this.target = target
            this.delta = 0.0
            this.remaining = 0 | 0
        } else {
            this.target = target
            this.delta = (target - this.value) / this.length
            this.remaining = this.length
        }
    }

    moveAndGet(): number {
        if (0 < this.remaining) {
            this.value += this.delta
            if (0 == --this.remaining) {
                this.delta = 0.0
                this.value = this.target
            }
        }
        return this.value
    }

    equals(value: number): boolean {
        return this.value === value
    }
}