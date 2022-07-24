import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {BankGroupIndex, TrackIndex} from "../audio/tr909/memory.js"
import {Pattern, Step} from "../audio/tr909/pattern.js"
import {ArrayUtils, Terminable, Terminator} from "../lib/common.js"
import {PowInjective} from "../lib/injective.js"
import {MachineContext} from "./context.js"
import {FunctionKeyIndex, FunctionKeyState, MainKey, MainKeyIndex, MainKeyState} from "./keys.js"
import {InstrumentMode, Utils} from "./utils.js"

export abstract class MachineState implements Terminable {
    private readonly terminator: Terminator = new Terminator()

    protected constructor(readonly context: MachineContext) {
    }

    onFunctionKeyPress(keyIndex: FunctionKeyIndex): void {
    }

    onFunctionKeyRelease(keyIndex: FunctionKeyIndex): void {
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
    }

    onMainKeyRelease(keyIndex: MainKeyIndex): void {
    }

    readonly playInstrument = (keyIndex: MainKeyIndex): void => {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const machine = this.context.machine
        const playInstrument = Utils.keyIndexToPlayInstrument(keyIndex, this.context.pressedMainKeys)
        const channelIndex = playInstrument.channelIndex
        const step = playInstrument.step
        machine.play(channelIndex, step)
    }

    readonly with = <T extends Terminable>(terminable: T): T => this.terminator.with(terminable)
    readonly terminate = (): void => this.terminator.terminate()
}

export class TrackPlayState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showRunningAnimation())
        this.with(this.context.machine.memory.cycleMode.addObserver(mode =>
            this.context.functionKeys.byIndex(FunctionKeyIndex.CycleGuideLastMeasure)
                .setState(mode ? FunctionKeyState.On : FunctionKeyState.Off), true))
        this.with(this.context.machine.memory.trackIndex.addObserver(trackIndex => {
            const patternSequence = this.context.machine.memory.tracks[trackIndex]
            if (patternSequence.length === 0) {
                this.context.showBankGroup(0)
                this.context.showPatternGroup(0)
                this.context.mainKeys.byIndex(0).setState(MainKeyState.Flash)
                this.context.digits.show(0)
            } else {
                this.context.showPatternLocation(patternSequence[0])
                this.context.digits.show(1) // first measure index
            }
            this.context.showTrackIndex(trackIndex, false)
        }, true))
    }

    onFunctionKeyPress(keyIndex: FunctionKeyIndex) {
        if (this.context.shiftMode.get()) {
            if (keyIndex === FunctionKeyIndex.Pattern1) {
                // TODO Goto Pattern Write Mode
            } else if (keyIndex === FunctionKeyIndex.ForwardBankI) {
                this.context.machine.memory.bankGroupIndex.set(BankGroupIndex.I)
            } else if (keyIndex === FunctionKeyIndex.AvailableMeasuresBankII) {
                this.context.machine.memory.bankGroupIndex.set(BankGroupIndex.II)
            }
        } else {
            if (keyIndex === FunctionKeyIndex.CycleGuideLastMeasure) {
                const mode = this.context.machine.memory.cycleMode
                mode.set(!mode.get())
            } else if (keyIndex === FunctionKeyIndex.Track1) {
                this.context.machine.memory.trackIndex.set(TrackIndex.I)
            } else if (keyIndex === FunctionKeyIndex.Track2) {
                this.context.machine.memory.trackIndex.set(TrackIndex.II)
            } else if (keyIndex === FunctionKeyIndex.Track3) {
                this.context.machine.memory.trackIndex.set(TrackIndex.III)
            } else if (keyIndex === FunctionKeyIndex.Track4) {
                this.context.machine.memory.trackIndex.set(TrackIndex.IV)
            }
        }
    }

    onMainKeyPress(keyIndex: MainKeyIndex) {
        this.playInstrument(keyIndex)
    }
}

export class PatternPlayState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.context.functionKeys.byIndex(FunctionKeyIndex.Track1).setState(FunctionKeyState.Off)
        this.context.functionKeys.byIndex(FunctionKeyIndex.Track2).setState(FunctionKeyState.Off)
        this.context.functionKeys.byIndex(FunctionKeyIndex.Track3).setState(FunctionKeyState.Off)
        this.context.functionKeys.byIndex(FunctionKeyIndex.Track4).setState(FunctionKeyState.Off)

        this.context.functionKeys.byIndex(FunctionKeyIndex.Pattern1).setState(FunctionKeyState.On)
    }

    onFunctionKeyPress(keyIndex: FunctionKeyIndex) {
        if (this.context.shiftMode.get()) {
            if (keyIndex === FunctionKeyIndex.Pattern1) {
                // TODO Goto Pattern Write Mode
            }
        }
    }

    onMainKeyPress(keyIndex: MainKeyIndex) {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.context.machine.memory.patternIndex.set(keyIndex as number)
    }
}

