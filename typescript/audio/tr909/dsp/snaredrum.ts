import {dbToGain} from "../../common.js"
import {SnaredrumPreset} from "../preset.js"
import {Resources, ResourceSampleRate} from "../resources.js"
import {Channel, Interpolator, isRunning, SilentGain, Voice} from "./common.js"

export class SnaredrumVoice extends Voice {
    private readonly gainInterpolator: Interpolator
    private readonly tune: Float32Array
    private readonly tuneRate: number
    private readonly noise: Float32Array
    private readonly noiseRate: number
    private readonly initPhase: boolean = true

    private tonePosition: number = 0.0
    private noisePosition: number = 0.0
    private fadeOutIndex: number = -1
    private noiseGain: number
    private noiseGainCoefficient: number

    constructor(resources: Resources, preset: SnaredrumPreset, sampleRate: number, offset: number, level: number) {
        super(Channel.Snaredrum, sampleRate, offset)

        this.tune = resources.snaredrum.tone
        this.noise = resources.snaredrum.noise
        this.tuneRate = ResourceSampleRate * this.sampleRateInv * Math.pow(2.0, preset.tune.get())
        this.noiseRate = ResourceSampleRate * this.sampleRateInv
        this.noiseGain = dbToGain(preset.snappy.get())
        this.gainInterpolator = new Interpolator(sampleRate)
        this.terminator.with(preset.level.addObserver(value =>
            this.gainInterpolator.set(dbToGain(value + level), !this.initPhase), true))
        this.terminator.with(preset.tone.addObserver(value =>
            this.noiseGainCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        this.initPhase = false
    }

    stop(offset: number): void {
        this.fadeOutIndex = offset
        this.terminate()
    }

    process(output: Float32Array): isRunning {
        let pi: number
        for (let i = this.offset; i < output.length; i++) {
            if (this.fadeOutIndex === i) {
                this.fadeOutIndex = -1
                this.gainInterpolator.set(0.0, true)
            }
            const gain = this.gainInterpolator.moveAndGet()
            pi = this.tonePosition | 0
            if (pi < this.tune.length - 1) {
                const p0 = this.tune[pi]
                output[i] += (p0 + (this.tonePosition - pi) * (this.tune[pi + 1] - p0)) * gain
                this.tonePosition += this.tuneRate
            }
            pi = this.noisePosition | 0
            if (pi < this.noise.length - 1) {
                const p0 = this.noise[pi]
                output[i] += (p0 + (this.noisePosition - pi) * (this.noise[pi + 1] - p0)) * gain * this.noiseGain
                this.noiseGain *= this.noiseGainCoefficient
                this.noisePosition += this.noiseRate
            } else {
                return false
            }
        }
        this.offset = 0
        return !(this.gainInterpolator.equals(0.0) || this.noiseGain < SilentGain)
    }
}