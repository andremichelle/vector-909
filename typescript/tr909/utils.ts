import {ChannelIndex, Pattern, Step} from "../audio/tr909/memory.js"
import {elseIfUndefined} from "../lib/common.js"
import {InstrumentMode} from "./gui.js"
import {MainKeyIndex, MainKeyState} from "./keys.js"

interface StepModifier {
    weakFull(step: Step): Step

    full(step: Step): Step

    extra(step: Step): Step

    totalAccent(stepIndex: number): void
}

export class Utils {
    static buttonIndicesToInstrumentMode(buttons: Set<MainKeyIndex>): () => InstrumentMode {
        const simple = (keyIndex: MainKeyIndex, mode: InstrumentMode) => () => buttons.has(keyIndex) ? mode : InstrumentMode.None
        const complex = (keyIndexA: MainKeyIndex, keyIndexB: MainKeyIndex, or: InstrumentMode, and: InstrumentMode) =>
            () => {
                const a = buttons.has(keyIndexA)
                const b = buttons.has(keyIndexB)
                return a && b ? and : a || b ? or : InstrumentMode.None
            }
        const checks: (() => InstrumentMode)[] = [
            complex(MainKeyIndex.Step1, MainKeyIndex.Step2, InstrumentMode.Bassdrum, InstrumentMode.BassdrumFlam),
            complex(MainKeyIndex.Step3, MainKeyIndex.Step4, InstrumentMode.Snaredrum, InstrumentMode.SnaredrumFlam),
            complex(MainKeyIndex.Step5, MainKeyIndex.Step6, InstrumentMode.TomLow, InstrumentMode.TomLowFlam),
            complex(MainKeyIndex.Step7, MainKeyIndex.Step8, InstrumentMode.TomMid, InstrumentMode.TomMidFlam),
            complex(MainKeyIndex.Step9, MainKeyIndex.Step10, InstrumentMode.TomHi, InstrumentMode.TomHiFlam),
            simple(MainKeyIndex.Step11, InstrumentMode.Rim),
            simple(MainKeyIndex.Step12, InstrumentMode.Clap),
            complex(MainKeyIndex.Step13, MainKeyIndex.Step14, InstrumentMode.HihatClosed, InstrumentMode.HihatOpened),
            simple(MainKeyIndex.Step15, InstrumentMode.Crash),
            simple(MainKeyIndex.Step16, InstrumentMode.Ride),
            simple(MainKeyIndex.TotalAccent, InstrumentMode.TotalAccent)
        ]
        return () => elseIfUndefined(checks.map(check => check()).find(mode => mode != InstrumentMode.None), InstrumentMode.None)
    }

