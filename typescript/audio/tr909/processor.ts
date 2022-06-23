import {ArrayUtils} from "../../lib/common.js"
import {barsToNumFrames, decibel, numFramesToBars, RENDER_QUANTUM, TransportMessage} from "../common.js"
import {BasicTuneDecayVoice} from "./dsp/basic-voice.js"
import {BassdrumVoice} from "./dsp/bassdrum.js"
import {SnaredrumVoice} from "./dsp/snaredrum.js"
import {Channel, mapInstrumentChannel, Voice} from "./dsp/voice.js"
import {Message} from "./messages.js"
import {Instrument, Pattern, PatternMemory, Step} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

interface VoiceFactory {
    createVoice: (instrument: Instrument, level: decibel) => Voice
}

class PlayEvent {
    constructor(readonly position: number, readonly instrument: number, readonly level: decibel) {
    }
}

class ChannelProcessor {
    private readonly events: PlayEvent[] = []
    private readonly processing: Voice[] = []

    constructor(private readonly factory: VoiceFactory) {
    }

    private active: Voice = null

    schedulePlay(position: number, instrument: Instrument, level: decibel): void {
        this.events.push(new PlayEvent(position | 0, instrument, level))
        if (this.events.length > 1) {
            this.events.sort((a: PlayEvent, b: PlayEvent) => a.position - b.position)
        }
    }

    process(output: Float32Array, from: number, to: number): void {
        let frameIndex = 0
        for (const event of this.nextEvent(to)) {
            const toFrame = event.position - from
            console.assert(toFrame >= 0 && toFrame < RENDER_QUANTUM)
            this.advance(output, frameIndex, toFrame)
            this.active?.stop()
            const voice = this.factory.createVoice(event.instrument, event.level)
            this.processing.push(voice)
            this.active = voice
            frameIndex = toFrame
        }
        if (frameIndex < RENDER_QUANTUM) {
            this.advance(output, frameIndex, RENDER_QUANTUM)
        }
    }

    private* nextEvent(limit: number): Generator<PlayEvent> {
        while (this.events.length > 0 && this.events[0].position < limit) {
            yield this.events.shift()
        }
    }

    private advance(output: Float32Array, from: number, to: number): void {
        let voiceIndex = this.processing.length
        while (--voiceIndex > -1) {
            const voice = this.processing[voiceIndex]
            if (!voice.process(output, from, to)) {
                voice.terminate()
                this.processing.splice(voiceIndex, 1)
                if (this.active === voice) {
                    this.active = null
                }
            }
        }
    }
}

class Processing {
    private readonly channels: ChannelProcessor[]

    constructor(voiceFactory: VoiceFactory) {
        this.channels = ArrayUtils.fill(10, () => new ChannelProcessor(voiceFactory))
    }

    schedulePlay(position: number, instrument: Instrument, level: decibel): void {
        const channel: number = mapInstrumentChannel(instrument)
        this.channels[channel].schedulePlay(position, instrument, level)
    }

    process(output: Float32Array, from: number, to: number) {
        this.channels.forEach(timeline => timeline.process(output, from, to))
    }
}

registerProcessor('tr-909', class extends AudioWorkletProcessor implements VoiceFactory {
    private readonly resources: Resources
    private readonly preset: Preset
    private readonly memory: PatternMemory
    private readonly processing: Processing

    private moving: boolean = false
    private bpm: number = 120.0
    private bar: number = 0.0
    private position: number = 0 | 0

    constructor(options: { processorOptions: Resources }) {
        super(options)

        this.resources = options.processorOptions
        this.preset = new Preset()
        this.preset.tempo.addObserver((bpm: number) => this.bpm = bpm, true)
        this.memory = new PatternMemory()
        this.processing = new Processing(this)

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
            } else if (message.type === "play-instrument") {
                const instrument = message.instrument
                const level = message.accent ? 0.0 : this.preset.accent.get()
                this.processing.schedulePlay(this.position, instrument, level)
            }
        }
    }

    // noinspection JSUnusedGlobalSymbols
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        if (this.moving) {
            this.sequence()
        }
        this.processing.process(outputs[0][0], this.position, this.position + RENDER_QUANTUM)
        this.position += RENDER_QUANTUM
        return true
    }

    sequence(): void {
        const pattern: Pattern = this.memory.current()
        const groove = pattern.groove.get()
        const scale = pattern.scale.get().value()
        const b0 = this.bar
        const b1 = this.bar += numFramesToBars(RENDER_QUANTUM, this.bpm, sampleRate)
        const t0 = groove.inverse(b0)
        const t1 = groove.inverse(b1)
        let index = (t0 / scale) | 0
        let search = index * scale
        while (search < t1) {
            if (search >= t0) {
                const barPosition = groove.transform(search)
                const stepIndex = index % pattern.lastStep.get()
                const totalAccent: boolean = pattern.getStep(Instrument.TotalAccent, stepIndex) !== Step.None
                for (let instrument = 0; instrument < Instrument.TotalAccent; instrument++) {
                    const step: Step = pattern.getStep(instrument, stepIndex)
                    if (step !== Step.None) {
                        const level = step === Step.Accent || totalAccent ? 0.0 : this.preset.accent.get()
                        const position = this.position + barsToNumFrames(barPosition - b0, this.bpm, sampleRate) | 0
                        this.processing.schedulePlay(position, instrument, level)
                    }
                }
            }
            search = ++index * scale
        }
    }

    createVoice(instrument: Instrument, level: number): Voice {
        switch (instrument) {
            case Instrument.Bassdrum:
                return new BassdrumVoice(this.resources, this.preset.bassdrum, sampleRate, level)
            case Instrument.Snaredrum:
                return new SnaredrumVoice(this.resources, this.preset.snaredrum, sampleRate, level)
            case Instrument.TomLow:
                return new BasicTuneDecayVoice(this.resources.tomLow, this.preset.tomLow, Channel.TomLow, sampleRate, level)
            case Instrument.TomMid:
                return new BasicTuneDecayVoice(this.resources.tomMid, this.preset.tomMid, Channel.TomMid, sampleRate, level)
            case Instrument.TomHi:
                return new BasicTuneDecayVoice(this.resources.tomHi, this.preset.tomHi, Channel.TomHi, sampleRate, level)
            case Instrument.Rim:
                return new BasicTuneDecayVoice(this.resources.rim, this.preset.rim, Channel.Rim, sampleRate, level)
            case Instrument.Clap:
                return new BasicTuneDecayVoice(this.resources.clap, this.preset.clap, Channel.Clap, sampleRate, level)
            case Instrument.HihatClosed:
                return new BasicTuneDecayVoice(this.resources.closedHihat, this.preset.closedHihat, Channel.Hihat, sampleRate, level)
            case Instrument.HihatOpened:
                return new BasicTuneDecayVoice(this.resources.openedHihat, this.preset.openedHihat, Channel.Hihat, sampleRate, level)
            case Instrument.Crash:
                return new BasicTuneDecayVoice(this.resources.crash, this.preset.crash, Channel.Crash, sampleRate, level)
            case Instrument.Ride:
                return new BasicTuneDecayVoice(this.resources.ride, this.preset.ride, Channel.Ride, sampleRate, level)
        }
        throw new Error(`${instrument} not found.`)
    }
})