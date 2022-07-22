import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {Pattern, Step} from "../audio/tr909/memory.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {ArrayUtils, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {PowInjective} from "../lib/injective.js"
import {InstrumentMode} from "./gui.js"
import {MainKey, MainKeyIndex, MainKeyState} from "./keys.js"
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
            this.context.trackIndexButtons.forEach((button: HTMLButtonElement, keyIndex: number) =>
                button.classList.toggle('blink', keyIndex === trackIndex))
        }, true))
        this.terminator.with(this.context.patternGroupIndex.addObserver(patternGroupIndex => {
            this.context.patternGroupButtons.forEach((button: HTMLButtonElement, keyIndex: number) =>
                button.classList.toggle('blink', keyIndex === patternGroupIndex))
        }, true))
    }
}

export class MainButtonsContext {
    static create(machine: TR909Machine, parentNode: ParentNode) {
        return new MainButtonsContext(machine, [...Array.from<HTMLButtonElement>(
            HTML.queryAll('[data-control=main-buttons] [data-control=main-button]', parentNode)),
            HTML.query('[data-control=main-button][data-parameter=total-accent]')]
            .map((element: HTMLButtonElement, keyIndex: MainKeyIndex) => new MainKey(element, keyIndex)))
    }

    readonly instrumentMode: ObservableValueImpl<InstrumentMode> = new ObservableValueImpl<InstrumentMode>(InstrumentMode.Bassdrum)

    private state: NonNullable<MainButtonsState> = new StepModeState(this)

    constructor(readonly machine: TR909Machine,
                readonly buttons: MainKey[]) {
        const terminator = new Terminator()
        this.buttons.forEach((key: MainKey, index: MainKeyIndex) => {
            terminator.with(key.bind('pointerdown', (event: PointerEvent) => {
                key.setPointerCapture(event.pointerId)
                this.state.onMainKeyPress(event, index)
            }))
            terminator.with(key.bind('pointerup', (event: PointerEvent) => this.state.onMainKeyUp(event, index)))
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

    map(indices: number[]): MainKey[] {
        return indices.map(index => this.buttons[index])
    }

    forEach(fn: (button: MainKey, keyIndex: MainKeyIndex, array: MainKey[]) => void): void {
        this.buttons.forEach(fn)
    }

    getByIndex(index: MainKeyIndex): MainKey {
        return this.buttons[index]
    }

    clear(): void {
        this.buttons.forEach(button => button.setState(MainKeyState.Off))
    }

    showPatternSteps(): Terminable {
        const terminator = new Terminator()
        const memory = this.machine.memory
        let patternSubscription = TerminableVoid
        let flashing: MainKey = null
        terminator.with({terminate: () => patternSubscription.terminate()})
        terminator.with(memory.patternIndex.addObserver(() => {
            patternSubscription.terminate()
            patternSubscription = memory.current().addObserver(() => {
                const pattern = this.machine.memory.current()
                const mapping = Utils.createStepToStateMapping(this.instrumentMode.get())
                this.forEach((key: MainKey, keyIndex: number) =>
                    key.setState(keyIndex === MainKeyIndex.TotalAccent
                        ? MainKeyState.Off : mapping(pattern, keyIndex)))
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

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void
}

class TapModeState implements MainButtonsState {
    private readonly buttons: Set<number> = new Set<number>()
    private readonly stepIndexSubscription: Terminable

    constructor(readonly context: MainButtonsContext) {
        this.stepIndexSubscription = this.context.machine.stepIndex.addObserver(index => {
            this.context.clear()
            this.context.getByIndex(index).setState(MainKeyState.Flash)
        }, true)
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.buttons.add(keyIndex)
        const machine = this.context.machine
        const playInstrument = Utils.keyIndexToPlayInstrument(keyIndex, this.buttons)
        if (machine.transport.isPlaying()) {
            machine.memory.current()
                .setStep(playInstrument.channelIndex, machine.stepIndex.get(), playInstrument.step ? Step.Full : Step.Weak)
        }
        machine.play(playInstrument.channelIndex, playInstrument.step)
    }

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void {
        this.buttons.delete(keyIndex)
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

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const pattern = this.context.machine.memory.current()
        const instrumentMode = this.context.instrumentMode.get()
        Utils.setNextPatternStep(pattern, instrumentMode, keyIndex)
    }

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void {
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

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
    }

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void {
    }

    terminate(): void {
        this.terminator.terminate()
    }
}

class InstrumentSelectState implements MainButtonsState {
    private readonly buttons: Set<MainKeyIndex> = new Set<MainKeyIndex>()
    private readonly evaluator = Utils.buttonIndicesToInstrumentMode(this.buttons)

    private readonly update = (instrumentMode: InstrumentMode) => {
        const mapping = Utils.instrumentModeToButtonStates(instrumentMode)
        this.context.forEach((button, keyIndex) => button.setState(mapping(keyIndex)))
    }

    private readonly subscription = this.context.instrumentMode.addObserver(this.update, true)

    constructor(readonly context: MainButtonsContext) {
    }

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        this.buttons.add(keyIndex)
        this.context.instrumentMode.set(this.evaluator())
    }

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (!event.shiftKey) { // TODO Find better solution to emulate multi-touch
            this.buttons.delete(keyIndex)
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

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        const pattern = this.context.machine.memory.current()
        if (keyIndex === 0) {
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

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void {
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
            this.context.getByIndex(0).setState(MainKeyState.On)
        } else if (groove instanceof GrooveFunction) {
            const injective = groove.injective.get()
            if (injective instanceof PowInjective) {
                const index = ShuffleFlamState.GrooveExp.indexOf(injective.exponent.get())
                if (index >= 0 && index < 7) {
                    this.context.getByIndex(index).setState(MainKeyState.On)
                }
            }
        }
        const flamIndex = Pattern.FlamDelays.indexOf(pattern.flamDelay.get())
        if (flamIndex >= 0 && flamIndex <= 7) {
            this.context.getByIndex(MainKeyIndex.Step9 + flamIndex).setState(MainKeyState.On)
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

    onMainKeyPress(event: PointerEvent, keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.context.machine.memory.current().lastStep.set(keyIndex + 1)
    }

    onMainKeyUp(event: PointerEvent, keyIndex: MainKeyIndex): void {
    }

    terminate(): void {
        this.patternLastStepSubscription.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        this.context.clear()
        this.context.getByIndex(pattern.lastStep.get() - 1).setState(MainKeyState.On)
    }
}