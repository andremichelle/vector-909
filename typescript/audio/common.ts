// noinspection JSUnusedGlobalSymbols

export const RENDER_QUANTUM: number = 128 | 0
export const LOG_DB = Math.log(10.0) / 20.0
export const dbToGain = (db: number): number => Math.exp(db * LOG_DB)
export const gainToDb = (gain: number): number => Math.log(gain) / LOG_DB
export const midiToHz = (note: number = 60.0, baseFrequency: number = 440.0): number => baseFrequency * Math.pow(2.0, (note + 3.0) / 12.0 - 6.0)
export const numFramesToBars = (numFrames: number, bpm: number, samplingRate: number): number => (numFrames * bpm) / (samplingRate * 240.0)
export const barsToNumFrames = (bars: number, bpm: number, samplingRate: number): number => (bars * samplingRate * 240.0) / bpm
export const barsToSeconds = (bars: number, bpm: number): number => (bars * 240.0) / bpm
export const SILENCE_GAIN = dbToGain(-192.0) // if gain is zero the waa will set streams to undefined

export class RMS {
    private readonly values: Float32Array
    private readonly inv: number
    private sum: number
    private index: number

    constructor(private readonly n: number) {
        this.values = new Float32Array(n)
        this.inv = 1.0 / n
        this.sum = 0.0
        this.index = 0 | 0
    }

    pushPop(squared: number): number {
        this.sum -= this.values[this.index]
        this.sum += squared
        this.values[this.index] = squared
        if (++this.index === this.n) this.index = 0
        return 0.0 >= this.sum ? 0.0 : Math.sqrt(this.sum * this.inv)
    }
}

import {Observable, ObservableImpl, Observer, Terminable} from "../lib/common.js"

export type TransportMessage =
    | { type: "transport-play" }
    | { type: "transport-pause" }
    | { type: "transport-move", position: number }

export interface TransportListener {
    listenToTransport(transport: Transport): Terminable
}

export class Transport implements Observable<TransportMessage> {
    private readonly observable: ObservableImpl<TransportMessage> = new ObservableImpl<TransportMessage>()

    private moving: boolean = false

    constructor() {
    }

    addObserver(observer: Observer<TransportMessage>, notify: boolean): Terminable {
        return this.observable.addObserver(observer)
    }

    removeObserver(observer: Observer<TransportMessage>): boolean {
        return this.observable.removeObserver(observer)
    }

    play(): void {
        if (this.moving) return
        this.moving = true
        this.observable.notify({type: "transport-play"})
    }

    pause(): void {
        if (!this.moving) return
        this.moving = false
        this.observable.notify({type: "transport-pause"})
    }

    togglePlayback(): void {
        if (this.moving) {
            this.pause()
        } else {
            this.play()
        }
    }

    stop(): void {
        this.pause()
        this.move(0.0)
    }

    move(position: number): void {
        this.observable.notify({type: "transport-move", position: position})
    }

    terminate(): void {
        this.observable.terminate()
    }
}

export const encodeWavFloat = (audio: { channels: Float32Array[], sampleRate: number, numFrames: number } | AudioBuffer): ArrayBuffer => {
    const MAGIC_RIFF = 0x46464952
    const MAGIC_WAVE = 0x45564157
    const MAGIC_FMT = 0x20746d66
    const MAGIC_DATA = 0x61746164
    const bytesPerChannel = Float32Array.BYTES_PER_ELEMENT
    const sampleRate = audio.sampleRate

    let numFrames: number
    let numberOfChannels: number
    let channels: Float32Array[]
    if (audio instanceof AudioBuffer) {
        channels = []
        numFrames = audio.length
        numberOfChannels = audio.numberOfChannels
        for (let i = 0; i < numberOfChannels; ++i) {
            channels[i] = audio.getChannelData(i)
        }
    } else {
        channels = audio.channels
        numFrames = audio.numFrames
        numberOfChannels = audio.channels.length
    }
    const size = 44 + numFrames * numberOfChannels * bytesPerChannel
    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    view.setUint32(0, MAGIC_RIFF, true)
    view.setUint32(4, size - 8, true)
    view.setUint32(8, MAGIC_WAVE, true)
    view.setUint32(12, MAGIC_FMT, true)
    view.setUint32(16, 16, true) // chunk length
    view.setUint16(20, 3, true) // compression
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerChannel, true)
    view.setUint16(32, numberOfChannels * bytesPerChannel, true)
    view.setUint16(34, 8 * bytesPerChannel, true)
    view.setUint32(36, MAGIC_DATA, true)
    view.setUint32(40, numberOfChannels * numFrames * bytesPerChannel, true)
    let w = 44
    for (let i = 0; i < numFrames; ++i) {
        for (let j = 0; j < numberOfChannels; ++j) {
            view.setFloat32(w, channels[j][i], true)
            w += bytesPerChannel
        }
    }
    return view.buffer
}