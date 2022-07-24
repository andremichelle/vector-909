import {BankGroupIndex, PatternGroupIndex, TrackIndex} from "../audio/tr909/memory.js"
import {Pattern} from "../audio/tr909/pattern.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {Events, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {Digits} from "./digits.js"
import {
    BankGroupKeyIndices,
    FunctionKeyIndex,
    Key,
    KeyGroup,
    KeyState,
    MainKeyIndex,
    PatternGroupKeyIndices,
    TrackKeyIndices
} from "./keys.js"
import {MachineState} from "./states.js"
import PatternPlayState from "./states/pattern-play.js"
import TrackPlayState from "./states/track-play.js"
import {InstrumentMode, Utils} from "./utils.js"

export class MachineContext implements Terminable {
    static create(machine: TR909Machine, parentNode: ParentNode): MachineContext {
        return new MachineContext(machine,
            new KeyGroup<MainKeyIndex>([...Array.from<HTMLButtonElement>(
                HTML.queryAll('[data-control=main-keys] [data-control=main-key]', parentNode)),
                HTML.query('[data-control=main-key][data-parameter=total-accent]')]
                .map((element: HTMLButtonElement) => new Key(element))
            ),
            new KeyGroup<FunctionKeyIndex>(HTML.queryAll('[data-button=function-key]')
                .map((element: HTMLButtonElement) => new Key(element))),
            new Key(HTML.query('[data-button=shift-key]')),
            new Digits(HTML.query('svg[data-display=led-display]', parentNode)))
    }

    private readonly terminator = new Terminator()

    readonly instrumentMode: ObservableValueImpl<InstrumentMode> = new ObservableValueImpl<InstrumentMode>(InstrumentMode.Bassdrum)
    readonly pressedMainKeys: Set<MainKeyIndex> = new Set<MainKeyIndex>()
    readonly shiftMode: ObservableValueImpl<boolean> = new ObservableValueImpl<boolean>(false)

    private state: NonNullable<MachineState> = new PatternPlayState(this)

