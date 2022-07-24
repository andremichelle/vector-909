import {Events, Terminable} from "../lib/common.js"

abstract class Key {
    protected constructor(protected readonly element: HTMLButtonElement) {
    }

    bind(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): Terminable {
        return Events.bindEventListener(this.element, type, listener, options)
    }

    setPointerCapture(pointerId: number): void {
        this.element.setPointerCapture(pointerId)
    }
}

export enum MainKeyIndex {
    Step1, Step2, Step3, Step4,
    Step5, Step6, Step7, Step8,
    Step9, Step10, Step11, Step12,
    Step13, Step14, Step15, Step16,
    TotalAccent
}

export enum MainKeyState {
    Off, Flash, Blink, On
}

export class MainKey extends Key {
    private state: MainKeyState = MainKeyState.Off

    constructor(element: HTMLButtonElement) {
        super(element)
    }

    setState(state: MainKeyState): void {
        if (this.state === state) {
            return
        }
        this.state = state
        this.applyState()
    }

    applyState(): void {
        this.element.classList.toggle('active', this.state === MainKeyState.On)
        this.element.classList.toggle('blink-active', this.state === MainKeyState.Blink)
        this.element.classList.toggle('flash-active', this.state === MainKeyState.Flash)
    }

    flash(): void {
        this.element.classList.toggle('active', false)
        this.element.classList.toggle('flash-active', true)
    }
}

export enum FunctionKeyIndex {
    Track1, Track2, Track3, Track4,
    Pattern1, Pattern2, Pattern3, EmptyExtInst,
    TempoStep, BackTap, ForwardBankI, AvailableMeasuresBankII,
    CycleGuideLastMeasure, TapeSyncTempoMode, LastStep, Scale,
    ShuffleFlam, Clear, InstrumentSelect
}

export enum FunctionKeyState {
    Off, Blink, On
}

export class FunctionKey extends Key {
    private state: FunctionKeyState = FunctionKeyState.Off

    constructor(element: HTMLButtonElement) {
        super(element)
    }

    setState(state: FunctionKeyState): void {
        if (this.state === state) {
            return
        }
        this.state = state
        this.applyState()
    }

    private applyState() {
        this.element.classList.toggle('active', this.state === FunctionKeyState.On)
        this.element.classList.toggle('blink', this.state === FunctionKeyState.Blink)
    }
}