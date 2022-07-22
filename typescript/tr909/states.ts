import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {Pattern, Step} from "../audio/tr909/memory.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {ArrayUtils, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {PowInjective} from "../lib/injective.js"
import {ButtonIndex, InstrumentMode, MainButton, MainButtonState} from "./gui.js"
import {Utils} from "./utils.js"

/**
 * 909 States
 [TRACK PLAY]
 + not playing
 + | Track buttons 1-4 permanently lit
 + | Shows '1' in display if track sequence is available or zero if not
 + | First pattern index is blinking on main-button or first if empty
 + | All instruments can be tapped
 + | FWD will increase track sequence position (until end)
 + | BACK will decrease track sequence position (until start)
 + | TEMPO will show tempo
 + playing
 + | If CYCLE/GUIDE is turned on, if track sequence will be repeated
 + | TEMPO will show tempo
 */

export class MachineContext {
    readonly shiftButton: HTMLButtonElement
    readonly trackIndexButtons: HTMLButtonElement[]
    readonly patternGroupButtons: HTMLButtonElement[]

    readonly trackIndex: ObservableValueImpl<number> = new ObservableValueImpl<number>(0)
    readonly patternGroupIndex: ObservableValueImpl<number> = new ObservableValueImpl<number>(0)

    private state: NonNullable<MachineState>

    constructor(readonly machine: TR909Machine, parentNode: ParentNode) {
        this.shiftButton = HTML.query('[data-button=shift]', parentNode)
        this.trackIndexButtons = HTML.queryAll('[data-button=track-index]', parentNode)
        this.patternGroupButtons = HTML.queryAll('[data-button=pattern-group]', parentNode)
        this.state = new TrackPlayState(this)
    }
}

export interface MachineState {
    readonly context: MachineContext
}

export class TrackPlayState implements MachineState {
    private readonly terminator: Terminator = new Terminator()

    constructor(readonly context: MachineContext) {
        this.terminator.with(this.context.trackIndex.addObserver(trackIndex => {
            this.context.trackIndexButtons.forEach((button: HTMLButtonElement, buttonIndex: number) =>
                button.classList.toggle('blink', buttonIndex === trackIndex))
        }, true))
        this.terminator.with(this.context.patternGroupIndex.addObserver(patternGroupIndex => {
            this.context.patternGroupButtons.forEach((button: HTMLButtonElement, buttonIndex: number) =>
                button.classList.toggle('blink', buttonIndex === patternGroupIndex))
        }, true))
    }
}

export class MainButtonsContext {
    static create(machine: TR909Machine, parentNode: ParentNode) {
        const buttons = [...Array.from<HTMLButtonElement>(HTML.queryAll('[data-control=main-buttons] [data-control=main-button]', parentNode)),
            HTML.query('[data-control=main-button][data-parameter=total-accent]')]
            .map((element: HTMLButtonElement) => new MainButton(element))
        return new MainButtonsContext(machine, buttons)
    }

    readonly instrumentMode: ObservableValueImpl<InstrumentMode> = new ObservableValueImpl<InstrumentMode>(InstrumentMode.Bassdrum)

    private state: NonNullable<MainButtonsState> = new StepModeState(this)

    constructor(readonly machine: TR909Machine,
                readonly buttons: MainButton[]) {
        const terminator = new Terminator()
        this.buttons.forEach((button: MainButton, index: ButtonIndex) => {
            terminator.with(button.bind('pointerdown', (event: PointerEvent) => {
                button.setPointerCapture(event.pointerId)
                this.state.onButtonPress(event, index)
            }))
            terminator.with(button.bind('pointerup', (event: PointerEvent) => this.state.onButtonUp(event, index)))
        })
        // TODO terminator.terminate
    }

    switchToStepModeState(): void {
        this.state.terminate()
        this.state = new StepModeState(this)
    }

    switchToTapModeState(): void {
        this.state.terminate()
        this.state = new TapModeState(this)
    }

    switchToShuffleFlamState() {
        this.state.terminate()
        this.state = new ShuffleFlamState(this)
    }

