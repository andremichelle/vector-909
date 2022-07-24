import {
    ArrayUtils,
    ObservableImpl,
    ObservableValue,
    ObservableValueImpl,
    Terminable,
    Terminator
} from "../../lib/common.js"
import {Pattern} from "./pattern.js"

export enum InstrumentIndex {
    Bassdrum = 0, Snaredrum = 1,
    TomLow = 2, TomMid = 3, TomHi = 4,
    Rim = 5, Clap = 6,
    HihatClosed = 7, HihatOpened = 8,
    Crash = 9, Ride = 10
}

export enum BankGroupIndex {I, II}

export enum TrackIndex {I, II, III, IV} // times 2 for each bank

export enum PatternGroupIndex {I, II, III} // times 2 for each bank

export enum PatternIndex {
    Pattern1, Pattern2, Pattern3, Pattern4,
    Pattern5, Pattern6, Pattern7, Pattern8,
    Pattern9, Pattern10, Pattern11, Pattern12,
    Pattern13, Pattern14, Pattern15, Pattern16,
}

export type PatternLocation = { patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex }

export type Track = number[]

export class Bank {
    static readonly NUM_PATTERN_GROUPS = 3
    static readonly NUM_PATTERNS = 16
    static readonly PATTERNS_COUNT = Bank.NUM_PATTERNS * Bank.NUM_PATTERN_GROUPS

    readonly tracks: number[][] = ArrayUtils.fill(4, () => [])
    readonly patterns: Pattern[] = ArrayUtils.fill(Bank.PATTERNS_COUNT, () => new Pattern())

    indexOf(patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): number {
        return patternGroupIndex * Bank.NUM_PATTERNS + patternIndex
    }

    patternBy(patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): Pattern {
        return this.patterns[patternGroupIndex * Bank.NUM_PATTERNS + patternIndex]
    }

    toLocation(index: number): PatternLocation {
        return {
            patternGroupIndex: Math.floor(index / Bank.NUM_PATTERNS) % Bank.NUM_PATTERN_GROUPS,
            patternIndex: index % Bank.NUM_PATTERNS
        }
    }
}

export class Memory implements Terminable {
    private readonly terminator = new Terminator()

    readonly userPatternChangeNotification: ObservableImpl<Pattern> = new ObservableImpl<Pattern>() // TODO Move to worklet

    readonly bank: Bank[] = ArrayUtils.fill(2, () => new Bank())
    readonly bankGroupIndex: ObservableValue<BankGroupIndex> = new ObservableValueImpl<BankGroupIndex>(BankGroupIndex.I)
    readonly patternGroupIndex: ObservableValue<PatternGroupIndex> = new ObservableValueImpl<PatternGroupIndex>(PatternGroupIndex.I)
    readonly patternIndex: ObservableValue<PatternIndex> = new ObservableValueImpl<PatternIndex>(PatternIndex.Pattern1)
    readonly trackIndex: ObservableValue<TrackIndex> = new ObservableValueImpl<TrackIndex>(TrackIndex.I)
    readonly cycleMode: ObservableValue<boolean> = new ObservableValueImpl<boolean>(false)

    constructor() {
        this.terminator.with(this.bankGroupIndex.addObserver(() => this.userPatternChangeNotification.notify(this.pattern()), false))
        this.terminator.with(this.patternGroupIndex.addObserver(() => this.userPatternChangeNotification.notify(this.pattern()), false))
        this.terminator.with(this.patternIndex.addObserver(() => this.userPatternChangeNotification.notify(this.pattern()), false))

        // TODO > Test Data < REMOVE WHEN DONE TESTING
        this.patternBy(PatternGroupIndex.III, 6).testA()
        this.patternBy(0, 1).testB()
        this.activeBank().tracks[0].push(this.indexOf(PatternGroupIndex.III, 6), 1, 0, 1)
    }

    pattern(): Pattern {
        return this.activeBank().patternBy(this.patternGroupIndex.get(), this.patternIndex.get())
    }

    activeBank(): Bank {
        return this.bank[this.bankGroupIndex.get()]
    }

    activeTrack(): number[] {
        return this.activeBank().tracks[this.trackIndex.get()]
    }

    indexOf(patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): number {
        return this.activeBank().indexOf(patternGroupIndex, patternIndex)
    }

    patternBy(patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): Pattern {
        return this.activeBank().patternBy(patternGroupIndex, patternIndex)
    }

    toLocation(index: number): PatternLocation {
        return this.activeBank().toLocation(index)
    }

    terminate(): void {
        this.terminator.terminate()
    }
}