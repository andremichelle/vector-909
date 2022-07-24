import {ArrayUtils} from "../../lib/common.js"
import {Linear} from "../../lib/mapping.js"
import {barsToNumFrames, numFramesToBars, RENDER_QUANTUM, TransportMessage} from "../common.js"
import {BasicTuneDecayVoice} from "./dsp/basic-voice.js"
import {BassdrumVoice} from "./dsp/bassdrum.js"
import {Channel, VoiceFactory} from "./dsp/channel.js"
import {PatternProvider, TrackPatternPlay, UserPatternSelect} from "./dsp/pattern.js"
import {SnaredrumVoice} from "./dsp/snaredrum.js"
import {Voice} from "./dsp/voice.js"
import {Memory, MemoryBank} from "./memory.js"
import {ProcessorOptions, ToMainMessage, ToWorkletMessage} from "./messages.js"
import {ChannelIndex, Pattern, Step} from "./pattern.js"
import {Preset} from "./preset.js"
import {Resources} from "./resources.js"
import {State} from "./state.js"

const LevelMapping = new Linear(-18.0, 0.0) // min active, half accent, full, accent + total accent

registerProcessor('tr-909', class extends AudioWorkletProcessor implements VoiceFactory {
    private readonly resources: Resources
    private readonly preset: Preset
    private readonly memory: Memory
    private readonly state: State
    private readonly channels: Channel[]

    private patternProvider: PatternProvider = null
    private moving: boolean = false
    private bpm: number = 120.0
    private bar: number = 0.0
    private barIncrement: number = 0.0
    private frameIndex: number = 0 | 0

    constructor(options: { processorOptions: ProcessorOptions }) {
        super(options)

        this.resources = options.processorOptions.resources
        this.preset = new Preset()
        this.preset.tempo.addObserver((bpm: number) => {
            this.bpm = bpm
            this.barIncrement = numFramesToBars(RENDER_QUANTUM, this.bpm, sampleRate)
        }, true)
        this.memory = [new MemoryBank(), new MemoryBank()]
        this.state = new State(this.memory)
        this.patternProvider = new UserPatternSelect(this.state, () => this.moving)
        // this.patternProvider = new TrackPatternPlay(this.state)
        this.channels = ArrayUtils.fill(10, index => new Channel(this, index))

        this.port.onmessage = (event: MessageEvent) => {
            const message: ToWorkletMessage | TransportMessage = event.data
            if (message.type === 'update-parameter') {
                this.preset.find(message.path).get().setUnipolar(message.unipolar)
            } else if (message.type === 'update-state') {
                this.state.deserialize(message.format)
            } else if (message.type === 'update-pattern') {
                this.memory[message.bankGroupIndex].patterns[message.arrayIndex].deserialize(message.format)
            } else if (message.type === "play-channel") {
                this.schedulePlay(message.channelIndex, this.frameIndex, message.step, false)
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
            this.advance()
        }
        this.channels.forEach((channel: Channel, index: number) =>
            channel.process(outputs[index][0], this.frameIndex, this.frameIndex + RENDER_QUANTUM))
        this.frameIndex += RENDER_QUANTUM
        return true
    }

    sequence(): void {
        const pattern: Pattern = this.patternProvider.pattern()
        if (pattern === null) {
            this.moving = false
            return
        }
        const groove = pattern.groove.get()
        const scale = pattern.scale.get().value()
        const b0 = this.bar
        const b1 = b0 + this.barIncrement
        const t0 = groove.inverse(b0)
        const t1 = groove.inverse(b1)
        let index = Math.floor(t0 / scale)
        let search = index * scale
        while (search < t1) {
            if (search >= t0) {
                const stepIndex = index % pattern.lastStep.get()
                const bar = groove.transform(search)
                const frameIndex = this.frameIndex + Math.floor(barsToNumFrames(bar - b0, this.bpm, sampleRate))
                const frameIndexDelayed = frameIndex + pattern.flamDelay.get() / 1000.0 * sampleRate
                const totalAccent: boolean = pattern.isTotalAccent(stepIndex)
                for (let channelIndex = 0; channelIndex < ChannelIndex.End; channelIndex++) {
                    const step: Step = pattern.getStep(channelIndex, stepIndex)
                    if (step === Step.None) {
                        continue
                    }
                    this.schedulePlay(channelIndex, frameIndex, step, totalAccent)
                    // FLAM
                    if (channelIndex !== ChannelIndex.Hihat && step === Step.Extra) {
                        this.schedulePlay(channelIndex, frameIndexDelayed, step, totalAccent)
                    }
                }
                this.port.postMessage({type: "update-step", index: stepIndex} as ToMainMessage)
                if (stepIndex + 1 === pattern.lastStep.get()) {
                    this.patternProvider.onPatterComplete()
                }
            }
            search = ++index * scale
        }
    }

    schedulePlay(channelIndex: ChannelIndex, time: number, step: Step, totalAccent: boolean): void {
        this.channels[channelIndex].schedulePlay(time, step, totalAccent)
    }

    advance() {
        this.bar += this.barIncrement
    }

    resolveLevel(step: Step, totalAccent: boolean): number {
        let level = step === Step.Full ? 0.5 : 0.0
        if (totalAccent) {
            level += this.preset.accent.get() * 0.5
        }
        return LevelMapping.y(level)
    }

    createVoice(channelIndex: ChannelIndex, step: Step, totalAccent: boolean): Voice {
        console.assert(step !== Step.None)
        switch (channelIndex) {
            case ChannelIndex.Bassdrum:
                return new BassdrumVoice(this.resources, this.preset.bassdrum, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.Snaredrum:
                return new SnaredrumVoice(this.resources, this.preset.snaredrum, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.TomLow:
                return new BasicTuneDecayVoice(this.resources.tomLow, this.preset.tomLow, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.TomMid:
                return new BasicTuneDecayVoice(this.resources.tomMid, this.preset.tomMid, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.TomHi:
                return new BasicTuneDecayVoice(this.resources.tomHi, this.preset.tomHi, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.Rim:
                return new BasicTuneDecayVoice(this.resources.rim, this.preset.rim, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.Clap:
                return new BasicTuneDecayVoice(this.resources.clap, this.preset.clap, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.Hihat:
                return step === Step.Extra
                    ? new BasicTuneDecayVoice(this.resources.openedHihat, this.preset.openedHihat, sampleRate, this.resolveLevel(step, totalAccent))
                    : new BasicTuneDecayVoice(this.resources.closedHihat, this.preset.closedHihat, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.Crash:
                return new BasicTuneDecayVoice(this.resources.crash, this.preset.crash, sampleRate, this.resolveLevel(step, totalAccent))
            case ChannelIndex.Ride:
                return new BasicTuneDecayVoice(this.resources.ride, this.preset.ride, sampleRate, this.resolveLevel(step, totalAccent))
        }
        throw new Error(`${channelIndex} not found.`)
    }
})