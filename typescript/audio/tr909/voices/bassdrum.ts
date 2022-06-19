import {TAU} from "../../../lib/math.js"
import {dbToGain} from "../../common.js"
import {BassdrumPreset} from "../preset.js"
import {Channel, Interpolator, SilentGain, Voice} from "./common.js"

export class BassdrumVoice extends Voice {
    private static ReleaseStartTime: number = 0.060
    private static FreqStart: number = 274.0
    private static FreqEnd: number = 52.0

    private time: number = 0.0
    private processed: boolean = false
    private gainInterpolator: Interpolator
    private gainEnvelope: number = 1.0
    private gainCoefficient: number
    private freqEnvelope: number = BassdrumVoice.FreqStart
    private freqCoefficient: number

    constructor(preset: BassdrumPreset, sampleRate: number, offset: number) {
        super(Channel.Bassdrum, sampleRate, offset)

        this.gainInterpolator = new Interpolator(sampleRate)
        this.terminator.with(preset.level.addObserver(db => this.gainInterpolator.set(dbToGain(db), this.processed), true))
        this.terminator.with(preset.decay.addObserver(value =>
            this.gainCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        this.terminator.with(preset.tune.addObserver(value =>
            this.freqCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
    }

    stop(): void {
        this.gainCoefficient = Math.exp(-1.0 / (sampleRate * 0.005))
    }

    process(output: Float32Array): boolean {
        for (let i = this.offset; i < output.length; i++) {
            if (this.time > BassdrumVoice.ReleaseStartTime) {
                this.gainEnvelope *= this.gainCoefficient
            }
            this.freqEnvelope = BassdrumVoice.FreqEnd + this.freqCoefficient * (this.freqEnvelope - BassdrumVoice.FreqEnd)
            output[i] += Math.sin(this.time * this.freqEnvelope * TAU) * this.gainEnvelope * this.gainInterpolator.moveAndGet()
            this.time += this.sampleRateInv
        }
        this.offset = 0
        this.processed = true
        return this.gainEnvelope > SilentGain
    }
}