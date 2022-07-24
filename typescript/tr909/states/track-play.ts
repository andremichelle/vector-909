import {BankGroupIndex, PatternGroupIndex, TrackIndex} from "../../audio/tr909/memory.js"
import {MachineContext} from "../context.js"
import {FunctionKeyIndex, KeyState, MainKeyIndex} from "../keys.js"
import {MachineState} from "../states.js"

export default class extends MachineState {
    constructor(context: MachineContext) {
        super(context)

        this.context.deactivateMainKeys()
        this.with(this.context.activateRunningAnimation())
        this.with(this.context.machine.state.cycleMode.addObserver(mode =>
            this.context.functionKeys.byIndex(FunctionKeyIndex.CycleGuideLastMeasure)
                .setState(mode ? KeyState.On : KeyState.Off), true))
        this.with(this.context.machine.state.trackIndex.addObserver(() => this.initButtons(), false))
        this.with(this.context.machine.state.bankGroupIndex
            .addObserver((bankGroupIndex: BankGroupIndex) => {
                this.context.activateBankGroupButton(bankGroupIndex)
                this.initButtons()
            }, true))
    }

    onFunctionKeyPress(keyIndex: FunctionKeyIndex) {
        if (this.context.shiftMode.get()) {
            if (keyIndex === FunctionKeyIndex.PatternGroup1) {
                // TODO Goto Pattern Write Mode
            } else if (keyIndex === FunctionKeyIndex.ForwardBankI) {
                this.context.machine.state.bankGroupIndex.set(BankGroupIndex.I)
            } else if (keyIndex === FunctionKeyIndex.AvailableMeasuresBankII) {
                this.context.machine.state.bankGroupIndex.set(BankGroupIndex.II)
            }
        } else {
            if (keyIndex === FunctionKeyIndex.PatternGroup1) {
                this.context.switchToPatternPlayState(PatternGroupIndex.I)
            } else if (keyIndex === FunctionKeyIndex.PatternGroup2) {
                this.context.switchToPatternPlayState(PatternGroupIndex.II)
            } else if (keyIndex === FunctionKeyIndex.PatternGroup3) {
                this.context.switchToPatternPlayState(PatternGroupIndex.III)
            } else if (keyIndex === FunctionKeyIndex.CycleGuideLastMeasure) {
                const mode = this.context.machine.state.cycleMode
                mode.set(!mode.get())
            } else if (keyIndex === FunctionKeyIndex.Track1) {
                this.context.machine.state.trackIndex.set(TrackIndex.I)
            } else if (keyIndex === FunctionKeyIndex.Track2) {
                this.context.machine.state.trackIndex.set(TrackIndex.II)
            } else if (keyIndex === FunctionKeyIndex.Track3) {
                this.context.machine.state.trackIndex.set(TrackIndex.III)
            } else if (keyIndex === FunctionKeyIndex.Track4) {
                this.context.machine.state.trackIndex.set(TrackIndex.IV)
            }
        }
    }

    onMainKeyPress(keyIndex: MainKeyIndex) {
        this.context.playInstrument(keyIndex)
    }

    private initButtons() {
        const trackIndex: TrackIndex = this.context.machine.state.trackIndex.get()
        const patternSequence = this.context.machine.state.activeBank().tracks[trackIndex]
        if (patternSequence.length === 0) {
            this.context.activatePatternGroupButton(0)
            this.context.mainKeys.byIndex(0).setState(KeyState.Flash)
            this.context.digits.show(0)
        } else {
            this.context.activatePatternLocationButtons(patternSequence[0])
            this.context.digits.show(1) // first measure index
        }
        this.context.activateTrackButton(trackIndex, false)
    }
}