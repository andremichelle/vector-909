import {Instrument, Step} from "../audio/tr909/patterns.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {ObservableValueImpl, Terminable, TerminableVoid} from "../lib/common.js"

export class MainButtonsContext {
    readonly selectedInstruments: ObservableValueImpl<Instrument> = new ObservableValueImpl<Instrument>(Instrument.Bassdrum)

    private state: MainButtonState = new StepMode(this)

    constructor(readonly machine: TR909Machine,
                readonly buttons: HTMLButtonElement[]) {
        this.buttons.forEach((button: HTMLButtonElement, index: number) => {
            button.setAttribute('data-index', `${index}`)
            button.addEventListener('pointerdown', (event: PointerEvent) => this.state.onButtonPress(event, index))
            button.addEventListener('pointerup', (event: PointerEvent) => this.state.onButtonUp(event, index))
        })
    }

    switchToStepMode(): void {
        this.state.terminate()
        this.state = new StepMode(this)
    }

    switchToInstrumentSelectMode(): void {
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

class PlayState implements MainButtonState {
    private readonly multiTouches: Set<number> = new Set<number>()

    constructor(readonly context: MainButtonsContext) {
        this.context.clear()
    }

    onButtonPress(event: PointerEvent, index: number): void {
        const playTrigger = Mappings.toPlayTrigger(index, this.multiTouches)
        this.context.machine.play(playTrigger.instrument, playTrigger.accent)
        this.multiTouches.add(index)
    }

    onButtonUp(event: PointerEvent, index: number): void {
        this.multiTouches.delete(index)
    }

    terminate(): void {
        this.multiTouches.clear()
    }
}

class StepMode implements MainButtonState {
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
            .map(Mappings.instrumentToIndices(this.context.selectedInstruments.get()))
            .forEach(button => button.classList.add('active'))
    }

    private readonly subscription = this.context.selectedInstruments.addObserver(this.update, true)

    constructor(readonly context: MainButtonsContext) {
    }

    onButtonPress(event: PointerEvent, index: number): void {
        this.context.selectedInstruments.set(Mappings.toPlayTrigger(index, this.multiTouches).instrument)
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

class Mappings {
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