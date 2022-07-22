import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {Pattern, Step} from "../audio/tr909/memory.js"
import {ArrayUtils, Terminable, Terminator} from "../lib/common.js"
import {PowInjective} from "../lib/injective.js"
import {MachineContext} from "./context.js"
import {InstrumentMode} from "./gui.js"
import {FunctionKeyIndex, MainKeyIndex, MainKeyState} from "./keys.js"
import {Utils} from "./utils.js"

export abstract class MachineState implements Terminable {
    private readonly terminator: Terminator = new Terminator()

    protected constructor(readonly context: MachineContext) {
    }

    onFunctionKeyPress(event: PointerEvent, keyIndex: FunctionKeyIndex): void {
    }

    onFunctionKeyRelease(event: PointerEvent, keyIndex: FunctionKeyIndex): void {
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
    }

    onMainKeyRelease(event: PointerEvent, keyIndex: MainKeyIndex): void {
    }

    readonly with = <T extends Terminable>(terminable: T): T => this.terminator.with(terminable)
    readonly terminate = (): void => this.terminator.terminate()
}

export class StepModeState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showPatternSteps())
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const pattern = this.context.machine.memory.current()
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
            const pattern = this.context.machine.memory.current()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }
}

export class TapModeState extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showRunningAnimation())
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const machine = this.context.machine
        const playInstrument = Utils.keyIndexToPlayInstrument(keyIndex, this.context.pressedMainKeys)
        const channelIndex = playInstrument.channelIndex
        const step = playInstrument.step
        machine.play(channelIndex, step)
        if (machine.transport.isPlaying()) {
            machine.memory.current()
                .setStep(channelIndex, machine.stepIndex.get(), step ? Step.Full : Step.Weak)
        }
    }
}

export class ClearTapState extends MachineState {
    private readonly mapper = Utils.buttonIndicesToInstrumentMode()

    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.showRunningAnimation())
        this.with(this.context.machine.stepIndex.addObserver(stepIndex => {
            const instrumentMode = this.mapper(this.context.pressedMainKeys)
            if (instrumentMode === InstrumentMode.None || instrumentMode === InstrumentMode.TotalAccent) {
                return
            }
            const pattern = this.context.machine.memory.current()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }
}

export class InstrumentSelectState extends MachineState {
    private readonly mapper = Utils.buttonIndicesToInstrumentMode()

    private readonly update = (instrumentMode: InstrumentMode) => {
        const mapping = Utils.instrumentModeToButtonStates(instrumentMode)
        this.context.mainKeys.forEach((button, keyIndex) => button.setState(mapping(keyIndex)))
    }

    constructor(context: MachineContext) {
        super(context)

        this.with(this.context.instrumentMode.addObserver(this.update, true))
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        this.context.instrumentMode.set(this.mapper(this.context.pressedMainKeys))
    }
}

export class ShuffleFlamState extends MachineState {
    private static GrooveExp: number[] = ArrayUtils.fill(7, index => 1.0 + index * 0.2)

    private readonly subscriptions = this.with(new Terminator())

    constructor(context: MachineContext) {
        super(context)

        const memory = this.context.machine.memory
        this.with(memory.patternIndex.addObserver(() => {
            const pattern = memory.current()
            this.subscriptions.terminate()
            this.subscriptions.with(pattern.groove.addObserver(() => this.update(), false))
            this.subscriptions.with(pattern.flamDelay.addObserver(() => this.update(), false))
            this.update()
        }, true))
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        const pattern = this.context.machine.memory.current()
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
        const pattern = this.context.machine.memory.current()
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
        this.with(memory.patternIndex.addObserver(() => {
            this.subscriptions.terminate()
            this.subscriptions.with(memory.current().addObserver(() => this.update(), true))
        }, true))
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.context.machine.memory.current().lastStep.set(keyIndex + 1)
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        this.context.clearMainKeys()
        this.context.mainKeys[pattern.lastStep.get() - 1].setState(MainKeyState.On)
    }
}