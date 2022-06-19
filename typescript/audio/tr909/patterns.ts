import {
    ArrayUtils,
    Observable,
    ObservableImpl,
    Observer,
    Parameter,
    PrintMapping,
    Terminable
} from "../../lib/common.js"
import {LinearInteger} from "../../lib/mapping.js"

export enum Instrument {
    Bassdrum = 0,
    Snaredrum = 1,
    TomLow = 2,
    TomMid = 3,
    TomHigh = 4,
    Rim = 5,
    Clap = 6,
    HihatClosed = 7,
    HihatOpen = 8,
    Crash = 9,
    Ride = 10,
    count
}

export enum Step {
    None = 0, Active = 1, Accent = 2
}

export class Pattern implements Observable<void> {
    private readonly steps: Step[][] = ArrayUtils.fill(Instrument.count, () => ArrayUtils.fill(16, () => Step.None))
    private readonly observable: ObservableImpl<void> = new ObservableImpl<void>()

    constructor() {
    }

    setStep(instrument: Instrument, index: number, step: Step): void {
        if (this.steps[instrument][index] === step) {
            return
        }
        this.steps[instrument][index] = step
        this.observable.notify()
    }

    getStep(instrument: Instrument, index: number): Step {
        return this.steps[instrument][index]
    }

    serialize(): Step[][] {
        return this.steps
    }

    deserialize(format: Step[][]): void {
        format.forEach((steps: Step[], instruments: number) =>
            steps.forEach((step: Step, stepIndex: number) =>
                this.steps[instruments][stepIndex] = step))
        this.observable.notify()
    }

    addObserver(observer: Observer<void>, notify: boolean): Terminable {
        if (notify) observer()
        return this.observable.addObserver(observer)
    }

    removeObserver(observer: Observer<void>): boolean {
        return this.observable.removeObserver(observer)
    }

    terminate(): void {
        this.observable.terminate()
    }
}

export class PatternMemory {
    readonly patterns: Pattern[] = ArrayUtils.fill(8, () => new Pattern())
    readonly index: Parameter<number> = new Parameter<number>(new LinearInteger(0, 8), PrintMapping.INTEGER, 0)

    pattern(): Pattern {
        return this.patterns[this.index.get()]
    }
}