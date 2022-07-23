import {
    ArrayUtils,
    Observable,
    ObservableImpl,
    ObservableValue,
    ObservableValueImpl,
    Observer,
    Terminable,
    TerminableVoid,
    Terminator
} from "../../lib/common.js"
import {Groove, GrooveFormat, GrooveIdentity, Grooves} from "../grooves.js"

/**
 * 'Extra' is either 'Flam' for Bassdrum, Snaredrum and Toms or 'Open' for Hihat.
 * Rim shot, hand clap and cymbals are supposed only to be 'Full' in the original machine.
 */
export enum Step {
    None = 0, Weak = 1, Full = 2, Extra
}

export enum ChannelIndex {
    Bassdrum, Snaredrum,
    TomLow, TomMid, TomHi,
    Rim, Clap,
    Hihat, Crash, Ride,
    End
}

export enum InstrumentIndex {
    Bassdrum = 0, Snaredrum = 1,
    TomLow = 2, TomMid = 3, TomHi = 4,
    Rim = 5, Clap = 6,
    HihatClosed = 7, HihatOpened = 8,
    Crash = 9, Ride = 10
}

export class Track {
    readonly patternSequence: number[] = []

    constructor() {
    }
}

export type BankGroupIndex = 0 | 1
export type PatternGroupIndex = 0 | 1 | 2
export type PatternIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export class Memory implements Terminable {
    private static NUM_BANKS = 2
    private static NUM_PATTERN_GROUPS = 3
    private static NUM_PATTERNS = 16

    private readonly terminator = new Terminator()

    readonly tracks: Track[] = ArrayUtils.fill(4, () => new Track())

    readonly patterns: Pattern[] = ArrayUtils.fill(16 * Memory.NUM_PATTERN_GROUPS * Memory.NUM_BANKS, (index: number) => new Pattern(index))
    readonly patternChangeNotification: ObservableImpl<Pattern> = new ObservableImpl<Pattern>()

    readonly bankGroupIndex: ObservableValue<BankGroupIndex> = new ObservableValueImpl<BankGroupIndex>(0)
    readonly patternGroupIndex: ObservableValue<PatternGroupIndex> = new ObservableValueImpl<PatternGroupIndex>(0)
    readonly patternIndex: ObservableValue<PatternIndex> = new ObservableValueImpl<PatternIndex>(0)

    constructor() {
        // TODO observe and update on worklet
        this.terminator.with(this.bankGroupIndex.addObserver(() => this.patternChangeNotification.notify(this.pattern()), false))
        this.terminator.with(this.patternGroupIndex.addObserver(() => this.patternChangeNotification.notify(this.pattern()), false))
        this.terminator.with(this.patternIndex.addObserver(() => this.patternChangeNotification.notify(this.pattern()), false))
    }

    pattern(): Pattern {
        return this.patternOf(this.bankGroupIndex.get(), this.patternGroupIndex.get(), this.patternIndex.get())
    }

    patternOf(bankGroupIndex: BankGroupIndex, patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): Pattern {
        return this.patterns[(bankGroupIndex * Memory.NUM_PATTERN_GROUPS + patternGroupIndex) * Memory.NUM_PATTERNS + patternIndex]
    }

    terminate(): void {
        this.terminator.terminate()
    }
}

export interface PatternFormat {
    steps: Step[][]
    totalAccents: boolean[]
    scale: number
    flamDelay: number
    lastStep: number
    groove: GrooveFormat
}

export class Pattern implements Observable<void> {
    // http://www.e-licktronic.com/forum/viewtopic.php?f=25&t=1430
    static readonly FlamDelays = ArrayUtils.fill(8, index => 10 + index * 4)

    readonly scale = new ObservableValueImpl<Scale>(Scale.D16)
    readonly flamDelay = new ObservableValueImpl<number>(Pattern.FlamDelays[0])
    readonly lastStep = new ObservableValueImpl<number>(16)
    readonly groove = new ObservableValueImpl<Groove>(GrooveIdentity)

