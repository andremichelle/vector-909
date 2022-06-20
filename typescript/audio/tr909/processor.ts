import {barsToNumFrames, numFramesToBars, RENDER_QUANTUM, TransportMessage} from "../common.js"
import {BasicTuneDecayVoice} from "./dsp/basic-voice.js"
import {BassdrumVoice} from "./dsp/bassdrum.js"
import {Channel, Voice} from "./dsp/common.js"
import {Message} from "./messages.js"
import {Instrument, PatternMemory, Step} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

registerProcessor('tr-909', class extends AudioWorkletProcessor {
    private readonly preset: Preset = new Preset()
    private readonly memory: PatternMemory = new PatternMemory()
    private readonly channels: Map<Channel, Voice> = new Map<Channel, Voice>()
    private readonly processing: Voice[] = []
    private readonly resources: Resources

    private moving: boolean = false
    private bpm: number = 120.0
    private bar: number = 0.0
    private barIncr: number
    private scale: number = 1.0 / 16.0

    constructor(options: { processorOptions: Resources }) {
        super(options)

        this.resources = options.processorOptions

        this.preset.tempo.addObserver(value => {
            this.bpm = value
            this.barIncr = numFramesToBars(RENDER_QUANTUM, this.bpm, sampleRate)
        }, true)

        this.port.onmessage = (event: MessageEvent) => {
            const message: Message | TransportMessage = event.data
            if (message.type === 'update-parameter') {
                this.preset.find(message.path).setUnipolar(message.unipolar)
            } else if (message.type === 'update-pattern') {
                this.memory.patterns[message.index].deserialize(message.format)
            } else if (message.type === "transport-play") {
                this.moving = true
            } else if (message.type === "transport-pause") {
                this.moving = false
            } else if (message.type === "transport-move") {
                this.bar = message.position
            }
        }
    }

    // noinspection JSUnusedGlobalSymbols
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        if (this.moving) {
            this.sequence()
        }
        const master = outputs[0][0]
        let index = this.processing.length
        while (--index > -1) {
            const voice = this.processing[index]
            if (!voice.process(master)) {
                voice.terminate()
                this.processing.splice(index, 1)
                if (voice === this.channels.get(voice.channel)) {
                    this.channels.delete(voice.channel)
                }
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
                        if (offset < 0 || offset >= RENDER_QUANTUM) {
                            throw new Error(`Offset is out of bounds (${offset})`)
                        }
                        const level: number = this.preset.volume.get() + (step === Step.Accent ? 0.0 : this.preset.accent.get())
                        const voice: Voice = this.createVoice(instrument, offset, level)
                        this.channels.get(voice.channel)?.stop(offset)
                        this.channels.set(voice.channel, voice)
                        this.processing.push(voice)
                    }
                }
            }
            quantized = ++index * this.scale
        }
    }

    createVoice(instrument: Instrument, offset: number, level: number): Voice {
        switch (instrument) {
            case Instrument.Bassdrum:
                return new BassdrumVoice(this.resources, this.preset.bassdrum, sampleRate, offset, level)
            case Instrument.TomLow:
                return new BasicTuneDecayVoice(this.resources.tomLow, this.preset.tomLow, Channel.TomLow, sampleRate, offset, level)
            case Instrument.TomMid:
                return new BasicTuneDecayVoice(this.resources.tomMid, this.preset.tomMid, Channel.TomMid, sampleRate, offset, level)
            case Instrument.TomHi:
                return new BasicTuneDecayVoice(this.resources.tomHi, this.preset.tomHi, Channel.TomHi, sampleRate, offset, level)
            case Instrument.Rim:
                return new BasicTuneDecayVoice(this.resources.rim, this.preset.rim, Channel.Rim, sampleRate, offset, level)
            case Instrument.Clap:
                return new BasicTuneDecayVoice(this.resources.clap, this.preset.clap, Channel.Clap, sampleRate, offset, level)
            case Instrument.HihatClosed:
                return new BasicTuneDecayVoice(this.resources.closedHihat, this.preset.closedHihat, Channel.Hihat, sampleRate, offset, level)
            case Instrument.HihatOpen:
                return new BasicTuneDecayVoice(this.resources.openedHihat, this.preset.openedHihat, Channel.Hihat, sampleRate, offset, level)
            case Instrument.Crash:
                return new BasicTuneDecayVoice(this.resources.crash, this.preset.crash, Channel.Crash, sampleRate, offset, level)
            case Instrument.Ride:
                return new BasicTuneDecayVoice(this.resources.ride, this.preset.ride, Channel.Ride, sampleRate, offset, level)
        }
        throw new Error(`${instrument} not yet implemented.`)
    }
})