export class StepModeState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showPatternSteps())
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const pattern = this.context.machine.memory.pattern()
        const instrumentMode = this.context.instrumentMode.get()
        Utils.setNextStepValue(pattern, instrumentMode, keyIndex)
    }
}

export class ClearStepsState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showPatternSteps())
        this.with(this.context.machine.stepIndex.addObserver(stepIndex => {
            const instrumentMode = this.context.instrumentMode.get()
            const pattern = this.context.machine.memory.pattern()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }
}

export class TapModeState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showRunningAnimation())
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const machine = this.context.machine
        const playInstrument = Utils.keyIndexToPlayInstrument(keyIndex, this.context.pressedMainKeys)
        const channelIndex = playInstrument.channelIndex
        const step = playInstrument.step
        machine.play(channelIndex, step)
        if (machine.transport.isPlaying()) {
            machine.memory.pattern()
                .setStep(channelIndex, machine.stepIndex.get(), step ? Step.Full : Step.Weak)
        }
    }
}

export class ClearTapState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showRunningAnimation())
        this.with(this.context.machine.stepIndex.addObserver(stepIndex => {
            const instrumentMode = Utils.buttonIndicesToInstrumentMode(this.context.pressedMainKeys)
            if (instrumentMode === InstrumentMode.None || instrumentMode === InstrumentMode.TotalAccent) {
                return
            }
            const pattern = this.context.machine.memory.pattern()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }
}

export class InstrumentSelectState extends MachineState {
    private readonly update = (instrumentMode: InstrumentMode) => {
        const toButtonStates = Utils.instrumentModeToButtonStates(instrumentMode)
        this.context.mainKeys.forEach((key: MainKey, keyIndex: MainKeyIndex) => key.setState(toButtonStates(keyIndex)))
    }

    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.instrumentMode.addObserver(this.update, true))
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        this.context.instrumentMode.set(Utils.buttonIndicesToInstrumentMode(this.context.pressedMainKeys))
    }
}

export class ShuffleFlamState extends MachineState {
    private static GrooveExp: number[] = ArrayUtils.fill(7, index => 1.0 + index * 0.2)

    private readonly subscriptions = this.with(new Terminator())

    constructor(context: MachineContext) {
        super(context)

        const memory = this.context.machine.memory
        this.with(memory.userPatternChangeNotification.addObserver((pattern: Pattern) => {
            this.subscriptions.terminate()
            this.subscriptions.with(pattern.groove.addObserver(() => this.update(), false))
            this.subscriptions.with(pattern.flamDelay.addObserver(() => this.update(), false))
            this.update()
        }))
        this.update()
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        const pattern = this.context.machine.memory.pattern()
        if (keyIndex === MainKeyIndex.Step1) {
            pattern.groove.set(GrooveIdentity)
        } else if (keyIndex <= MainKeyIndex.Step7) {
            const grooveFunction = new GrooveFunction()
            const powInjective = new PowInjective()
            powInjective.exponent.set(ShuffleFlamState.GrooveExp[keyIndex])
            grooveFunction.injective.set(powInjective)
            pattern.groove.set(grooveFunction)
        } else if (keyIndex >= MainKeyIndex.Step9 && keyIndex <= MainKeyIndex.Step16) {
            const flamIndex = keyIndex - MainKeyIndex.Step9
            pattern.flamDelay.set(Pattern.FlamDelays[flamIndex])
        }
    }

    private update(): void {
        this.context.clearMainKeys()
        const pattern = this.context.machine.memory.pattern()
        const groove = pattern.groove.get()
        if (groove === GrooveIdentity) {
            this.context.mainKeys[0].setState(MainKeyState.On)
        } else if (groove instanceof GrooveFunction) {
            const injective = groove.injective.get()
            if (injective instanceof PowInjective) {
                const index = ShuffleFlamState.GrooveExp.indexOf(injective.exponent.get())
                if (index >= 0 && index < 7) {
                    this.context.mainKeys[index].setState(MainKeyState.On)
                }
            }
        }
        const flamIndex = Pattern.FlamDelays.indexOf(pattern.flamDelay.get())
        if (flamIndex >= 0 && flamIndex <= 7) {
            this.context.mainKeys[MainKeyIndex.Step9 + flamIndex].setState(MainKeyState.On)
        }
    }
}

export class LastStepSelectState extends MachineState {
    private readonly subscriptions = this.with(new Terminator())

    constructor(context: MachineContext) {
        super(context)

        const memory = this.context.machine.memory
        this.with(memory.userPatternChangeNotification.addObserver((pattern: Pattern) => {
            this.subscriptions.terminate()
            this.subscriptions.with(pattern.addObserver(() => this.update(), true))
        }))
        this.update()
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.context.machine.memory.pattern().lastStep.set(keyIndex + 1)
    }

    update(): void {
        const pattern = this.context.machine.memory.pattern()
        this.context.clearMainKeys()
        this.context.mainKeys[pattern.lastStep.get() - 1].setState(MainKeyState.On)
    }
}