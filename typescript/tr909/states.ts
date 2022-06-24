import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {FlamDelays, Instrument, Step} from "../audio/tr909/patterns.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {ArrayUtils, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {PowInjective} from "../lib/injective.js"

/**
 * 909 States
 [TRACK PLAY]
 + not playing
 ++ Track buttons 1-4 permanently lit
 ++ Shows '1' in display if track sequence is available or zero if not
 ++ First pattern index is blinking on main-button or first if empty
 ++ All instruments can be tapped
 ++ FWD will increase track sequence position (until end)
 ++ BACK will decrease track sequence position (until start)
 ++ TEMPO will show tempo
 + playing
 ++ If CYCLE/GUIDE is turned on, if track sequence will be repeated
 ++ TEMPO will show tempo
 */

export class MachineContext {
    readonly shiftButton: HTMLButtonElement
    readonly trackIndexButtons: HTMLButtonElement[]
    readonly patternGroupButtons: HTMLButtonElement[]

    readonly trackIndex: ObservableValueImpl<number> = new ObservableValueImpl<number>(0)

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
    constructor(readonly context: MachineContext) {
        this.context.trackIndexButtons.forEach((button: HTMLButtonElement, index: number) => {
            const isActive = index === this.context.trackIndex.get()
            button.classList.toggle('active', isActive)
        })
    }
}

export class MainButtonsContext {
    readonly selectedInstruments: ObservableValueImpl<Instrument> = new ObservableValueImpl<Instrument>(Instrument.Bassdrum)

    private state: NonNullable<MainButtonState> = new StepModeState(this)

    constructor(readonly machine: TR909Machine,
                readonly buttons: HTMLButtonElement[]) {
        this.buttons.forEach((button: HTMLButtonElement, index: number) => {
            button.setAttribute('data-index', `${index}`)
            button.addEventListener('pointerdown', (event: PointerEvent) => {
                button.setPointerCapture(event.pointerId)
                this.state.onButtonPress(event, index)
            })
            button.addEventListener('pointerup', (event: PointerEvent) => this.state.onButtonUp(event, index))
        })
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

    switchToInstrumentSelectModeState(): void {
        this.state.terminate()
        this.state = new InstrumentSelectState(this)
    }

    switchToLastStepSelectState(): void {
        this.state.terminate()
        this.state = new LastStepSelectState(this)
    }

    map(indices: number[]): HTMLButtonElement[] {
        return indices.map(index => this.buttons[index])
    }

    forEach(fn: (value: HTMLButtonElement, index: number, array: HTMLButtonElement[]) => void): void {
        this.buttons.forEach(fn)
    }

    getByIndex(index: number): HTMLButtonElement {
        return this.buttons[index]
    }

    clear(): void {
        this.buttons.forEach(button => button.classList.remove('half', 'active'))
    }
}

interface MainButtonState extends Terminable {
    readonly context: MainButtonsContext

    onButtonPress(event: PointerEvent, index: number): void

    onButtonUp(event: PointerEvent, index: number): void
}

class TapModeState implements MainButtonState {
    private readonly multiTouches: Set<number> = new Set<number>()
    private readonly stepIndexSubscription: Terminable

    constructor(readonly context: MainButtonsContext) {
        this.stepIndexSubscription = this.context.machine.stepIndex.addObserver(index => {
            this.context.clear()
            this.context.getByIndex(index).classList.add('half')
        }, true)
    }

    onButtonPress(event: PointerEvent, index: number): void {
        const playTrigger = ButtonMapping.toPlayTrigger(index, this.multiTouches)
        const machine = this.context.machine
        machine.play(playTrigger.instrument, playTrigger.accent)
        this.multiTouches.add(index)
        if (machine.transport.isPlaying()) {
            machine.memory.current()
                .setStep(playTrigger.instrument, machine.stepIndex.get(), playTrigger.accent ? Step.Accent : Step.Active)
        }
    }

    onButtonUp(event: PointerEvent, index: number): void {
        this.multiTouches.delete(index)
    }

    terminate(): void {
        this.multiTouches.clear()
        this.stepIndexSubscription.terminate()
    }
}

class StepModeState implements MainButtonState {
    private patternStepsSubscription: Terminable = TerminableVoid
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.patternStepsSubscription.terminate()
            this.patternStepsSubscription = memory.current().addObserver(() => this.update(), true)
        }, true)
    }

    onButtonPress(event: PointerEvent, index: number): void {
        const pattern = this.context.machine.memory.current()
        const instrument = this.context.selectedInstruments.get()
        const step: Step = pattern.getStep(instrument, index)
        pattern.setStep(instrument, index, (step + 1) % 3) // cycle through states
    }

    onButtonUp(event: PointerEvent, index: number): void {
    }

    terminate(): void {
        this.patternStepsSubscription.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        const instrument = this.context.selectedInstruments.get()
        this.context.forEach((button: HTMLButtonElement, index: number) => {
            const step: Step = pattern.getStep(instrument, index)
            button.classList.toggle('half', step === Step.Active)
            button.classList.toggle('active', step === Step.Accent)
        })
    }
}

class ShuffleFlamState implements MainButtonState {
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