    private readonly listener: () => void = () => this.observable.notify()
    private readonly observable = new ObservableImpl<void>()
    private readonly steps: Step[][] = ArrayUtils.fill(ChannelIndex.End, () => ArrayUtils.fill(16, () => Step.None))
    private readonly totalAccents: boolean[] = ArrayUtils.fill(16, () => false)
    private readonly scaleSubscription = this.scale.addObserver(this.listener, false)
    private readonly flamDelaySubscription = this.flamDelay.addObserver(this.listener, false)
    private readonly lastStepSubscription = this.lastStep.addObserver(this.listener, false)
    private grooveSubscription = TerminableVoid
    private readonly grooveFieldSubscription = this.groove.addObserver((groove: Groove) => {
        this.grooveSubscription.terminate()
        this.grooveSubscription = groove.addObserver(this.listener, true)
    }, false)

    constructor(readonly index: number) {
    }

    testA() {
        this.observable.mute()
        for (let i = 0; i < 16; i++) {
            if ((i + 2) % 4 !== 0) {
                this.setStep(ChannelIndex.Hihat, i, Step.Full)
            } else {
                this.setStep(ChannelIndex.Hihat, i, Step.Extra)
            }
            if (i % 4 === 0) {
                this.setStep(ChannelIndex.Bassdrum, i, Step.Full)
            }
        }
        this.setStep(ChannelIndex.Bassdrum, 15, Step.Extra)
        this.setStep(ChannelIndex.Clap, 4, Step.Full)
        this.setStep(ChannelIndex.Clap, 12, Step.Full)
        this.observable.unmute()
        this.observable.notify()
    }

    testB(): void {
        this.observable.mute()
        for (let i = 0; i < 16; i++) {
            if ((i + 2) % 4 !== 0) {
                this.setStep(ChannelIndex.Hihat, i, Step.Full)
            } else {
                this.setStep(ChannelIndex.Hihat, i, Step.Extra)
            }
        }
        this.setStep(ChannelIndex.Rim, 4, Step.Full)
        this.setStep(ChannelIndex.Rim, 12, Step.Full)
        this.observable.unmute()
        this.observable.notify()
    }

    setStep(channelIndex: ChannelIndex, stepIndex: number, step: Step): void {
        console.assert(0 <= channelIndex && channelIndex < ChannelIndex.End)
        console.assert(0 <= stepIndex && stepIndex < 16)
        if (this.steps[channelIndex][stepIndex] === step) {
            return
        }
        this.steps[channelIndex][stepIndex] = step
        this.observable.notify()
    }

    getStep(channelIndex: ChannelIndex, stepIndex: number): Step {
        console.assert(0 <= channelIndex && channelIndex < ChannelIndex.End)
        console.assert(0 <= stepIndex && stepIndex < 16)
        return this.steps[channelIndex][stepIndex]
    }

    setTotalAccent(stepIndex: number, active: boolean): void {
        console.assert(0 <= stepIndex && stepIndex < 16)
        this.totalAccents[stepIndex] = active
        this.observable.notify()
    }

    isTotalAccent(stepIndex: number): boolean {
        console.assert(0 <= stepIndex && stepIndex < 16)
        return this.totalAccents[stepIndex]
    }

    serialize(): PatternFormat {
        return {
            steps: this.steps,
            totalAccents: this.totalAccents,
            scale: this.scale.get().index(),
            flamDelay: this.flamDelay.get(),
            lastStep: this.lastStep.get(),
            groove: this.groove.get().serialize()
        }
    }

    deserialize(format: PatternFormat): void {
        this.observable.mute()
        format.steps.forEach((steps: Step[], channel: number) =>
            steps.forEach((step: Step, stepIndex: number) =>
                this.steps[channel][stepIndex] = step))
        this.totalAccents.splice(0, 16, ...format.totalAccents)
        this.lastStep.set(format.lastStep)
        this.scale.set(Scale.getByIndex(format.scale))
        this.flamDelay.set(format.flamDelay)
        this.groove.set(Grooves.deserialize(format.groove))
        this.observable.unmute()
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
        this.scaleSubscription.terminate()
        this.flamDelaySubscription.terminate()
        this.lastStepSubscription.terminate()
        this.grooveSubscription.terminate()
        this.grooveFieldSubscription.terminate()
    }
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
        return Scale.getByIndex((this.index() + Scale.Available.length - 1) % Scale.Available.length)
    }

    index(): number {
        return Scale.Available.indexOf(this)
    }
}