import {Events, Terminable} from "../lib/common.js"

export enum MainKeyIndex {
    Step1, Step2, Step3, Step4,
    Step5, Step6, Step7, Step8,
    Step9, Step10, Step11, Step12,
    Step13, Step14, Step15, Step16,
    TotalAccent
}

export enum MainKeyState {
    Off, Flash, On
}

export class MainKey {
    private state: MainKeyState = MainKeyState.Off

    constructor(private readonly element: HTMLButtonElement, readonly keyIndex: MainKeyIndex) {
    }

    bind(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): Terminable {
        return Events.bindEventListener(this.element, type, listener, options)
    }

    setPointerCapture(pointerId: number): void {
        this.element.setPointerCapture(pointerId)
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
        this.element.classList.toggle('flash-active', this.state === MainKeyState.Flash)
    }

    flash(): void {
        this.element.classList.toggle('active', false)
        this.element.classList.toggle('flash-active', true)
    }
}

export enum FunctionKeyId {
    TrackPlay1, TrackPlay2, TrackPlay3, TrackPlay4,
    PatternPlay1, PatternPlay2, PatternPlay3, Empty,
    Tempo, Back, Forward, AvailableMeasures, CycleGuide, TapeSync
}

export enum FunctionKeyShiftId {
    TrackWrite1, TrackWrite2, TrackWrite3, TrackWrite4,
    PatternWrite1, PatternWrite2, PatternWrite3, ExtInst,
    Step, Tap, BankI, BankII, LastMeasure, TempoMode
}

export class FunctionKey {
    constructor(private readonly element: HTMLButtonElement, readonly keyId: FunctionKeyId, readonly keyShiftId: FunctionKeyShiftId) {
    }
}