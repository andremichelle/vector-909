import {Terminable, Terminator} from "../../../lib/common.js"
import {dbToGain} from "../../common.js"
import {ChannelIndex, InstrumentIndex} from "../memory.js"

export const SilentGain = dbToGain(-72.0)

export const toChannel = (instrument: InstrumentIndex): ChannelIndex => {
    switch (instrument) {
        case InstrumentIndex.Bassdrum:
            return ChannelIndex.Bassdrum
        case InstrumentIndex.Snaredrum:
            return ChannelIndex.Snaredrum
        case InstrumentIndex.TomLow:
            return ChannelIndex.TomLow
        case InstrumentIndex.TomMid:
            return ChannelIndex.TomMid
        case InstrumentIndex.TomHi:
            return ChannelIndex.TomHi
        case InstrumentIndex.Rim:
            return ChannelIndex.Rim
        case InstrumentIndex.Clap:
            return ChannelIndex.Clap
        case InstrumentIndex.HihatOpened:
        case InstrumentIndex.HihatClosed:
            return ChannelIndex.Hihat
        case InstrumentIndex.Crash:
            return ChannelIndex.Crash
        case InstrumentIndex.Ride:
            return ChannelIndex.Ride
    }
    throw new Error(`No channel for ${InstrumentIndex[instrument]}`)
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