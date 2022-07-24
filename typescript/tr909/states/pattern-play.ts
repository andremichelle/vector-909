import {PatternGroupIndex, PatternIndex, TrackIndex} from "../../audio/tr909/memory.js"
import {MachineContext} from "../context.js"
import {FunctionKeyIndex, KeyState, MainKeyIndex} from "../keys.js"
import {MachineState} from "../states.js"

export default class extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.context.activateRunningAnimation()
        this.context.activateBankGroupButton(this.context.machine.state.bankGroupIndex.get())
        this.with(this.context.machine.state.patternGroupIndex
            .addObserver((patternGroupIndex: PatternGroupIndex) =>
                this.context.activatePatternGroupButton(patternGroupIndex), true))
        this.context.mainKeys.byIndex(this.context.machine.state.patternIndex.get() as number).setState(KeyState.Blink)
    }

    onFunctionKeyPress(keyIndex: FunctionKeyIndex) {
        if (this.context.shiftMode.get()) {
            if (keyIndex === FunctionKeyIndex.PatternGroup1) {
                // TODO Goto Pattern Write Mode
            }
        } else {
            if (keyIndex === FunctionKeyIndex.Track1) {
                this.context.switchToTrackPlayState(TrackIndex.I)
            } else if (keyIndex === FunctionKeyIndex.Track2) {
                this.context.switchToTrackPlayState(TrackIndex.II)
            } else if (keyIndex === FunctionKeyIndex.Track3) {
                this.context.switchToTrackPlayState(TrackIndex.III)
            } else if (keyIndex === FunctionKeyIndex.Track4) {
                this.context.switchToTrackPlayState(TrackIndex.IV)
            } else if (keyIndex === FunctionKeyIndex.PatternGroup1) {
                this.context.machine.state.patternGroupIndex.set(PatternGroupIndex.I)
            } else if (keyIndex === FunctionKeyIndex.PatternGroup2) {
                this.context.machine.state.patternGroupIndex.set(PatternGroupIndex.II)
            } else if (keyIndex === FunctionKeyIndex.PatternGroup3) {
                this.context.machine.state.patternGroupIndex.set(PatternGroupIndex.III)
            } else if (keyIndex === FunctionKeyIndex.TempoStep) {
                this.context.digits.show(this.context.machine.preset.tempo.get()) // TODO push digits renderer on stack
            }
        }
    }

    onFunctionKeyRelease(keyIndex: FunctionKeyIndex) {
        if (keyIndex === FunctionKeyIndex.TempoStep) {
            this.context.digits.clear() // TODO shift digits renderer and render last (if any)
        }
    }

    onMainKeyPress(keyIndex: MainKeyIndex) {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        this.context.machine.state.patternIndex.set(keyIndex as number as PatternIndex)
        if (!this.context.machine.transport.isPlaying()) {
            this.context.mainKeys.deactivate()
            this.context.mainKeys.byIndex(keyIndex).setState(KeyState.Blink)
        }
    }

    name(): string {
        return 'Pattern Play'
    }
}