    switchToClearStepsState() {
        this.state.terminate()
        this.state = new ClearStepsState(this)
    }

    switchToInstrumentSelectModeState(): void {
        this.state.terminate()
        this.state = new InstrumentSelectState(this)
    }

    switchToLastStepSelectState(): void {
        this.state.terminate()
        this.state = new LastStepSelectState(this)
    }

    map(indices: number[]): MainButton[] {
        return indices.map(index => this.buttons[index])
    }

    forEach(fn: (button: MainButton, buttonIndex: ButtonIndex, array: MainButton[]) => void): void {
        this.buttons.forEach(fn)
    }

    getByIndex(index: ButtonIndex): MainButton {
        return this.buttons[index]
    }

    clear(): void {
        this.buttons.forEach(button => button.setState(MainButtonState.Off))
    }

    showPatternSteps(): Terminable {
        const terminator = new Terminator()
        const memory = this.machine.memory
        let patternSubscription = TerminableVoid
        let flashing: MainButton = null
        terminator.with({terminate: () => patternSubscription.terminate()})
        terminator.with(memory.patternIndex.addObserver(() => {
            patternSubscription.terminate()
            patternSubscription = memory.current().addObserver(() => {
                const pattern = this.machine.memory.current()
                const mapping = Utils.createStepToStateMapping(this.instrumentMode.get())
                this.forEach((button: MainButton, buttonIndex: number) =>
                    button.setState(buttonIndex === ButtonIndex.TotalAccent
                        ? MainButtonState.Off : mapping(pattern, buttonIndex)))
            }, true)
        }, true))
        terminator.with(this.machine.stepIndex.addObserver(stepIndex => {
            if (flashing !== null) {
                flashing.applyState()
            }
            flashing = this.getByIndex(stepIndex)
            this.getByIndex(stepIndex).flash()
        }))
        return terminator
    }
}

interface MainButtonsState extends Terminable {
    readonly context: MainButtonsContext

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void
}

class TapModeState implements MainButtonsState {
    private readonly buttons: Set<number> = new Set<number>()
    private readonly stepIndexSubscription: Terminable

    constructor(readonly context: MainButtonsContext) {
        this.stepIndexSubscription = this.context.machine.stepIndex.addObserver(index => {
            this.context.clear()
            this.context.getByIndex(index).setState(MainButtonState.Flash)
        }, true)
    }

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void {
        if (buttonIndex === ButtonIndex.TotalAccent) return
        this.buttons.add(buttonIndex)
        const machine = this.context.machine
        const playInstrument = Utils.buttonIndexToPlayInstrument(buttonIndex, this.buttons)
        if (machine.transport.isPlaying()) {
            machine.memory.current()
                .setStep(playInstrument.channelIndex, machine.stepIndex.get(), playInstrument.step ? Step.Full : Step.Weak)
        }
        machine.play(playInstrument.channelIndex, playInstrument.step)
    }

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void {
        this.buttons.delete(buttonIndex)
    }

    terminate(): void {
        this.buttons.clear()
        this.stepIndexSubscription.terminate()
    }
}

class StepModeState implements MainButtonsState {
    private readonly terminable = this.context.showPatternSteps()

    constructor(readonly context: MainButtonsContext) {
    }

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void {
        if (buttonIndex === ButtonIndex.TotalAccent) return
        const pattern = this.context.machine.memory.current()
        const instrumentMode = this.context.instrumentMode.get()
        Utils.setNextPatternStep(pattern, instrumentMode, buttonIndex)
    }

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void {
    }

    terminate(): void {
        this.terminable.terminate()
    }
}

class ClearStepsState implements MainButtonsState {
    private readonly terminator = new Terminator()

    constructor(readonly context: MainButtonsContext) {
        this.terminator.with(this.context.showPatternSteps())
        this.terminator.with(this.context.machine.stepIndex.addObserver(stepIndex => {
            const instrumentMode = this.context.instrumentMode.get()
            const pattern = this.context.machine.memory.current()
            Utils.clearPatternStep(pattern, instrumentMode, stepIndex)
        }, true))
    }

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void {
    }

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void {
    }

