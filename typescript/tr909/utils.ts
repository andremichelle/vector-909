import {ChannelIndex, Pattern, Step} from "../audio/tr909/memory.js"
import {ButtonIndex, InstrumentMode, MainButtonState} from "./gui.js"


export class Utils {
    static buttonIndicesToInstrumentMode(buttons: Set<ButtonIndex>): () => InstrumentMode {
        const simple = (index: ButtonIndex, mode: InstrumentMode) => () => buttons.has(index) ? mode : InstrumentMode.None
        const complex = (i0: ButtonIndex, i1: ButtonIndex, or: InstrumentMode, and: InstrumentMode) =>
            () => {
                const b0 = buttons.has(i0)
                const b1 = buttons.has(i1)
                return b0 && b1 ? and : b0 || b1 ? or : InstrumentMode.None
            }
        const checks: (() => InstrumentMode)[] = [
            complex(0, 1, InstrumentMode.Bassdrum, InstrumentMode.BassdrumFlame),
            complex(2, 3, InstrumentMode.Snaredrum, InstrumentMode.SnaredrumFlame),
            complex(4, 5, InstrumentMode.TomLow, InstrumentMode.TomLowFlame),
            complex(6, 7, InstrumentMode.TomMid, InstrumentMode.TomMidFlame),
            complex(8, 9, InstrumentMode.TomHi, InstrumentMode.TomHiFlame),
            simple(10, InstrumentMode.Rim),
            simple(11, InstrumentMode.Clap),
            complex(12, 13, InstrumentMode.HihatClosed, InstrumentMode.HihatOpened),
            simple(14, InstrumentMode.Crash),
            simple(15, InstrumentMode.Ride)
        ]
        return () => checks.map(check => check()).find(mode => mode != InstrumentMode.None)
    }

    static setNextPatternStep(pattern: Pattern, instrumentMode: InstrumentMode, stepIndex: number): void {
        const normal = (step: Step): Step => step === Step.None || step === Step.Extra ? Step.Weak : step === Step.Weak ? Step.Full : Step.None
        const extra = (step: Step): Step => step !== Step.Extra ? Step.Extra : Step.None
        const setStep = (channelIndex: ChannelIndex, next: (step: Step) => Step) =>
            pattern.setStep(channelIndex, stepIndex, next(pattern.getStep(channelIndex, stepIndex)))
        if (instrumentMode === InstrumentMode.Bassdrum) {
            setStep(ChannelIndex.Bassdrum, normal)
        } else if (instrumentMode === InstrumentMode.BassdrumFlame) {
            setStep(ChannelIndex.Bassdrum, extra)
        } else if (instrumentMode === InstrumentMode.Snaredrum) {
            setStep(ChannelIndex.Snaredrum, normal)
        } else if (instrumentMode === InstrumentMode.SnaredrumFlame) {
            setStep(ChannelIndex.Snaredrum, extra)
        } else if (instrumentMode === InstrumentMode.TomLow) {
            setStep(ChannelIndex.TomLow, normal)
        } else if (instrumentMode === InstrumentMode.TomLowFlame) {
            setStep(ChannelIndex.TomLow, extra)
        } else if (instrumentMode === InstrumentMode.TomMid) {
            setStep(ChannelIndex.TomMid, normal)
        } else if (instrumentMode === InstrumentMode.TomMidFlame) {
            setStep(ChannelIndex.TomMid, extra)
        } else if (instrumentMode === InstrumentMode.TomHi) {
            setStep(ChannelIndex.TomHi, normal)
        } else if (instrumentMode === InstrumentMode.TomHiFlame) {
            setStep(ChannelIndex.TomHi, extra)
        } else if (instrumentMode === InstrumentMode.Rim) {
            setStep(ChannelIndex.Rim, normal)
        } else if (instrumentMode === InstrumentMode.Clap) {
            setStep(ChannelIndex.Clap, normal)
        } else if (instrumentMode === InstrumentMode.HihatClosed) {
            setStep(ChannelIndex.Hihat, normal)
        } else if (instrumentMode === InstrumentMode.HihatOpened) {
            setStep(ChannelIndex.Hihat, extra)
        } else if (instrumentMode === InstrumentMode.Crash) {
            setStep(ChannelIndex.Crash, normal)
        } else if (instrumentMode === InstrumentMode.Ride) {
            setStep(ChannelIndex.Ride, normal)
        } else {
            throw new Error('Could not set step.')
        }
    }

    static createStepToStateMapping(instrumentSelectIndex: InstrumentMode): (pattern: Pattern, stepIndex: ButtonIndex) => MainButtonState {
        const defaultMapping = (step: Step): MainButtonState =>
            step === Step.Weak ? MainButtonState.Flash : step === Step.Full ? MainButtonState.On : MainButtonState.Off
        const extraMapping = (step: Step): MainButtonState =>
            step === Step.Extra ? MainButtonState.On : MainButtonState.Off
        const applyState = (channelIndex: ChannelIndex, mapping: (step: Step) => MainButtonState) =>
            (pattern: Pattern, stepIndex: ButtonIndex) => mapping(pattern.getStep(channelIndex, stepIndex))
        switch (instrumentSelectIndex) {
            case InstrumentMode.Bassdrum:
                return applyState(ChannelIndex.Bassdrum, defaultMapping)
            case InstrumentMode.BassdrumFlame:
                return applyState(ChannelIndex.Bassdrum, extraMapping)
            case InstrumentMode.Snaredrum:
                return applyState(ChannelIndex.Snaredrum, defaultMapping)
            case InstrumentMode.SnaredrumFlame:
                return applyState(ChannelIndex.Snaredrum, extraMapping)
            case InstrumentMode.TomLow:
                return applyState(ChannelIndex.TomLow, defaultMapping)
            case InstrumentMode.TomLowFlame:
                return applyState(ChannelIndex.TomLow, extraMapping)
            case InstrumentMode.TomMid:
                return applyState(ChannelIndex.TomMid, defaultMapping)
            case InstrumentMode.TomMidFlame:
                return applyState(ChannelIndex.TomMid, extraMapping)
            case InstrumentMode.TomHi:
                return applyState(ChannelIndex.TomHi, defaultMapping)
            case InstrumentMode.TomHiFlame:
                return applyState(ChannelIndex.TomHi, extraMapping)
            case InstrumentMode.Rim:
                return applyState(ChannelIndex.Rim, defaultMapping)
            case InstrumentMode.Clap:
                return applyState(ChannelIndex.Clap, defaultMapping)
            case InstrumentMode.HihatClosed:
                return applyState(ChannelIndex.Hihat, defaultMapping)
            case InstrumentMode.HihatOpened:
                return applyState(ChannelIndex.Hihat, extraMapping)
            case InstrumentMode.Crash:
                return applyState(ChannelIndex.Crash, defaultMapping)
            case InstrumentMode.Ride:
                return applyState(ChannelIndex.Ride, defaultMapping)
            case InstrumentMode.TotalAccent: {
            }
        }
        throw new Error()
    }
}

