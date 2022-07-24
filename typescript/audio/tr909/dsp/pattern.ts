import {Pattern} from "../pattern.js"
import {State} from "../state.js"

export interface PatternProvider {
    readonly state: State

    pattern(): Pattern | null

    onPatterComplete(): void
}

export class UserPatternSelect implements PatternProvider {
    private current: Pattern
    private waiting: Pattern = null

    constructor(readonly state: State, private readonly isMoving: () => boolean) {
        this.current = this.state.activePattern()
        this.state.patternIndicesChangeNotification.addObserver((pattern: Pattern) => {
            if (this.isMoving()) {
                this.waiting = pattern
            } else {
                this.current = pattern
                this.waiting = null
            }
        })
    }

    pattern(): Pattern | null {
        return this.current
    }

    onPatterComplete(): void {
        if (this.waiting === null) return
        this.current = this.waiting
        this.waiting = null
    }
}

export class TrackPatternPlay implements PatternProvider {
    private index: number = 0
    private current: Pattern = null

    constructor(readonly state: State) {
        const sequence = this.state.activeTrack()
        const patterns = this.state.activeBank().patterns
        this.current = sequence.length === 0 ? null : patterns[sequence[this.index]]
    }

    pattern(): Pattern | null {
        return this.current
    }

    onPatterComplete(): void {
        const track: number[] = this.state.activeTrack()
        if (++this.index >= track.length) {
            if (this.state.cycleMode.get()) {
                this.current = this.state.activeBank().patterns[track[this.index = 0]]
            } else {
                this.current = null
            }
        } else {
            this.current = this.state.activeBank().patterns[track[this.index]]
        }
    }
}