    onButtonPress(event: PointerEvent, index: number): void {
        const pattern = this.context.machine.memory.current()
        if (index === 0) {
            pattern.groove.set(GrooveIdentity)
        } else if (index < 7) {
            const grooveFunction = new GrooveFunction()
            const powInjective = new PowInjective()
            powInjective.exponent.set(ShuffleFlamState.GrooveExp[index])
            grooveFunction.injective.set(powInjective)
            pattern.groove.set(grooveFunction)
        } else if (index >= 8 && index < 16) {
            const flamIndex = index - 8
            pattern.flamDelay.set(FlamDelays[flamIndex])
        }
    }

    onButtonUp(event: PointerEvent, index: number): void {
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
            this.context.getByIndex(0).classList.add('active')
        } else if (groove instanceof GrooveFunction) {
            const injective = groove.injective.get()
            if (injective instanceof PowInjective) {
                const index = ShuffleFlamState.GrooveExp.indexOf(injective.exponent.get())
                if (index >= 0 && index < 7) {
                    this.context.getByIndex(index).classList.add('active')
                }
            }
        }
        const index = FlamDelays.indexOf(pattern.flamDelay.get())
        if (index >= 0) {
            this.context.getByIndex(index + 8).classList.add('active')
        }
    }
}

class LastStepSelectState implements MainButtonState {
    private patternLastStepSubscription: Terminable = TerminableVoid
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.patternLastStepSubscription.terminate()
            this.patternLastStepSubscription = memory.current().addObserver(() => this.update(), true)
        }, true)
    }

    onButtonPress(event: PointerEvent, index: number): void {
        const pattern = this.context.machine.memory.current()
        pattern.lastStep.set(index + 1)
    }

    onButtonUp(event: PointerEvent, index: number): void {
    }

    terminate(): void {
        this.patternLastStepSubscription.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        this.context.clear()
        this.context.getByIndex(pattern.lastStep.get() - 1).classList.add('active')
    }
}

class InstrumentSelectState implements MainButtonState {
    private readonly multiTouches: Set<number> = new Set<number>()

    private readonly update = () => {
        this.context.clear()
        this.context
            .map(ButtonMapping.instrumentToIndices(this.context.selectedInstruments.get()))
            .forEach(button => button.classList.add('active'))
    }

    private readonly subscription = this.context.selectedInstruments.addObserver(this.update, true)

    constructor(readonly context: MainButtonsContext) {
    }

    onButtonPress(event: PointerEvent, index: number): void {
        this.context.selectedInstruments.set(ButtonMapping.toPlayTrigger(index, this.multiTouches).instrument)
        this.multiTouches.add(index)
    }

    onButtonUp(event: PointerEvent, index: number): void {
        this.multiTouches.delete(index)
    }

    terminate(): void {
        this.subscription.terminate()
        this.multiTouches.clear()
    }
}

type PlayTrigger = { instrument: Instrument, accent: boolean }

class ButtonMapping {
    static toPlayTrigger(index: number, multiTouches: Set<number>): PlayTrigger {
        switch (index) {
            case 0:
                return {instrument: Instrument.Bassdrum, accent: true}
            case 1:
                return {instrument: Instrument.Bassdrum, accent: false}
            case 2:
                return {instrument: Instrument.Snaredrum, accent: true}
            case 3:
                return {instrument: Instrument.Snaredrum, accent: false}
            case 4:
                return {instrument: Instrument.TomLow, accent: true}
            case 5:
                return {instrument: Instrument.TomLow, accent: false}
            case 6:
                return {instrument: Instrument.TomMid, accent: true}
            case 7:
                return {instrument: Instrument.TomMid, accent: false}
            case 8:
                return {instrument: Instrument.TomHi, accent: true}
            case 9:
                return {instrument: Instrument.TomHi, accent: false}
            case 10:
                return {instrument: Instrument.Rim, accent: false}
            case 11:
                return {instrument: Instrument.Clap, accent: false}
            case 12:
                if (multiTouches.has(13)) {
                    return {instrument: Instrument.HihatOpened, accent: false}
                } else {
                    return {instrument: Instrument.HihatClosed, accent: true}
                }
            case 13:
                if (multiTouches.has(12)) {
                    return {instrument: Instrument.HihatOpened, accent: false}
                } else {
                    return {instrument: Instrument.HihatClosed, accent: false}
                }
            case 14:
                return {instrument: Instrument.Crash, accent: true}
            case 15:
                return {instrument: Instrument.Ride, accent: true}
            case 16:
                return {instrument: Instrument.TotalAccent, accent: true}
        }
    }

    static instrumentToIndices(instrument: Instrument): number[] {
        switch (instrument) {
            case Instrument.Bassdrum:
                return [0]
            case Instrument.Snaredrum:
                return [2]
            case Instrument.TomLow:
                return [4]
            case Instrument.TomMid:
                return [6]
            case Instrument.TomHi:
                return [8]
            case Instrument.Rim:
                return [10]
            case Instrument.Clap:
                return [11]
            case Instrument.HihatClosed:
                return [12]
            case Instrument.HihatOpened:
                return [12, 13]
            case Instrument.Crash:
                return [14]
            case Instrument.Ride:
                return [15]
            case Instrument.TotalAccent:
                return [16]
        }
    }
}