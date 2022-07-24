import {Memory} from "../memory.js"
import {Pattern} from "../pattern.js"

export interface PatternProvider {
    readonly memory: Memory

    pattern(): Pattern | null

    onPatterComplete(): void
}

export class UserPatternSelect implements PatternProvider {
    private current: Pattern
    private waiting: Pattern = null

    constructor(readonly memory: Memory, private readonly isMoving: () => boolean) {
        this.current = this.memory.pattern()
        this.memory.userPatternChangeNotification.addObserver((pattern: Pattern) => {
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

    constructor(readonly memory: Memory) {
        const sequence = this.memory.activeTrack()
        const patterns = this.memory.activeBank().patterns
        this.current = sequence.length === 0 ? null : patterns[sequence[this.index]]
    }

    pattern(): Pattern | null {
        return this.current
    }

    onPatterComplete(): void {
        const track: number[] = this.memory.activeTrack()
        if (++this.index >= track.length) {
            if (this.memory.cycleMode.get()) {
                this.current = this.memory.activeBank().patterns[track[this.index = 0]]
            } else {
                this.current = null
            }
        } else {
            this.current = this.memory.activeBank().patterns[track[this.index]]
        }
    }
}