    static keyIndexToPlayInstrument(keyIndex: MainKeyIndex, other: Set<MainKeyIndex>): { channelIndex: ChannelIndex, step: Step } {
        if (keyIndex === MainKeyIndex.Step1) {
            return {channelIndex: ChannelIndex.Bassdrum, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step2) {
            return {channelIndex: ChannelIndex.Bassdrum, step: Step.Weak}
        } else if (keyIndex === MainKeyIndex.Step3) {
            return {channelIndex: ChannelIndex.Snaredrum, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step4) {
            return {channelIndex: ChannelIndex.Snaredrum, step: Step.Weak}
        } else if (keyIndex === MainKeyIndex.Step5) {
            return {channelIndex: ChannelIndex.TomLow, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step6) {
            return {channelIndex: ChannelIndex.TomLow, step: Step.Weak}
        } else if (keyIndex === MainKeyIndex.Step7) {
            return {channelIndex: ChannelIndex.TomMid, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step8) {
            return {channelIndex: ChannelIndex.TomMid, step: Step.Weak}
        } else if (keyIndex === MainKeyIndex.Step9) {
            return {channelIndex: ChannelIndex.TomHi, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step10) {
            return {channelIndex: ChannelIndex.TomHi, step: Step.Weak}
        } else if (keyIndex === MainKeyIndex.Step11) {
            return {channelIndex: ChannelIndex.Rim, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step12) {
            return {channelIndex: ChannelIndex.Clap, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step13) {
            return {channelIndex: ChannelIndex.Hihat, step: other.has(MainKeyIndex.Step14) ? Step.Extra : Step.Full}
        } else if (keyIndex === MainKeyIndex.Step14) {
            return {channelIndex: ChannelIndex.Hihat, step: other.has(MainKeyIndex.Step13) ? Step.Extra : Step.Weak}
        } else if (keyIndex === MainKeyIndex.Step15) {
            return {channelIndex: ChannelIndex.Crash, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.Step16) {
            return {channelIndex: ChannelIndex.Ride, step: Step.Full}
        } else if (keyIndex === MainKeyIndex.TotalAccent) {
            throw new Error(`Total Accent cannot be played`)
        }
        throw new Error(`Unknown index(${keyIndex})`)
    }

    static setNextPatternStep(pattern: Pattern, instrumentMode: InstrumentMode, stepIndex: number): void {
        Utils.modifyPatternStep(pattern, instrumentMode, {
            weakFull: (step: Step): Step => step === Step.None || step === Step.Extra ? Step.Weak : step === Step.Weak ? Step.Full : Step.None,
            full: (step: Step): Step => step !== Step.Full ? Step.Full : Step.None,
            extra: (step: Step): Step => step !== Step.Extra ? Step.Extra : Step.None,
            totalAccent: (stepIndex: number) => pattern.setTotalAccent(stepIndex, !pattern.isTotalAccent(stepIndex))
        }, stepIndex)
    }

    static clearPatternStep(pattern: Pattern, instrumentMode: InstrumentMode, stepIndex: number): void {
        Utils.modifyPatternStep(pattern, instrumentMode, {
            weakFull: (step: Step): Step => step === Step.Full || step === Step.Weak ? Step.None : step,
            full: (step: Step): Step => step === Step.Full ? Step.None : step,
            extra: (step: Step): Step => step === Step.Extra ? Step.None : step,
            totalAccent: (stepIndex: number) => pattern.setTotalAccent(stepIndex, false)
        }, stepIndex)
    }

    private static modifyPatternStep(pattern: Pattern, instrumentMode: InstrumentMode, modifier: StepModifier, stepIndex: number): void {
        const apply = (channelIndex: ChannelIndex, next: (step: Step) => Step) =>
            pattern.setStep(channelIndex, stepIndex, next(pattern.getStep(channelIndex, stepIndex)))
        if (instrumentMode === InstrumentMode.Bassdrum) {
            apply(ChannelIndex.Bassdrum, modifier.weakFull)
        } else if (instrumentMode === InstrumentMode.BassdrumFlam) {
            apply(ChannelIndex.Bassdrum, modifier.extra)
        } else if (instrumentMode === InstrumentMode.Snaredrum) {
            apply(ChannelIndex.Snaredrum, modifier.weakFull)
        } else if (instrumentMode === InstrumentMode.SnaredrumFlam) {
            apply(ChannelIndex.Snaredrum, modifier.extra)
        } else if (instrumentMode === InstrumentMode.TomLow) {
            apply(ChannelIndex.TomLow, modifier.weakFull)
        } else if (instrumentMode === InstrumentMode.TomLowFlam) {
            apply(ChannelIndex.TomLow, modifier.extra)
        } else if (instrumentMode === InstrumentMode.TomMid) {
            apply(ChannelIndex.TomMid, modifier.weakFull)
        } else if (instrumentMode === InstrumentMode.TomMidFlam) {
            apply(ChannelIndex.TomMid, modifier.extra)
        } else if (instrumentMode === InstrumentMode.TomHi) {
            apply(ChannelIndex.TomHi, modifier.weakFull)
        } else if (instrumentMode === InstrumentMode.TomHiFlam) {
            apply(ChannelIndex.TomHi, modifier.extra)
        } else if (instrumentMode === InstrumentMode.Rim) {
            apply(ChannelIndex.Rim, modifier.full)
        } else if (instrumentMode === InstrumentMode.Clap) {
            apply(ChannelIndex.Clap, modifier.full)
        } else if (instrumentMode === InstrumentMode.HihatClosed) {
            apply(ChannelIndex.Hihat, modifier.weakFull)
        } else if (instrumentMode === InstrumentMode.HihatOpened) {
            apply(ChannelIndex.Hihat, modifier.extra)
        } else if (instrumentMode === InstrumentMode.Crash) {
            apply(ChannelIndex.Crash, modifier.full)
        } else if (instrumentMode === InstrumentMode.Ride) {
            apply(ChannelIndex.Ride, modifier.full)
        } else if (instrumentMode === InstrumentMode.TotalAccent) {
            pattern.setTotalAccent(stepIndex, !pattern.isTotalAccent(stepIndex))
        } else {
            throw new Error('Could not set step.')
        }
    }

    static createStepToStateMapping(instrumentMode: InstrumentMode): (pattern: Pattern, keyIndex: MainKeyIndex) => MainKeyState {
        const normal = (step: Step): MainKeyState =>
            step === Step.Weak ? MainKeyState.Flash : step === Step.Full ? MainKeyState.On : MainKeyState.Off
        const extra = (step: Step): MainKeyState =>
            step === Step.Extra ? MainKeyState.On : MainKeyState.Off
        const create = (channelIndex: ChannelIndex, mapping: (step: Step) => MainKeyState) =>
            (pattern: Pattern, keyIndex: MainKeyIndex) => keyIndex < 16 ? mapping(pattern.getStep(channelIndex, keyIndex)) : MainKeyState.Off
        if (instrumentMode === InstrumentMode.Bassdrum) {
            return create(ChannelIndex.Bassdrum, normal)
        } else if (instrumentMode === InstrumentMode.BassdrumFlam) {
            return create(ChannelIndex.Bassdrum, extra)
        } else if (instrumentMode === InstrumentMode.Snaredrum) {
            return create(ChannelIndex.Snaredrum, normal)
        } else if (instrumentMode === InstrumentMode.SnaredrumFlam) {
            return create(ChannelIndex.Snaredrum, extra)
        } else if (instrumentMode === InstrumentMode.TomLow) {
            return create(ChannelIndex.TomLow, normal)
        } else if (instrumentMode === InstrumentMode.TomLowFlam) {
            return create(ChannelIndex.TomLow, extra)
        } else if (instrumentMode === InstrumentMode.TomMid) {
            return create(ChannelIndex.TomMid, normal)
        } else if (instrumentMode === InstrumentMode.TomMidFlam) {
            return create(ChannelIndex.TomMid, extra)
        } else if (instrumentMode === InstrumentMode.TomHi) {
            return create(ChannelIndex.TomHi, normal)
        } else if (instrumentMode === InstrumentMode.TomHiFlam) {
            return create(ChannelIndex.TomHi, extra)
        } else if (instrumentMode === InstrumentMode.Rim) {
            return create(ChannelIndex.Rim, normal)
        } else if (instrumentMode === InstrumentMode.Clap) {
            return create(ChannelIndex.Clap, normal)
        } else if (instrumentMode === InstrumentMode.HihatClosed) {
            return create(ChannelIndex.Hihat, normal)
        } else if (instrumentMode === InstrumentMode.HihatOpened) {
            return create(ChannelIndex.Hihat, extra)
        } else if (instrumentMode === InstrumentMode.Crash) {
            return create(ChannelIndex.Crash, normal)
        } else if (instrumentMode === InstrumentMode.Ride) {
            return create(ChannelIndex.Ride, normal)
        } else if (instrumentMode === InstrumentMode.TotalAccent) {
            return (pattern: Pattern, keyIndex: number) =>
                pattern.isTotalAccent(keyIndex) ? MainKeyState.On : MainKeyState.Off
        } else {
            throw new Error(`Unknown instrumentMode(${instrumentMode})`)
        }
    }

    static instrumentModeToButtonStates(instrumentMode: InstrumentMode): (keyIndex: MainKeyIndex) => MainKeyState {
        const simple = (keyIndex: MainKeyIndex, index: number) =>
            keyIndex === index ? MainKeyState.On : MainKeyState.Off
        const complex = (keyIndex: MainKeyIndex, i0: number, i1: number, second: MainKeyState) =>
            keyIndex === i0 ? MainKeyState.On : keyIndex === i1 ? second : MainKeyState.Off
        return (keyIndex: MainKeyIndex): MainKeyState => {
            if (instrumentMode === InstrumentMode.Bassdrum) {
                return complex(keyIndex, MainKeyIndex.Step1, MainKeyIndex.Step2, MainKeyState.Flash)
            } else if (instrumentMode === InstrumentMode.BassdrumFlam) {
                return complex(keyIndex, MainKeyIndex.Step1, MainKeyIndex.Step2, MainKeyState.On)
            } else if (instrumentMode === InstrumentMode.Snaredrum) {
                return complex(keyIndex, MainKeyIndex.Step3, MainKeyIndex.Step4, MainKeyState.Flash)
            } else if (instrumentMode === InstrumentMode.SnaredrumFlam) {
                return complex(keyIndex, MainKeyIndex.Step3, MainKeyIndex.Step4, MainKeyState.On)
            } else if (instrumentMode === InstrumentMode.TomLow) {
                return complex(keyIndex, MainKeyIndex.Step5, MainKeyIndex.Step6, MainKeyState.Flash)
            } else if (instrumentMode === InstrumentMode.TomLowFlam) {
                return complex(keyIndex, MainKeyIndex.Step5, MainKeyIndex.Step6, MainKeyState.On)
            } else if (instrumentMode === InstrumentMode.TomMid) {
                return complex(keyIndex, MainKeyIndex.Step7, MainKeyIndex.Step8, MainKeyState.Flash)
            } else if (instrumentMode === InstrumentMode.TomMidFlam) {
                return complex(keyIndex, MainKeyIndex.Step7, MainKeyIndex.Step8, MainKeyState.On)
            } else if (instrumentMode === InstrumentMode.TomHi) {
                return complex(keyIndex, MainKeyIndex.Step9, MainKeyIndex.Step10, MainKeyState.Flash)
            } else if (instrumentMode === InstrumentMode.TomHiFlam) {
                return complex(keyIndex, MainKeyIndex.Step9, MainKeyIndex.Step10, MainKeyState.On)
            } else if (instrumentMode === InstrumentMode.Rim) {
                return simple(keyIndex, MainKeyIndex.Step11)
            } else if (instrumentMode === InstrumentMode.Clap) {
                return simple(keyIndex, MainKeyIndex.Step12)
            } else if (instrumentMode === InstrumentMode.HihatClosed) {
                return complex(keyIndex, MainKeyIndex.Step13, MainKeyIndex.Step14, MainKeyState.Flash)
            } else if (instrumentMode === InstrumentMode.HihatOpened) {
                return complex(keyIndex, MainKeyIndex.Step13, MainKeyIndex.Step14, MainKeyState.On)
            } else if (instrumentMode === InstrumentMode.Crash) {
                return simple(keyIndex, MainKeyIndex.Step15)
            } else if (instrumentMode === InstrumentMode.Ride) {
                return simple(keyIndex, MainKeyIndex.Step16)
            } else if (instrumentMode === InstrumentMode.TotalAccent) {
                return simple(keyIndex, MainKeyIndex.TotalAccent)
            } else {
                throw new Error(`Unknown instrumentMode(${instrumentMode})`)
            }
        }
    }
}

