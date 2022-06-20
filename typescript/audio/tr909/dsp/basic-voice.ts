import {dbToGain} from "../../common.js"
import {CrashOrRidePreset, HihatPreset, RimOrClapPreset, TomPreset} from "../preset.js"
import {ResourceSampleRate} from "../resources.js"
import {Channel, Interpolator, isRunning, Voice} from "./common.js"

export class BasicTuneDecayVoice extends Voice {
    private readonly rate: number
    private readonly gainInterpolator: Interpolator

    private position: number
    private fadeOutIndex: number = -1
    private gain: number
    private gainCoefficient: number

    constructor(private readonly array: Float32Array,
                preset: TomPreset | RimOrClapPreset | HihatPreset | CrashOrRidePreset,
                channel: Channel,
                sampleRate: number,
                offset: number,
                level: number) {
        super(channel, sampleRate, offset)

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

    stop(offset: number): void {
        this.fadeOutIndex = offset
        this.terminate()
    }

    process(output: Float32Array): isRunning {
        for (let i = this.offset; i < output.length; i++) {
            const pi = this.position | 0
            if (pi >= this.array.length - 1) {
                return false
            }
            if (this.fadeOutIndex === i) {
                this.fadeOutIndex = -1
                this.gainInterpolator.set(0.0, true)
            }
            const p0 = this.array[pi]
            output[i] += (p0 + (this.position - pi) * (this.array[pi + 1] - p0)) * this.gain * this.gainInterpolator.moveAndGet()
            this.gain *= this.gainCoefficient
            this.position += this.rate
        }
        this.offset = 0
        return !this.gainInterpolator.equals(0.0)
    }
}