import {decibel, RENDER_QUANTUM} from "../../common.js"
import {Instrument} from "../patterns.js"
import {Voice} from "./voice.js"

class PlayEvent {
    constructor(readonly position: number, readonly instrument: number, readonly level: decibel) {
    }
}

export interface VoiceFactory {
    createVoice: (instrument: Instrument, level: decibel) => Voice
}

export enum ChannelIndex {
    Bassdrum, Snaredrum, TomLow, TomMid, TomHi, Rim, Clap, Hihat, Crash, Ride, length
}

export class Channel {
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