import {barsToNumFrames, numFramesToBars} from "../common.js"
import {Message} from "./messages.js"
import {Preset} from "./preset.js"
import {BassdrumVoice} from "./voices/bassdrum.js"
import {Channel, Voice} from "./voices/common.js"

registerProcessor('tr-909', class extends AudioWorkletProcessor {
    private readonly preset: Preset = new Preset()
    private readonly channels: Map<Channel, Voice> = new Map<Channel, Voice>()
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

    // noinspection JSUnusedGlobalSymbols
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        this.sequence()

        let index = this.processing.length
        while (--index > -1) {
            const voice = this.processing[index]
            if (!voice.process(outputs[voice.channel][0])) {
                voice.terminate()
                this.processing.splice(index, 1)
                this.channels.delete(voice.channel)
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
                    const newVoice = new BassdrumVoice(this.preset.bassdrum, sampleRate, offset)
                    this.channels.get(newVoice.channel)?.stop()
                    this.channels.set(newVoice.channel, newVoice)
                    this.processing.push(newVoice)
                }
            }
            quantized = ++index * this.scale
        }
    }
})