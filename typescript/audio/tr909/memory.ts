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

export enum PatternGroupIndex {I, II, III}

export enum PatternIndex {
    Pattern1, Pattern2, Pattern3, Pattern4,
    Pattern5, Pattern6, Pattern7, Pattern8,
    Pattern9, Pattern10, Pattern11, Pattern12,
    Pattern13, Pattern14, Pattern15, Pattern16,
}

export type PatternLocation = { bankGroupIndex: BankGroupIndex, patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex }

export class Memory implements Terminable {
    private static NUM_BANKS = 2
    private static NUM_PATTERN_GROUPS = 3
    private static NUM_PATTERNS = 16
    private static PATTERNS_TOTAL_COUNT = Memory.NUM_BANKS * Memory.NUM_PATTERNS * Memory.NUM_PATTERN_GROUPS

    private readonly terminator = new Terminator()

    readonly tracks: number[][] = ArrayUtils.fill(4, () => [])

    readonly patterns: Pattern[] = ArrayUtils.fill(Memory.PATTERNS_TOTAL_COUNT, (index: number) => new Pattern(index))
    readonly patternChangeNotification: ObservableImpl<Pattern> = new ObservableImpl<Pattern>()

    readonly bankGroupIndex: ObservableValue<BankGroupIndex> = new ObservableValueImpl<BankGroupIndex>(0)
    readonly patternGroupIndex: ObservableValue<PatternGroupIndex> = new ObservableValueImpl<PatternGroupIndex>(0)
    readonly patternIndex: ObservableValue<PatternIndex> = new ObservableValueImpl<PatternIndex>(0)

    constructor() {
        this.terminator.with(this.bankGroupIndex.addObserver(() => this.patternChangeNotification.notify(this.pattern()), false))
        this.terminator.with(this.patternGroupIndex.addObserver(() => this.patternChangeNotification.notify(this.pattern()), false))
        this.terminator.with(this.patternIndex.addObserver(() => this.patternChangeNotification.notify(this.pattern()), false))

        // TODO > Test Data < REMOVE WHEN DONE TESTING
        this.patternOf(BankGroupIndex.II, PatternGroupIndex.III, 6).testA()
        this.patternOf(0, 0, 1).testB()
        this.tracks[0].push(this.indexOf(BankGroupIndex.II, PatternGroupIndex.III, 6), 1, 0, 1)
    }

    pattern(): Pattern {
        return this.patterns[this.indexOf(this.bankGroupIndex.get(), this.patternGroupIndex.get(), this.patternIndex.get())]
    }

    indexOf(bankGroupIndex: BankGroupIndex, patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): number {
        return (bankGroupIndex * Memory.NUM_PATTERN_GROUPS + patternGroupIndex) * Memory.NUM_PATTERNS + patternIndex
    }

    patternOf(bankGroupIndex: BankGroupIndex, patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex): Pattern {
        return this.patterns[(bankGroupIndex * Memory.NUM_PATTERN_GROUPS + patternGroupIndex) * Memory.NUM_PATTERNS + patternIndex]
    }

    toLocation(index: number): PatternLocation {
        return {
            bankGroupIndex: Math.floor(Math.floor(index / Memory.NUM_PATTERNS) / Memory.NUM_PATTERN_GROUPS),
            patternGroupIndex: Math.floor(index / Memory.NUM_PATTERNS) % Memory.NUM_PATTERN_GROUPS,
            patternIndex: index % Memory.NUM_PATTERNS
        }
    }

    terminate(): void {
        this.terminator.terminate()
    }
}