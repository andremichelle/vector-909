import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {Pattern, Step} from "../audio/tr909/pattern.js"
import {ArrayUtils, Terminable, Terminator} from "../lib/common.js"
import {PowInjective} from "../lib/injective.js"
import {MachineContext} from "./context.js"
import {FunctionKeyIndex, Key, KeyState, MainKeyIndex} from "./keys.js"
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

    abstract name(): string

    readonly with = <T extends Terminable>(terminable: T): T => this.terminator.with(terminable)
    readonly terminate = (): void => this.terminator.terminate()
}

export class StepModeState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.activatePatternStepsButtons())
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const pattern = this.context.machine.state.activePattern()
        const instrumentMode = this.context.instrumentMode.get()
        Utils.setNextStepValue(pattern, instrumentMode, keyIndex)
    }

    name(): string {
        return 'Step Mode'
    }
}

export class ClearStepsState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.activatePatternStepsButtons())
        this.with(this.context.machine.processorStepIndex.addObserver(stepIndex => {
            const instrumentMode = this.context.instrumentMode.get()
            const pattern = this.context.machine.state.activePattern()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }

    name(): string {
        return 'Step Clear'
    }
}

export class TapModeState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.activateRunningAnimation())
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const machine = this.context.machine
        const playInstrument = Utils.keyIndexToPlayInstrument(keyIndex, this.context.pressedMainKeys)
        const channelIndex = playInstrument.channelIndex
        const step = playInstrument.step
        machine.play(channelIndex, step)
        if (machine.transport.isPlaying()) {
            machine.state.activePattern()
                .setStep(channelIndex, machine.processorStepIndex.get(), step ? Step.Full : Step.Weak)
        }
    }

    name(): string {
        return 'Tap Mode'
    }
}

export class ClearTapState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.activateRunningAnimation())
        this.with(this.context.machine.processorStepIndex.addObserver(stepIndex => {
            const instrumentMode = Utils.buttonIndicesToInstrumentMode(this.context.pressedMainKeys)
            if (instrumentMode === InstrumentMode.None || instrumentMode === InstrumentMode.TotalAccent) {
                return
            }
            const pattern = this.context.machine.state.activePattern()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }

    name(): string {
        return 'Tap Clear'
    }
}

export class InstrumentSelectState extends MachineState {
    private readonly update = (instrumentMode: InstrumentMode) => {
        const toButtonStates = Utils.instrumentModeToButtonStates(instrumentMode)
        this.context.mainKeys.forEach((key: Key, keyIndex: MainKeyIndex) => key.setState(toButtonStates(keyIndex)))
    }

    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.instrumentMode.addObserver(this.update, true))
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        this.context.instrumentMode.set(Utils.buttonIndicesToInstrumentMode(this.context.pressedMainKeys))
    }

    name(): string {
        return 'Instrument Select'
    }
}

export class ShuffleFlamState extends MachineState {
    private static GrooveExp: number[] = ArrayUtils.fill(7, index => 1.0 + index * 0.2)

    private readonly subscriptions = this.with(new Terminator())

    constructor(context: MachineContext) {
        super(context)

        const state = this.context.machine.state
        this.with(state.patternIndicesChangeNotification.addObserver((pattern: Pattern) => {
            this.subscriptions.terminate()
            this.subscriptions.with(pattern.groove.addObserver(() => this.update(), false))
            this.subscriptions.with(pattern.flamDelay.addObserver(() => this.update(), false))
            this.update()
        }))
        this.update()
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        const pattern = this.context.machine.state.activePattern()
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

    name(): string {
        return 'Flam Shuffle'
    }

    private update(): void {
        this.context.resetMainKeys()
        const pattern = this.context.machine.state.activePattern()
        const groove = pattern.groove.get()
        if (groove === GrooveIdentity) {
            this.context.mainKeys[0].setState(KeyState.On)
        } else if (groove instanceof GrooveFunction) {
            const injective = groove.injective.get()
            if (injective instanceof PowInjective) {
                const index = ShuffleFlamState.GrooveExp.indexOf(injective.exponent.get())
                if (index >= 0 && index < 7) {
                    this.context.mainKeys[index].setState(KeyState.On)
                }
            }
        }
        const flamIndex = Pattern.FlamDelays.indexOf(pattern.flamDelay.get())
        if (flamIndex >= 0 && flamIndex <= 7) {
            this.context.mainKeys[MainKeyIndex.Step9 + flamIndex].setState(KeyState.On)
        }
    }
}

export class LastStepSelectState extends MachineState {
    private readonly subscriptions = this.with(new Terminator())

    constructor(context: MachineContext) {
        super(context)

        const state = this.context.machine.state
        this.with(state.patternIndicesChangeNotification.addObserver((pattern: Pattern) => {
            this.subscriptions.terminate()
            this.subscriptions.with(pattern.addObserver(() => this.update(), true))
        }))
        this.update()
    }

    onMainKeyPress(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.context.machine.state.activePattern().lastStep.set(keyIndex + 1)
    }

    update(): void {
        const pattern = this.context.machine.state.activePattern()
        this.context.resetMainKeys()
        this.context.mainKeys[pattern.lastStep.get() - 1].setState(KeyState.On)
    }

    name(): string {
        return 'Last Step'
    }
}