    terminate(): void {
        this.terminator.terminate()
    }
}

class InstrumentSelectState implements MainButtonsState {
    private readonly buttons: Set<ButtonIndex> = new Set<ButtonIndex>()
    private readonly evaluator = Utils.buttonIndicesToInstrumentMode(this.buttons)

    private readonly update = (instrumentMode: InstrumentMode) => {
        const mapping = Utils.instrumentModeToButtonStates(instrumentMode)
        this.context.forEach((button, buttonIndex) => button.setState(mapping(buttonIndex)))
    }

    private readonly subscription = this.context.instrumentMode.addObserver(this.update, true)

    constructor(readonly context: MainButtonsContext) {
    }

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void {
        this.buttons.add(buttonIndex)
        this.context.instrumentMode.set(this.evaluator())
    }

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void {
        if (!event.shiftKey) { // TODO Find better solution to emulate multi-touch
            this.buttons.delete(buttonIndex)
        }
    }

    terminate(): void {
        this.subscription.terminate()
        this.buttons.clear()
    }
}

class ShuffleFlamState implements MainButtonsState {
    private static GrooveExp: number[] = ArrayUtils.fill(7, index => 1.0 + index * 0.2)

    private subscriptions = new Terminator()
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.subscriptions.terminate()
            const pattern = memory.current()
            this.subscriptions.with(pattern.groove.addObserver(() => this.update(), true))
            this.subscriptions.with(pattern.flamDelay.addObserver(() => this.update(), true))
        }, true)
    }

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void {
        const pattern = this.context.machine.memory.current()
        if (buttonIndex === 0) {
            pattern.groove.set(GrooveIdentity)
        } else if (buttonIndex <= ButtonIndex.Step7) {
            const grooveFunction = new GrooveFunction()
            const powInjective = new PowInjective()
            powInjective.exponent.set(ShuffleFlamState.GrooveExp[buttonIndex])
            grooveFunction.injective.set(powInjective)
            pattern.groove.set(grooveFunction)
        } else if (buttonIndex >= ButtonIndex.Step9 && buttonIndex <= ButtonIndex.Step16) {
            const flamIndex = buttonIndex - ButtonIndex.Step9
            pattern.flamDelay.set(Pattern.FlamDelays[flamIndex])
        }
    }

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void {
    }

    terminate(): void {
        this.subscriptions.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        this.context.clear()
        const pattern = this.context.machine.memory.current()
        const groove = pattern.groove.get()
        if (groove === GrooveIdentity) {
            this.context.getByIndex(0).setState(MainButtonState.On)
        } else if (groove instanceof GrooveFunction) {
            const injective = groove.injective.get()
            if (injective instanceof PowInjective) {
                const index = ShuffleFlamState.GrooveExp.indexOf(injective.exponent.get())
                if (index >= 0 && index < 7) {
                    this.context.getByIndex(index).setState(MainButtonState.On)
                }
            }
        }
        const flamIndex = Pattern.FlamDelays.indexOf(pattern.flamDelay.get())
        if (flamIndex >= 0 && flamIndex <= 7) {
            this.context.getByIndex(ButtonIndex.Step9 + flamIndex).setState(MainButtonState.On)
        }
    }
}

class LastStepSelectState implements MainButtonsState {
    private patternLastStepSubscription: Terminable = TerminableVoid
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.patternLastStepSubscription.terminate()
            this.patternLastStepSubscription = memory.current().addObserver(() => this.update(), true)
        }, true)
    }

    onButtonPress(event: PointerEvent, buttonIndex: ButtonIndex): void {
        if (buttonIndex === ButtonIndex.TotalAccent) return
        this.context.machine.memory.current().lastStep.set(buttonIndex + 1)
    }

    onButtonUp(event: PointerEvent, buttonIndex: ButtonIndex): void {
    }

    terminate(): void {
        this.patternLastStepSubscription.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        this.context.clear()
        this.context.getByIndex(pattern.lastStep.get() - 1).setState(MainButtonState.On)
    }
}