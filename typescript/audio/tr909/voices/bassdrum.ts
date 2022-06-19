import {dbToGain} from "../../common.js"
import {BassdrumPreset} from "../preset.js"
import {Resources} from "../resources.js"
import {Channel, Interpolator, SilentGain, Voice} from "./common.js"

export class BassdrumVoice extends Voice {
    private static ReleaseStartTime: number = 0.060
    private static FreqStart: number = 274.0
    private static FreqEnd: number = 53.0

    private readonly cycle: Float32Array
    private readonly gainInterpolator: Interpolator
    private gainEnvelope: number = 1.0
    private gainCoefficient: number
    private freqEnvelope: number = BassdrumVoice.FreqStart
    private freqCoefficient: number
    private processed: boolean = false
    private time: number = 0.0
    private phase: number = 0.0

    constructor(resources: Resources, preset: BassdrumPreset, sampleRate: number, offset: number) {
        super(Channel.Bassdrum, sampleRate, offset)

        this.cycle = resources.bassdrum.cycle
        this.gainInterpolator = new Interpolator(sampleRate)
        this.terminator.with(preset.level.addObserver(db => this.gainInterpolator.set(dbToGain(db), this.processed), true))
        this.terminator.with(preset.decay.addObserver(value =>
            this.gainCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        this.terminator.with(preset.tune.addObserver(value =>
            this.freqCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
    }

    stop(): void {
        this.gainCoefficient = Math.exp(-1.0 / (sampleRate * 0.010))
    }

    process(output: Float32Array): boolean {
        for (let i = this.offset; i < output.length; i++) {
            if (this.time > BassdrumVoice.ReleaseStartTime) {
                this.gainEnvelope *= this.gainCoefficient
            }
            const pos = this.phase * this.cycle.length
            const posInt = Math.floor(pos)
            const alpha = pos - posInt
            const p0 = this.cycle[posInt % this.cycle.length]
            const value = p0 + alpha * (this.cycle[(posInt + 1) % this.cycle.length] - p0)
            output[i] += value * this.gainEnvelope * this.gainInterpolator.moveAndGet()

            this.time += this.sampleRateInv
            this.phase += this.freqEnvelope * this.sampleRateInv
            this.phase -= Math.floor(this.phase)
            this.freqEnvelope = BassdrumVoice.FreqEnd + this.freqCoefficient * (this.freqEnvelope - BassdrumVoice.FreqEnd)
        }
        this.offset = 0
        this.processed = true
        return this.gainEnvelope > SilentGain
    }
}