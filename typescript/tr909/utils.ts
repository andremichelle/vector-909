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
            complex(0, 1, InstrumentMode.Bassdrum, InstrumentMode.BassdrumFlam),
            complex(2, 3, InstrumentMode.Snaredrum, InstrumentMode.SnaredrumFlam),
            complex(4, 5, InstrumentMode.TomLow, InstrumentMode.TomLowFlam),
            complex(6, 7, InstrumentMode.TomMid, InstrumentMode.TomMidFlam),
            complex(8, 9, InstrumentMode.TomHi, InstrumentMode.TomHiFlam),
            simple(10, InstrumentMode.Rim),
            simple(11, InstrumentMode.Clap),
            complex(12, 13, InstrumentMode.HihatClosed, InstrumentMode.HihatOpened),
            simple(14, InstrumentMode.Crash),
            simple(15, InstrumentMode.Ride),
            simple(16, InstrumentMode.TotalAccent)
        ]
        return () => checks.map(check => check()).find(mode => mode != InstrumentMode.None)
    }

    static buttonIndexToPlayInstrument(index: number, buttons: Set<number>): { channelIndex: ChannelIndex, step: Step } {
        if (index === 0) {
            return {channelIndex: ChannelIndex.Bassdrum, step: Step.Full}
        } else if (index === 1) {
            return {channelIndex: ChannelIndex.Bassdrum, step: Step.Weak}
        } else if (index === 2) {
            return {channelIndex: ChannelIndex.Snaredrum, step: Step.Full}
        } else if (index === 3) {
            return {channelIndex: ChannelIndex.Snaredrum, step: Step.Weak}
        } else if (index === 4) {
            return {channelIndex: ChannelIndex.TomLow, step: Step.Full}
        } else if (index === 5) {
            return {channelIndex: ChannelIndex.TomLow, step: Step.Weak}
        } else if (index === 6) {
            return {channelIndex: ChannelIndex.TomMid, step: Step.Full}
        } else if (index === 7) {
            return {channelIndex: ChannelIndex.TomMid, step: Step.Weak}
        } else if (index === 8) {
            return {channelIndex: ChannelIndex.TomHi, step: Step.Full}
        } else if (index === 9) {
            return {channelIndex: ChannelIndex.TomHi, step: Step.Weak}
        } else if (index === 10) {
            return {channelIndex: ChannelIndex.Rim, step: Step.Full}
        } else if (index === 11) {
            return {channelIndex: ChannelIndex.Clap, step: Step.Full}
        } else if (index === 12) {
            return {channelIndex: ChannelIndex.Hihat, step: buttons.has(13) ? Step.Extra : Step.Full}
        } else if (index === 13) {
            return {channelIndex: ChannelIndex.Hihat, step: buttons.has(12) ? Step.Extra : Step.Weak}
        } else if (index === 14) {
            return {channelIndex: ChannelIndex.Crash, step: Step.Full}
        } else if (index === 15) {
            return {channelIndex: ChannelIndex.Ride, step: Step.Full}
        } else if (index === 16) {
            throw new Error(`Total Accent cannot be played`)
        }
        throw new Error(`Unknown index(${index})`)
    }

    static setNextPatternStep(pattern: Pattern, instrumentMode: InstrumentMode, stepIndex: number): void {
        const cycleWeakFull = (step: Step): Step => step === Step.None || step === Step.Extra ? Step.Weak : step === Step.Weak ? Step.Full : Step.None
        const toggleFull = (step: Step): Step => step !== Step.Full ? Step.Full : Step.None
        const toggleExtra = (step: Step): Step => step !== Step.Extra ? Step.Extra : Step.None
        const apply = (channelIndex: ChannelIndex, next: (step: Step) => Step) =>
            pattern.setStep(channelIndex, stepIndex, next(pattern.getStep(channelIndex, stepIndex)))
        if (instrumentMode === InstrumentMode.Bassdrum) {
            apply(ChannelIndex.Bassdrum, cycleWeakFull)
        } else if (instrumentMode === InstrumentMode.BassdrumFlam) {
            apply(ChannelIndex.Bassdrum, toggleExtra)
        } else if (instrumentMode === InstrumentMode.Snaredrum) {
            apply(ChannelIndex.Snaredrum, cycleWeakFull)
        } else if (instrumentMode === InstrumentMode.SnaredrumFlam) {
            apply(ChannelIndex.Snaredrum, toggleExtra)
        } else if (instrumentMode === InstrumentMode.TomLow) {
            apply(ChannelIndex.TomLow, cycleWeakFull)
        } else if (instrumentMode === InstrumentMode.TomLowFlam) {
            apply(ChannelIndex.TomLow, toggleExtra)
        } else if (instrumentMode === InstrumentMode.TomMid) {
            apply(ChannelIndex.TomMid, cycleWeakFull)
        } else if (instrumentMode === InstrumentMode.TomMidFlam) {
            apply(ChannelIndex.TomMid, toggleExtra)
        } else if (instrumentMode === InstrumentMode.TomHi) {
            apply(ChannelIndex.TomHi, cycleWeakFull)
        } else if (instrumentMode === InstrumentMode.TomHiFlam) {
            apply(ChannelIndex.TomHi, toggleExtra)
        } else if (instrumentMode === InstrumentMode.Rim) {
            apply(ChannelIndex.Rim, toggleFull)
        } else if (instrumentMode === InstrumentMode.Clap) {
            apply(ChannelIndex.Clap, toggleFull)
        } else if (instrumentMode === InstrumentMode.HihatClosed) {
            apply(ChannelIndex.Hihat, cycleWeakFull)
        } else if (instrumentMode === InstrumentMode.HihatOpened) {
            apply(ChannelIndex.Hihat, toggleExtra)
        } else if (instrumentMode === InstrumentMode.Crash) {
            apply(ChannelIndex.Crash, toggleFull)
        } else if (instrumentMode === InstrumentMode.Ride) {
            apply(ChannelIndex.Ride, toggleFull)
        } else if (instrumentMode === InstrumentMode.TotalAccent) {
            pattern.setTotalAccent(stepIndex, !pattern.isTotalAccent(stepIndex))
        } else {
            throw new Error('Could not set step.')
        }
    }

    static createStepToStateMapping(instrumentSelectIndex: InstrumentMode): (pattern: Pattern, buttonIndex: ButtonIndex) => MainButtonState {
        const normal = (step: Step): MainButtonState =>
            step === Step.Weak ? MainButtonState.Flash : step === Step.Full ? MainButtonState.On : MainButtonState.Off
        const extra = (step: Step): MainButtonState =>
            step === Step.Extra ? MainButtonState.On : MainButtonState.Off
        const create = (channelIndex: ChannelIndex, mapping: (step: Step) => MainButtonState) =>
            (pattern: Pattern, buttonIndex: ButtonIndex) => buttonIndex < 16 ? mapping(pattern.getStep(channelIndex, buttonIndex)) : MainButtonState.Off
        switch (instrumentSelectIndex) {
            case InstrumentMode.Bassdrum:
                return create(ChannelIndex.Bassdrum, normal)
            case InstrumentMode.BassdrumFlam:
                return create(ChannelIndex.Bassdrum, extra)
            case InstrumentMode.Snaredrum:
                return create(ChannelIndex.Snaredrum, normal)
            case InstrumentMode.SnaredrumFlam:
                return create(ChannelIndex.Snaredrum, extra)
            case InstrumentMode.TomLow:
                return create(ChannelIndex.TomLow, normal)
            case InstrumentMode.TomLowFlam:
                return create(ChannelIndex.TomLow, extra)
            case InstrumentMode.TomMid:
                return create(ChannelIndex.TomMid, normal)
            case InstrumentMode.TomMidFlam:
                return create(ChannelIndex.TomMid, extra)
            case InstrumentMode.TomHi:
                return create(ChannelIndex.TomHi, normal)
            case InstrumentMode.TomHiFlam:
                return create(ChannelIndex.TomHi, extra)
            case InstrumentMode.Rim:
                return create(ChannelIndex.Rim, normal)
            case InstrumentMode.Clap:
                return create(ChannelIndex.Clap, normal)
            case InstrumentMode.HihatClosed:
                return create(ChannelIndex.Hihat, normal)
            case InstrumentMode.HihatOpened:
                return create(ChannelIndex.Hihat, extra)
            case InstrumentMode.Crash:
                return create(ChannelIndex.Crash, normal)
            case InstrumentMode.Ride:
                return create(ChannelIndex.Ride, normal)
            case InstrumentMode.TotalAccent:
                return (pattern: Pattern, buttonIndex: number) =>
                    pattern.isTotalAccent(buttonIndex) ? MainButtonState.On : MainButtonState.Off
        }
        throw new Error()
    }

    static instrumentModeToButtonStates(instrumentMode: InstrumentMode): (buttonIndex: ButtonIndex) => MainButtonState {
        const simple = (buttonIndex: ButtonIndex, index: number) =>
            buttonIndex === index ? MainButtonState.On : MainButtonState.Off
        const complex = (buttonIndex: ButtonIndex, i0: number, i1: number, second: MainButtonState) =>
            buttonIndex === i0 ? MainButtonState.On : buttonIndex === i1 ? second : MainButtonState.Off
        return (buttonIndex: ButtonIndex): MainButtonState => {
            if (instrumentMode === InstrumentMode.Bassdrum) {
                return complex(buttonIndex, 0, 1, MainButtonState.Flash)
            } else if (instrumentMode === InstrumentMode.BassdrumFlam) {
                return complex(buttonIndex, 0, 1, MainButtonState.On)
            } else if (instrumentMode === InstrumentMode.Snaredrum) {
                return complex(buttonIndex, 2, 3, MainButtonState.Flash)
            } else if (instrumentMode === InstrumentMode.SnaredrumFlam) {
                return complex(buttonIndex, 2, 3, MainButtonState.On)
            } else if (instrumentMode === InstrumentMode.TomLow) {
                return complex(buttonIndex, 4, 5, MainButtonState.Flash)
            } else if (instrumentMode === InstrumentMode.TomLowFlam) {
                return complex(buttonIndex, 4, 5, MainButtonState.On)
            } else if (instrumentMode === InstrumentMode.TomMid) {
                return complex(buttonIndex, 6, 7, MainButtonState.Flash)
            } else if (instrumentMode === InstrumentMode.TomMidFlam) {
                return complex(buttonIndex, 6, 7, MainButtonState.On)
            } else if (instrumentMode === InstrumentMode.TomHi) {
                return complex(buttonIndex, 8, 9, MainButtonState.Flash)
            } else if (instrumentMode === InstrumentMode.TomHiFlam) {
                return complex(buttonIndex, 8, 9, MainButtonState.On)
            } else if (instrumentMode === InstrumentMode.Rim) {
                return simple(buttonIndex, 10)
            } else if (instrumentMode === InstrumentMode.Clap) {
                return simple(buttonIndex, 11)
            } else if (instrumentMode === InstrumentMode.HihatClosed) {
                return complex(buttonIndex, 12, 13, MainButtonState.Flash)
            } else if (instrumentMode === InstrumentMode.HihatOpened) {
                return complex(buttonIndex, 12, 13, MainButtonState.On)
            } else if (instrumentMode === InstrumentMode.Crash) {
                return simple(buttonIndex, 14)
            } else if (instrumentMode === InstrumentMode.Ride) {
                return simple(buttonIndex, 15)
            } else if (instrumentMode === InstrumentMode.TotalAccent) {
                return simple(buttonIndex, 16)
            }
            return MainButtonState.Off
        }
    }
}

