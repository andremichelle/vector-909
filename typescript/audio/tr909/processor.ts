import {Terminable, Terminator} from "../../lib/common.js"
import {TAU} from "../../lib/math.js"
import {barsToNumFrames, dbToGain, numFramesToBars} from "../common.js"
import {Message} from "./messages.js"
import {BassdrumPreset, Preset} from "./preset.js"

const SilentGain = dbToGain(-40.0)
const sampleRateInv = 1.0 / sampleRate

class Smoother {
    private readonly length: number

    private value: number = NaN
    private target: number = NaN
    private delta: number = 0.0
    private remaining: number = 0 | 0

    constructor() {
        this.length = (sampleRate * 0.005) | 0
    }

    set(target: number, smooth: boolean): void {
        if (this.target === this.value) {
            return
        }
        if (smooth && !isNaN(this.value)) {
            this.target = target
            this.delta = (target - this.value) / this.length
            this.remaining = this.length
        } else {
            this.value = this.target = target
            this.delta = 0.0
            this.remaining = 0 | 0
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
}

enum Exclusive {
    Bassdrum, Snaredrum, TomLow, TomMid, TomHi, Rim, Clap, Hihat, Crash, Ride
}

abstract class Voice implements Terminable {
    protected readonly terminator: Terminator = new Terminator()

    protected constructor(readonly exclusive, protected offset: number) {
    }

    abstract process(output: Float32Array): boolean

    abstract stop(): void

    terminate(): void {
        this.terminator.terminate()
    }
}

class BassdrumVoice extends Voice {
    private static ReleaseStartTime: number = 0.060
    private static FreqStart: number = 274.0
    private static FreqEnd: number = 52.0

    private time: number = 0.0
    private processed: boolean = false
    private gainSmoother: Smoother = new Smoother()
    private gainEnvelope: number = 1.0
    private freq: number = BassdrumVoice.FreqStart
    private releaseCoefficient: number
    private freqCoefficient: number

    constructor(preset: BassdrumPreset, offset: number) {
        super(Exclusive.Bassdrum, offset)

        this.terminator.with(preset.level.addObserver(db => this.gainSmoother.set(dbToGain(db), this.processed), true))
        this.terminator.with(preset.decay.addObserver(value =>
            this.releaseCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
        this.terminator.with(preset.tune.addObserver(value =>
            this.freqCoefficient = Math.exp(-1.0 / (sampleRate * value)), true))
    }

    stop(): void {
        this.releaseCoefficient = Math.exp(-1.0 / (sampleRate * 0.005))
    }

    process(output: Float32Array): boolean {
        for (let i = this.offset; i < output.length; i++) {
            if (this.time > BassdrumVoice.ReleaseStartTime) {
                this.gainEnvelope *= this.releaseCoefficient
            }
            this.freq = BassdrumVoice.FreqEnd + this.freqCoefficient * (this.freq - BassdrumVoice.FreqEnd)
            output[i] += Math.sin(this.time * this.freq * TAU) * this.gainEnvelope * this.gainSmoother.moveAndGet()
            this.time += sampleRateInv
        }
        this.offset = 0
        this.processed = true
        return this.gainEnvelope > SilentGain
    }
}

registerProcessor('tr-909', class extends AudioWorkletProcessor {
    private readonly preset: Preset = new Preset()
    private readonly exclusives: Map<Exclusive, Voice> = new Map<Exclusive, Voice>()
    private readonly processing: Voice[] = []

    private bpm: number = 120.0
    private bar: number = 0.0
    private barIncr: number = numFramesToBars(128, this.bpm, sampleRate)
    private scale: number = 1.0 / 16.0

    constructor() {
        super()

        this.port.onmessage = (event: MessageEvent) => {
            const message: Message = event.data
            if (message.type === 'update-parameter') {
                this.preset.deserialize(message.path).setUnipolar(message.unipolar)
            }
        }
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        this.sequence()

        let index = this.processing.length
        while (--index > -1) {
            const voice = this.processing[index]
            if (!voice.process(outputs[0][0])) {
                voice.terminate()
                this.processing.splice(index, 1)
                this.exclusives.delete(voice.exclusive)
            }
        }
        return true
    }

    sequence(): void {
        const b0 = this.bar
        const b1 = this.bar += this.barIncr
        let index = (b0 / this.scale) | 0
        let quantized = index * this.scale
        while (quantized < b1) {
            if (quantized >= b0) {
                if (index % 4 === 0 || index % 16 === 15) {
                    const offset = barsToNumFrames(quantized - b0, this.bpm, sampleRate) | 0
                    if (offset < 0 || offset >= 128) {
                        throw new Error(`Offset is out of bounds (${offset})`)
                    }
                    const newVoice = new BassdrumVoice(this.preset.bassdrum, offset)
                    this.exclusives.get(newVoice.exclusive)?.stop()
                    this.exclusives.set(Exclusive.Bassdrum, newVoice)
                    this.processing.push(newVoice)
                }
            }
            quantized = ++index * this.scale
        }
    }
})