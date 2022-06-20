import {dbToGain} from "../../common.js"
import {BassdrumPreset} from "../preset.js"
import {Resources, ResourceSampleRate} from "../resources.js"
import {Channel, Interpolator, isRunning, SilentGain, Voice} from "./common.js"

export class BassdrumVoice extends Voice {
    private static ReleaseStartTime: number = 0.060
    private static FreqStart: number = 274.0
    private static FreqEnd: number = 53.0

    private readonly cycle: Float32Array
    private readonly attack: Float32Array
    private readonly gainInterpolator: Interpolator
    private readonly attackGain: number
    private readonly attackRate: number

    private gainEnvelope: number = 1.0
    private gainCoefficient: number
    private freqEnvelope: number = BassdrumVoice.FreqStart
    private freqCoefficient: number
    private processed: boolean = false
    private time: number = 0.0
    private phase: number = 0.0
    private attackPosition: number = 0.0
    private fadeOutIndex: number = -1
    private fading: boolean = false

    constructor(resources: Resources, preset: BassdrumPreset, sampleRate: number, offset: number, level: number) {
        super(Channel.Bassdrum, sampleRate, offset)

        this.cycle = resources.bassdrum.cycle
        this.attack = resources.bassdrum.attack
        this.gainInterpolator = new Interpolator(sampleRate)
        this.gainInterpolator.set(0.0, false) // gain attack for free
        this.terminator.with(preset.level.addObserver(value =>
            this.gainInterpolator.set(dbToGain(value + level), true), true))
        this.terminator.with(preset.decay.addObserver(value =>
            this.gainCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        this.terminator.with(preset.tune.addObserver(value =>
            this.freqCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        this.attackGain = dbToGain(preset.attack.get() + preset.level.get() + level)
        this.attackRate = ResourceSampleRate / sampleRate
    }

    stop(offset: number): void {
        this.fadeOutIndex = offset
    }

    process(output: Float32Array): isRunning {
        for (let i = this.offset; i < output.length; i++) {
            if (this.fadeOutIndex === i) {
                this.gainCoefficient = Math.exp(-1.0 / (sampleRate * 0.005))
                this.fading = true
                this.fadeOutIndex = -1
            }
            if (this.fading || this.time > BassdrumVoice.ReleaseStartTime) {
                this.gainEnvelope *= this.gainCoefficient
            }
            const gainInterpolated = this.gainInterpolator.moveAndGet()
            const pos = this.phase * this.cycle.length
            const posInt = Math.floor(pos)
            const alpha = pos - posInt
            const p0 = this.cycle[posInt % this.cycle.length]
            const value = p0 + alpha * (this.cycle[(posInt + 1) % this.cycle.length] - p0)
            output[i] += value * this.gainEnvelope * gainInterpolated
            if (this.attackPosition < this.attack.length - 1) {
                const pi = this.attackPosition | 0
                const p0 = this.attack[pi]
                output[i] += (p0 + (this.attackPosition - pi) * (this.attack[pi + 1] - p0)) * this.attackGain
                this.attackPosition += this.attackRate
            }
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