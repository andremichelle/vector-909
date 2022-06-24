import {Terminable, Terminator} from "../../../lib/common.js"
import {dbToGain} from "../../common.js"
import {Instrument} from "../patterns.js"
import {ChannelIndex} from "./channel.js"

export const SilentGain = dbToGain(-72.0)

export const toChannel = (instrument: Instrument): ChannelIndex => {
    switch (instrument) {
        case Instrument.Bassdrum:
            return ChannelIndex.Bassdrum
        case Instrument.Snaredrum:
            return ChannelIndex.Snaredrum
        case Instrument.TomLow:
            return ChannelIndex.TomLow
        case Instrument.TomMid:
            return ChannelIndex.TomMid
        case Instrument.TomHi:
            return ChannelIndex.TomHi
        case Instrument.Rim:
            return ChannelIndex.Rim
        case Instrument.Clap:
            return ChannelIndex.Clap
        case Instrument.HihatOpened:
        case Instrument.HihatClosed:
            return ChannelIndex.Hihat
        case Instrument.Crash:
            return ChannelIndex.Crash
        case Instrument.Ride:
            return ChannelIndex.Ride
    }
    throw new Error(`No channel for ${Instrument[instrument]}`)
}

export type isRunning = boolean

export abstract class Voice implements Terminable {
    protected readonly terminator: Terminator = new Terminator()

    protected readonly sampleRateInv: number = 1.0 / this.sampleRate

    protected constructor(readonly sampleRate: number) {
    }

    abstract stop(): void

    abstract process(output: Float32Array, from: number, to: number): isRunning

    terminate(): void {
        this.terminator.terminate()
    }
}