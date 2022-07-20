import {dbToGain, decibel, Interpolator} from "../../common.js"
import {CrashOrRidePreset, HihatPreset, RimOrClapPreset, TomPreset} from "../preset.js"
import {ResourceSampleRate} from "../resources.js"
import {isRunning, Voice} from "./voice.js"

export class BasicTuneDecayVoice extends Voice {
    private readonly rate: number
    private readonly gainInterpolator: Interpolator

    private position: number
    private gain: number
    private gainCoefficient: number

    constructor(private readonly array: Float32Array,
                preset: TomPreset | RimOrClapPreset | HihatPreset | CrashOrRidePreset,
                sampleRate: number,
                level: decibel) {
        super(sampleRate)

        this.gainInterpolator = new Interpolator(sampleRate)
        this.terminator.with(preset.level.addObserver(value =>
            this.gainInterpolator.set(dbToGain(value + level), true), true))
        this.gain = 1.0
        this.gainCoefficient = 1.0
        this.position = 0.0
        this.rate = ResourceSampleRate / sampleRate
        if ('tune' in preset) {
            this.rate *= Math.pow(2.0, preset.tune.get())
        }
        if ('decay' in preset) {
            this.terminator.with(preset.decay.addObserver(value =>
                this.gainCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        }
    }

    stop(): void {
        this.gainInterpolator.set(0.0, true)
        this.terminate()
    }

    process(output: Float32Array, from: number, to: number): isRunning {
        for (let i = from; i < to; i++) {
            const pi = this.position | 0
            if (pi >= this.array.length - 1) {
                return false
            }
            const p0 = this.array[pi]
            output[i] += (p0 + (this.position - pi) * (this.array[pi + 1] - p0))
                * this.gain * this.gainInterpolator.moveAndGet()
            this.gain *= this.gainCoefficient
            this.position += this.rate
        }
        return !this.gainInterpolator.equals(0.0)
    }
}