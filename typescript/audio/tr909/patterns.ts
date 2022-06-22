import {
    ArrayUtils,
    Observable,
    ObservableImpl,
    ObservableValue,
    ObservableValueImpl,
    Observer,
    Terminable,
    TerminableVoid
} from "../../lib/common.js"
import {Groove, GrooveFormat, GrooveIdentity, Grooves} from "../grooves.js"

export enum Instrument {
    Bassdrum = 0,
    Snaredrum = 1,
    TomLow = 2,
    TomMid = 3,
    TomHi = 4,
    Rim = 5,
    Clap = 6,
    HihatClosed = 7,
    HihatOpened = 8,
    Crash = 9,
    Ride = 10,
    TotalAccent = 11,
    count
}

export enum Step {
    None = 0, Active = 1, Accent = 2
}

export class Scale {
    static N6D16 = new Scale(3, 16)
    static N3D8 = new Scale(3, 32)
    static D32 = new Scale(1, 32)
    static D16 = new Scale(1, 16)

    static getByIndex(index: number): Scale {
        console.assert(index >= 0 && index < 4)
        return Scale.Available[index]
    }

    private static Available = [Scale.N6D16, Scale.N3D8, Scale.D32, Scale.D16]

    private constructor(readonly nominator: number, readonly denominator: number) {
    }

    value(): number {
        return this.nominator / this.denominator
    }

    cycleNext(): Scale {
        return Scale.getByIndex((this.index() + 1) % Scale.Available.length)
    }

    index(): number {
        return Scale.Available.indexOf(this)
    }
}

export interface PatternFormat {
    steps: Step[][]
    scale: number
    lastStep: number
    groove: GrooveFormat
}

export class Pattern implements Observable<void> {
    readonly scale: ObservableValue<Scale> = new ObservableValueImpl<Scale>(Scale.D16)
    readonly lastStep: ObservableValue<number> = new ObservableValueImpl<number>(16)
    readonly groove: ObservableValue<Groove> = new ObservableValueImpl<Groove>(GrooveIdentity)

    private readonly listener: () => void = () => this.observable.notify()
    private readonly observable: ObservableImpl<void> = new ObservableImpl<void>()
    private readonly steps: Step[][] = ArrayUtils.fill(Instrument.count, () => ArrayUtils.fill(16, () => Step.None))
    private readonly scaleSubscription = this.scale.addObserver(this.listener, false)
    private readonly lastStepSubscription = this.lastStep.addObserver(this.listener, false)
    private grooveSubscription = TerminableVoid
    private readonly grooveFieldSubscription = this.groove.addObserver((groove: Groove) => {
        this.grooveSubscription.terminate()
        this.grooveSubscription = groove.addObserver(this.listener, true)
    }, false)

    constructor() {
        for (let i = 0; i < 16; i++) {
            if ((i + 2) % 4 !== 0) {
                this.setStep(Instrument.HihatClosed, i, Step.Accent)
            } else {
                this.setStep(Instrument.HihatOpened, i, Step.Accent)
            }
        }
    }

    setStep(instrument: Instrument, index: number, step: Step): void {
        if (instrument === Instrument.TotalAccent && step === Step.Active) {
            step = Step.Accent
        }
        if (this.steps[instrument][index] === step) {
            return
        }
        this.steps[instrument][index] = step
        this.observable.notify()
    }

    getStep(instrument: Instrument, index: number): Step {
        return this.steps[instrument][index]
    }

    serialize(): PatternFormat {
        return {
            steps: this.steps,
            scale: this.scale.get().index(),
            lastStep: this.lastStep.get(),
            groove: this.groove.get().serialize()
        }
    }

    deserialize(format: PatternFormat): void {
        format.steps.forEach((steps: Step[], instruments: number) =>
            steps.forEach((step: Step, stepIndex: number) =>
                this.steps[instruments][stepIndex] = step))

        // FIXME Both will trigger an update, hence sending update to worklet
        this.lastStep.set(format.lastStep)
        this.scale.set(Scale.getByIndex(format.scale))
        this.groove.set(Grooves.deserialize(format.groove))
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
        this.scaleSubscription.terminate()
        this.lastStepSubscription.terminate()
        this.grooveSubscription.terminate()
        this.grooveFieldSubscription.terminate()
    }
}

export class PatternMemory {
    readonly patterns: Pattern[] = ArrayUtils.fill(96, () => new Pattern())
    readonly patternIndex: ObservableValue<number> = new ObservableValueImpl<number>(0)

    current(): Pattern {
        return this.patterns[this.patternIndex.get()]
    }
}