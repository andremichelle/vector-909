import {Terminable, Terminator} from "../../../lib/common.js"
import {dbToGain} from "../../common.js"
import {Instrument} from "../patterns.js"

export const SilentGain = dbToGain(-72.0)

export enum Channel {
    Bassdrum, Snaredrum, TomLow, TomMid, TomHi, Rim, Clap, Hihat, Crash, Ride
}

export const mapInstrumentChannel = (instrument: Instrument): Channel => {
    switch (instrument) {
        case Instrument.Bassdrum:
            return Channel.Bassdrum
        case Instrument.Snaredrum:
            return Channel.Snaredrum
        case Instrument.TomLow:
            return Channel.TomLow
        case Instrument.TomMid:
            return Channel.TomMid
        case Instrument.TomHi:
            return Channel.TomHi
        case Instrument.Rim:
            return Channel.Rim
        case Instrument.Clap:
            return Channel.Clap
        case Instrument.HihatOpened:
        case Instrument.HihatClosed:
            return Channel.Hihat
        case Instrument.Crash:
            return Channel.Crash
        case Instrument.Ride:
            return Channel.Ride
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