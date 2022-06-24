import {ArrayUtils} from "../../lib/common.js"
import {barsToNumFrames, decibel, numFramesToBars, RENDER_QUANTUM, secondsToBars, TransportMessage} from "../common.js"
import {BasicTuneDecayVoice} from "./dsp/basic-voice.js"
import {BassdrumVoice} from "./dsp/bassdrum.js"
import {Channel, VoiceFactory} from "./dsp/channel.js"
import {SnaredrumVoice} from "./dsp/snaredrum.js"
import {toChannel, Voice} from "./dsp/voice.js"
import {ToMainMessage, ToWorkletMessage} from "./messages.js"
import {Instrument, Memory, Pattern, Step} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

const latency: number = 0.050 // For tap mode. TODO: Can we read or compute it somehow?

registerProcessor('tr-909', class extends AudioWorkletProcessor implements VoiceFactory {
    private readonly resources: Resources
    private readonly preset: Preset
    private readonly memory: Memory
    private readonly channels: Channel[]

    private moving: boolean = false
    private bpm: number = 120.0
    private bar: number = 0.0
    private barIncrement: number = 0.0
    private position: number = 0 | 0

    constructor(options: { processorOptions: Resources }) {
        super(options)

        this.resources = options.processorOptions
        this.preset = new Preset()
        this.preset.tempo.addObserver((bpm: number) => {
            this.bpm = bpm
            this.barIncrement = numFramesToBars(RENDER_QUANTUM, this.bpm, sampleRate)
        }, true)
        this.memory = new Memory()
        this.channels = ArrayUtils.fill(10, () => new Channel(this))

        this.port.onmessage = (event: MessageEvent) => {
            const message: ToWorkletMessage | TransportMessage = event.data
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
            } else if (message.type === "play-instrument") {
                const instrument = message.instrument
                const level = message.accent ? 0.0 : this.preset.accent.get()
                this.schedulePlay(this.position, instrument, level)
            }
        }
    }

    // noinspection JSUnusedGlobalSymbols
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        if (this.moving) {
            this.updateStepIndex()
            this.sequence()
            this.advance()
        }
        this.channels.forEach((channel: Channel, index: number) => channel.process(outputs[index][0], this.position, this.position + RENDER_QUANTUM))
        this.position += RENDER_QUANTUM
        return true
    }

    updateStepIndex(): void {
        const pattern: Pattern = this.memory.current()
        const scale = pattern.scale.get().value()
        const b0 = this.bar + secondsToBars(latency, this.bpm)
        const b1 = b0 + this.barIncrement
        let index = (b0 / scale) | 0
        let search = index * scale
        while (search < b1) {
            if (search >= b0) {
                this.port.postMessage({type: "update-step", index: index % pattern.lastStep.get()} as ToMainMessage)
            }
            search = ++index * scale
        }
    }

    sequence(): void {
        const pattern: Pattern = this.memory.current()
        const groove = pattern.groove.get()
        const scale = pattern.scale.get().value()
        const b0 = this.bar
        const b1 = b0 + this.barIncrement
        const t0 = groove.inverse(b0)
        const t1 = groove.inverse(b1)
        let index = (t0 / scale) | 0
        let search = index * scale
        while (search < t1) {
            if (search >= t0) {
                const stepIndex = index % pattern.lastStep.get()
                const barPosition = groove.transform(search)
                const totalAccent: boolean = pattern.getStep(Instrument.TotalAccent, stepIndex) !== Step.None
                for (let instrument = 0; instrument < Instrument.TotalAccent; instrument++) {
                    const step: Step = pattern.getStep(instrument, stepIndex)
                    if (step !== Step.None) {
                        const level = step === Step.Accent || totalAccent ? 0.0 : this.preset.accent.get()
                        const position = this.position + barsToNumFrames(barPosition - b0, this.bpm, sampleRate) | 0
                        this.schedulePlay(position, instrument, level)

                        const flam = false // TODO
                        if (flam) {
                            this.schedulePlay(position + pattern.flamDelay.get() / 1000.0 * sampleRate, instrument, level)
                        }
                    }
                }
                this.port.postMessage({type: "update-step", index: stepIndex} as ToMainMessage)
            }
            search = ++index * scale
        }
    }

    schedulePlay(position: number, instrument: Instrument, level: decibel): void {
        const channel: number = toChannel(instrument)
        this.channels[channel].schedulePlay(position, instrument, level)
    }

    advance() {
        this.bar += this.barIncrement
    }

    createVoice(instrument: Instrument, level: number): Voice {
        switch (instrument) {
            case Instrument.Bassdrum:
                return new BassdrumVoice(this.resources, this.preset.bassdrum, sampleRate, level)
            case Instrument.Snaredrum:
                return new SnaredrumVoice(this.resources, this.preset.snaredrum, sampleRate, level)
            case Instrument.TomLow:
                return new BasicTuneDecayVoice(this.resources.tomLow, this.preset.tomLow, sampleRate, level)
            case Instrument.TomMid:
                return new BasicTuneDecayVoice(this.resources.tomMid, this.preset.tomMid, sampleRate, level)
            case Instrument.TomHi:
                return new BasicTuneDecayVoice(this.resources.tomHi, this.preset.tomHi, sampleRate, level)
            case Instrument.Rim:
                return new BasicTuneDecayVoice(this.resources.rim, this.preset.rim, sampleRate, level)
            case Instrument.Clap:
                return new BasicTuneDecayVoice(this.resources.clap, this.preset.clap, sampleRate, level)
            case Instrument.HihatClosed:
                return new BasicTuneDecayVoice(this.resources.closedHihat, this.preset.closedHihat, sampleRate, level)
            case Instrument.HihatOpened:
                return new BasicTuneDecayVoice(this.resources.openedHihat, this.preset.openedHihat, sampleRate, level)
            case Instrument.Crash:
                return new BasicTuneDecayVoice(this.resources.crash, this.preset.crash, sampleRate, level)
            case Instrument.Ride:
                return new BasicTuneDecayVoice(this.resources.ride, this.preset.ride, sampleRate, level)
        }
        throw new Error(`${instrument} not found.`)
    }
})