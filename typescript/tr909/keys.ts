import {Events, Terminable} from "../lib/common.js"

export enum KeyState {
    Off, Flash, Blink, On
}

export class Key {
    private state: KeyState = KeyState.Off

    constructor(private readonly element: HTMLButtonElement) {
    }

    bind(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): Terminable {
        return Events.bindEventListener(this.element, type, listener, options)
    }

    setPointerCapture(pointerId: number): void {
        this.element.setPointerCapture(pointerId)
    }

    setState(state: KeyState): void {
        if (this.state === state) {
            return
        }
        this.state = state
        this.applyState()
    }

    applyState(): void {
        this.element.classList.toggle('active', this.state === KeyState.On)
        this.element.classList.toggle('blink-active', this.state === KeyState.Blink)
        this.element.classList.toggle('flash-active', this.state === KeyState.Flash)
    }

    flash(): void {
        this.element.classList.toggle('active', this.state !== KeyState.On)
        this.element.classList.toggle('blink-active', this.state !== KeyState.Blink)
        this.element.classList.toggle('flash-active', this.state !== KeyState.Flash)
    }
}

export enum MainKeyIndex {
    Step1, Step2, Step3, Step4,
    Step5, Step6, Step7, Step8,
    Step9, Step10, Step11, Step12,
    Step13, Step14, Step15, Step16,
    TotalAccent
}

export enum FunctionKeyIndex {
    Track1, Track2, Track3, Track4,
    PatternGroup1, PatternGroup2, PatternGroup3, EmptyExtInst,
    TempoStep, BackTap, ForwardBankI, AvailableMeasuresBankII,
    CycleGuideLastMeasure, TapeSyncTempoMode, LastStep, Scale,
    ShuffleFlam, Clear, InstrumentSelect
}

export const BankGroupKeyIndices = [FunctionKeyIndex.ForwardBankI, FunctionKeyIndex.AvailableMeasuresBankII]
export const TrackKeyIndices = [FunctionKeyIndex.Track1, FunctionKeyIndex.Track2, FunctionKeyIndex.Track3, FunctionKeyIndex.Track4]
export const PatternGroupKeyIndices = [FunctionKeyIndex.PatternGroup1, FunctionKeyIndex.PatternGroup2, FunctionKeyIndex.PatternGroup3]