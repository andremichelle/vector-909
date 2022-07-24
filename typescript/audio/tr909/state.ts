import {
    ObservableImpl,
    ObservableValue,
    ObservableValueImpl,
    Serializer,
    Terminable,
    Terminator
} from "../../lib/common.js"
import {
    BankGroupIndex,
    Memory,
    MemoryBank,
    PatternGroupIndex,
    PatternIndex,
    PatternLocation,
    TrackIndex
} from "./memory.js"
import {Pattern} from "./pattern.js"

export interface StateFormat {
    bankGroupIndex: BankGroupIndex
    patternGroupIndex: PatternGroupIndex
    patternIndex: PatternIndex
    trackIndex: TrackIndex
    cycleMode: boolean
}

export class State implements Serializer<StateFormat>, Terminable {
    private readonly terminator: Terminator = new Terminator()

    readonly bankGroupIndex: ObservableValue<BankGroupIndex> = new ObservableValueImpl<BankGroupIndex>(BankGroupIndex.I)
    readonly patternGroupIndex: ObservableValue<PatternGroupIndex> = new ObservableValueImpl<PatternGroupIndex>(PatternGroupIndex.I)
    readonly patternIndex: ObservableValue<PatternIndex> = new ObservableValueImpl<PatternIndex>(PatternIndex.Pattern1)
    readonly trackIndex: ObservableValue<TrackIndex> = new ObservableValueImpl<TrackIndex>(TrackIndex.I)
    readonly cycleMode: ObservableValue<boolean> = new ObservableValueImpl<boolean>(false)

    readonly changeNotification: ObservableImpl<State> = new ObservableImpl<State>()
    readonly patternIndicesChangeNotification: ObservableImpl<Pattern> = new ObservableImpl<Pattern>()

    constructor(readonly memory: Memory) {
        this.terminator.with(this.bankGroupIndex.addObserver(this.onPatternIndicesChange, false))
        this.terminator.with(this.patternGroupIndex.addObserver(this.onPatternIndicesChange, false))
        this.terminator.with(this.patternIndex.addObserver(this.onPatternIndicesChange, false))

        this.terminator.with(this.bankGroupIndex.addObserver(this.onChange, false))
        this.terminator.with(this.patternGroupIndex.addObserver(this.onChange, false))
        this.terminator.with(this.patternIndex.addObserver(this.onChange, false))
        this.terminator.with(this.trackIndex.addObserver(this.onChange, false))
        this.terminator.with(this.cycleMode.addObserver(this.onChange, false))
    }

    activePattern(): Pattern {
        return this.activeBank().patternBy(this.patternGroupIndex.get(), this.patternIndex.get())
    }

    activeBank(): MemoryBank {
        return this.memory[this.bankGroupIndex.get()]
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

    deserialize(format: StateFormat): Serializer<StateFormat> {
        this.bankGroupIndex.set(format.bankGroupIndex)
        this.patternGroupIndex.set(format.patternGroupIndex)
        this.patternIndex.set(format.patternIndex)
        this.trackIndex.set(format.trackIndex)
        this.cycleMode.set(format.cycleMode)
        return this
    }

    serialize(): StateFormat {
        return {
            bankGroupIndex: this.bankGroupIndex.get(),
            patternGroupIndex: this.patternGroupIndex.get(),
            patternIndex: this.patternIndex.get(),
            trackIndex: this.trackIndex.get(),
            cycleMode: this.cycleMode.get()
        }
    }

    terminate(): void {
        this.terminator.terminate()
    }

    private readonly onChange = () => this.changeNotification.notify(this)
    private readonly onPatternIndicesChange = () => this.patternIndicesChangeNotification.notify(this.activePattern())
}