    constructor(readonly machine: TR909Machine,
                readonly mainKeys: KeyGroup<MainKeyIndex>,
                readonly functionKeys: KeyGroup<FunctionKeyIndex>,
                readonly shiftKey: Key,
                readonly digits: Digits) {
        this.mainKeys.forEach((key: Key, keyIndex: MainKeyIndex) => {
            this.terminator.with(key.bind('pointerdown', (event: PointerEvent) => {
                this.pressedMainKeys.add(keyIndex)
                key.setPointerCapture(event.pointerId)
                this.state.onMainKeyPress(keyIndex)
            }))
            this.terminator.with(key.bind('pointerup', () => {
                this.pressedMainKeys.delete(keyIndex)
                this.state.onMainKeyRelease(keyIndex)
            }))
        })
        this.functionKeys.forEach((key: Key, keyId: FunctionKeyIndex) => {
            this.terminator.with(key.bind('pointerdown', (event: PointerEvent) => {
                key.setPointerCapture(event.pointerId)
                this.state.onFunctionKeyPress(keyId)
            }))
            this.terminator.with(key.bind('pointerup', () => this.state.onFunctionKeyRelease(keyId)))
        })
        this.terminator.with(this.shiftKey.bind('pointerdown', (event: PointerEvent) => {
            this.shiftKey.setPointerCapture(event.pointerId)
            this.shiftMode.set(true)
        }))
        this.terminator.with(this.shiftMode.addObserver(enabled =>
            this.shiftKey.setState(enabled ? KeyState.On : KeyState.Off)))
        this.terminator.with(this.shiftKey.bind('pointerup', () => this.shiftMode.set(false)))
        this.terminator.with(Events.bindEventListener(window, 'keydown', (event: KeyboardEvent) => {
            const code = event.code
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                this.shiftMode.set(true)
            }
        }))
        this.terminator.with(Events.bindEventListener(window, 'keyup', (event: KeyboardEvent) => {
            const code = event.code
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                this.shiftMode.set(false)
            }
        }))
        console.log(`state: ${this.stateName()}`)
    }

    stateName(): string {
        return this.state.constructor.name
    }

    switchToTrackPlayState(trackIndex: TrackIndex = TrackIndex.I): void {
        this.resetKeys()
        this.state.terminate()
        this.machine.state.trackIndex.set(trackIndex)
        this.state = new TrackPlayState(this)
        console.log(`state: ${this.stateName()}`)
    }

    switchToPatternPlayState(patternGroupIndex: PatternGroupIndex = PatternGroupIndex.I): void {
        this.resetKeys()
        this.state.terminate()
        this.machine.state.patternGroupIndex.set(patternGroupIndex)
        this.state = new PatternPlayState(this)
        console.log(`state: ${this.stateName()}`)
    }

    resetKeys(): void {
        this.functionKeys.deactivate(TrackKeyIndices)
        this.functionKeys.deactivate(BankGroupKeyIndices)
        this.functionKeys.deactivate(PatternGroupKeyIndices)
        this.resetMainKeys()
    }

    resetMainKeys(): void {
        console.debug('resetMainKeys')
        this.mainKeys.forEach(button => button.setState(KeyState.Off))
    }

    activatePatternLocationButtons(arrayIndex: number): void {
        console.debug(`activatePatternLocationButtons(arrayIndex: ${arrayIndex})`)
        const location = this.machine.state.activeBank().toLocation(arrayIndex)
        this.activatePatternGroupButton(location.patternGroupIndex)
        this.mainKeys.byIndex(location.patternIndex as number).setState(KeyState.Blink)
    }

    activateTrackButton(trackIndex: TrackIndex, writeMode: boolean): void {
        console.debug(`showTrackIndex(index: ${trackIndex}, writeMode: ${writeMode})`)
        this.functionKeys.activate(index => index === trackIndex
            ? writeMode ? KeyState.Blink :
                KeyState.On : KeyState.Off, TrackKeyIndices)
    }

    activatePatternGroupButton(patternGroupIndex: PatternGroupIndex): void {
        console.debug(`activatePatternGroupButton(index: ${patternGroupIndex})`)
        this.functionKeys.activate(index => patternGroupIndex === index ? KeyState.On : KeyState.Off, PatternGroupKeyIndices)
    }

    activateBankGroupButton(bankGroupIndex: BankGroupIndex): void {
        console.debug(`activateBankGroupButton(index: ${bankGroupIndex})`)
        this.functionKeys.activate(index => bankGroupIndex === index ? KeyState.On : KeyState.Off, BankGroupKeyIndices)
    }

    activatePatternStepsButtons(): Terminable {
        const terminator = new Terminator()
        let patternSubscription = TerminableVoid
        terminator.with({terminate: () => patternSubscription.terminate()})
        terminator.with(this.machine.state.patternIndicesChangeNotification.addObserver((pattern: Pattern) => {
            patternSubscription.terminate()
            patternSubscription = pattern.addObserver(() => this.updatePatternSteps(), true)
        }))
        terminator.with(this.activateRunningAnimation())
        this.updatePatternSteps()
        return terminator
    }

    activateRunningAnimation(): Terminable {
        const terminator = new Terminator()
        let flashing: Key = null
        terminator.with({
            terminate: () => {
                if (flashing !== null) {
                    flashing.applyState()
                    flashing = null
                }
            }
        })
        terminator.with(this.machine.processorStepIndex.addObserver(stepIndex => {
            if (flashing !== null) {
                flashing.applyState()
            }
            flashing = this.mainKeys.byIndex(stepIndex)
            flashing.flash()
        }))
        return terminator
    }

    playInstrument(keyIndex: MainKeyIndex): void {
        if (keyIndex === MainKeyIndex.TotalAccent) return
        const instrument = Utils.keyIndexToPlayInstrument(keyIndex, this.pressedMainKeys)
        const channelIndex = instrument.channelIndex
        const step = instrument.step
        this.machine.play(channelIndex, step)
    }

    terminate(): void {
        this.terminator.terminate()
    }

    private updatePatternSteps() {
        const pattern: Pattern = this.machine.state.activePattern()
        const mapping = Utils.createStepToStateMapping(this.instrumentMode.get())
        this.mainKeys.forEach((key: Key, keyIndex: MainKeyIndex) =>
            key.setState(keyIndex === MainKeyIndex.TotalAccent ? KeyState.Off : mapping(pattern, keyIndex)))
    }
}