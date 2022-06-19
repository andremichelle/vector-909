import {Terminable, Terminator} from "../../lib/common.js"
import {TAU} from "../../lib/math.js"
import {barsToNumFrames, dbToGain, numFramesToBars} from "../common.js"
import {Message} from "./messages.js"
import {BassdrumPreset, Preset} from "./preset.js"

const SilentGain = dbToGain(-40.0)
const sampleRateInv = 1.0 / sampleRate

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
    private gain: number
    private freq: number = BassdrumVoice.FreqStart
    private releaseCoefficient: number
    private freqCoefficient: number

    constructor(preset: BassdrumPreset, offset: number) {
        super(Exclusive.Bassdrum, offset)

        this.terminator.with(preset.level.addObserver(db => this.gain = dbToGain(db), true)) // TODO Interpolation
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
                this.gain *= this.releaseCoefficient
            }
            this.freq = BassdrumVoice.FreqEnd + this.freqCoefficient * (this.freq - BassdrumVoice.FreqEnd)
            output[i] += Math.sin(this.time * this.freq * TAU) * this.gain
            this.time += sampleRateInv
        }
        this.offset = 0
        return this.gain > SilentGain
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