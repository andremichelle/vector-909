import {barsToNumFrames, numFramesToBars, RENDER_QUANTUM, TransportMessage} from "../common.js"
import {BasicTuneDecayVoice} from "./dsp/basic-voice.js"
import {BassdrumVoice} from "./dsp/bassdrum.js"
import {Channel, Voice} from "./dsp/common.js"
import {SnaredrumVoice} from "./dsp/snaredrum.js"
import {Message} from "./messages.js"
import {Instrument, Pattern, PatternMemory, Step} from "./patterns.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"

// Normal run
// X-----|
//       X--------->
// Flame cancel
// X--|
//       X---------> delete completely
//    X------>

class Automation {
    play(time: number): void {

    }

    stop(time: number): void {

    }
}

registerProcessor('tr-909', class extends AudioWorkletProcessor {
    private readonly preset: Preset = new Preset()
    private readonly memory: PatternMemory = new PatternMemory()
    private readonly channels: Map<Channel, Voice> = new Map<Channel, Voice>()
    private readonly processing: Voice[] = []
    private readonly resources: Resources

    private moving: boolean = false
    private bpm: number = 120.0
    private bar: number = 0.0

    constructor(options: { processorOptions: Resources }) {
        super(options)

        this.resources = options.processorOptions

        this.preset.tempo.addObserver((bpm: number) => this.bpm = bpm, true)

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
                this.play(message.instrument, 0, message.accent ? 0.0 : this.preset.accent.get())
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
                const position = groove.transform(search)
                const stepIndex = index % pattern.lastStep.get()
                const totalAccent: boolean = pattern.getStep(Instrument.TotalAccent, stepIndex) !== Step.None
                for (let instrument = 0; instrument < Instrument.TotalAccent; instrument++) {
                    const step: Step = pattern.getStep(instrument, stepIndex)
                    if (step !== Step.None) {
                        const delay = Math.floor(barsToNumFrames(position - b0, this.bpm, sampleRate))
                        if (delay < 0 || delay >= RENDER_QUANTUM) {
                            throw new Error(`Offset is out of bounds (${delay})`)
                        }
                        this.play(instrument, delay, step === Step.Accent || totalAccent ? 0.0 : this.preset.accent.get())
                    }
                }
            }
            search = ++index * scale
        }
    }

    play(instrument: number, delay: number, level: number) {
        const voice: Voice = this.createVoice(instrument, delay, level)
        this.channels.get(voice.channel)?.stop(delay)
        this.channels.set(voice.channel, voice)
        this.processing.push(voice)
    }

    createVoice(instrument: Instrument, delay: number, level: number): Voice {
        switch (instrument) {
            case Instrument.Bassdrum:
                return new BassdrumVoice(this.resources, this.preset.bassdrum, sampleRate, delay, level)
            case Instrument.Snaredrum:
                return new SnaredrumVoice(this.resources, this.preset.snaredrum, sampleRate, delay, level)
            case Instrument.TomLow:
                return new BasicTuneDecayVoice(this.resources.tomLow, this.preset.tomLow, Channel.TomLow, sampleRate, delay, level)
            case Instrument.TomMid:
                return new BasicTuneDecayVoice(this.resources.tomMid, this.preset.tomMid, Channel.TomMid, sampleRate, delay, level)
            case Instrument.TomHi:
                return new BasicTuneDecayVoice(this.resources.tomHi, this.preset.tomHi, Channel.TomHi, sampleRate, delay, level)
            case Instrument.Rim:
                return new BasicTuneDecayVoice(this.resources.rim, this.preset.rim, Channel.Rim, sampleRate, delay, level)
            case Instrument.Clap:
                return new BasicTuneDecayVoice(this.resources.clap, this.preset.clap, Channel.Clap, sampleRate, delay, level)
            case Instrument.HihatClosed:
                return new BasicTuneDecayVoice(this.resources.closedHihat, this.preset.closedHihat, Channel.Hihat, sampleRate, delay, level)
            case Instrument.HihatOpened:
                return new BasicTuneDecayVoice(this.resources.openedHihat, this.preset.openedHihat, Channel.Hihat, sampleRate, delay, level)
            case Instrument.Crash:
                return new BasicTuneDecayVoice(this.resources.crash, this.preset.crash, Channel.Crash, sampleRate, delay, level)
            case Instrument.Ride:
                return new BasicTuneDecayVoice(this.resources.ride, this.preset.ride, Channel.Ride, sampleRate, delay, level)
        }
        throw new Error(`${instrument} not found.`)
    }
})