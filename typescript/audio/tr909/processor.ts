import {barsToNumFrames, numFramesToBars} from "../common.js"
import {Message} from "./messages.js"
import {Instrument, PatternMemory, Step} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"
import {BassdrumVoice} from "./voices/bassdrum.js"
import {Channel, Voice} from "./voices/common.js"

registerProcessor('tr-909', class extends AudioWorkletProcessor {
    private readonly preset: Preset = new Preset()
    private readonly memory: PatternMemory = new PatternMemory()
    private readonly channels: Map<Channel, Voice> = new Map<Channel, Voice>()
    private readonly processing: Voice[] = []
    private readonly resources: Resources

    private bpm: number = 120.0
    private bar: number = 0.0
    private barIncr: number = numFramesToBars(128, this.bpm, sampleRate)
    private scale: number = 1.0 / 16.0

    constructor(options: { processorOptions: Resources }) {
        super(options)

        this.resources = options.processorOptions

        this.port.onmessage = (event: MessageEvent) => {
            const message: Message = event.data
            if (message.type === 'update-parameter') {
                this.preset.deserialize(message.path).setUnipolar(message.unipolar)
            } else if (message.type === 'update-pattern') {
                this.memory.patterns[message.index].deserialize(message.format)
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
                const pattern = this.memory.current()
                const stepIndex = index % 16
                for (let instrument = 0; instrument < Instrument.count; instrument++) {
                    const step: Step = pattern.getStep(instrument, stepIndex)
                    if (step !== Step.None) {
                        const offset = barsToNumFrames(quantized - b0, this.bpm, sampleRate) | 0
                        if (offset < 0 || offset >= 128) {
                            throw new Error(`Offset is out of bounds (${offset})`)
                        }
                        const level: number = step === Step.Accent ? 1.0 : this.preset.accent.get()
                        const newVoice: Voice = new BassdrumVoice(this.resources, this.preset.bassdrum, sampleRate, offset, level)
                        this.channels.get(newVoice.channel)?.stop()
                        this.channels.set(newVoice.channel, newVoice)
                        this.processing.push(newVoice)
                    }
                }
            }
            quantized = ++index * this.scale
        }
    }
})