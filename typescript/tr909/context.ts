import {TR909Machine} from "../audio/tr909/worklet.js"
import {ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {FunctionKey, FunctionKeyIndex, MainKey, MainKeyIndex, MainKeyState} from "./keys.js"
import {
    ClearStepsState,
    ClearTapState,
    InstrumentSelectState,
    LastStepSelectState,
    MachineState,
    ShuffleFlamState,
    StepModeState,
    TapModeState
} from "./states.js"
import {InstrumentMode, Utils} from "./utils.js"

/**
 * 909 States
 [TRACK PLAY]
 + not playing
 + | Track buttons 1-4 permanently lit
 + | Shows '1' in display if track sequence is available or zero if not
 + | First pattern index is blinking on main-button or first if empty
 + | All instruments can be tapped
 + | FWD will increase track sequence position (until end)
 + | BACK will decrease track sequence position (until start)
 + | TEMPO will show tempo
 + playing
 + | If CYCLE/GUIDE is turned on, if track sequence will be repeated
 + | TEMPO will show tempo
 */

export class KeyGroup<KEY, INDEX extends number> {
    constructor(readonly keys: KEY[]) {
    }

    forEach(fn: (key: KEY, index: INDEX) => void): void {
        this.keys.forEach(fn)
    }

    byIndex(index: INDEX): KEY {
        return this.keys[index]
    }
}

export class MachineContext implements Terminable {
    static create(machine: TR909Machine, parentNode: ParentNode): MachineContext {
        return new MachineContext(machine, new KeyGroup<MainKey, MainKeyIndex>(
            [...Array.from<HTMLButtonElement>(
                HTML.queryAll('[data-control=main-keys] [data-control=main-key]', parentNode)),
                HTML.query('[data-control=main-key][data-parameter=total-accent]')]
                .map((element: HTMLButtonElement) => new MainKey(element))
        ), new KeyGroup<FunctionKey, FunctionKeyIndex>(HTML.queryAll('[data-button=function-key]')
            .map((element: HTMLButtonElement) => new FunctionKey(element))))
    }

    private readonly terminator = new Terminator()

    readonly instrumentMode: ObservableValueImpl<InstrumentMode> = new ObservableValueImpl<InstrumentMode>(InstrumentMode.Bassdrum)
    readonly pressedMainKeys: Set<MainKeyIndex> = new Set<MainKeyIndex>()

    private state: NonNullable<MachineState> = new TapModeState(this)

    constructor(readonly machine: TR909Machine,
                readonly mainKeys: KeyGroup<MainKey, MainKeyIndex>,
                readonly functionKeys: KeyGroup<FunctionKey, FunctionKeyIndex>) {

        this.mainKeys.forEach((key: MainKey, keyIndex: MainKeyIndex) => {
            this.terminator.with(key.bind('pointerdown', (event: PointerEvent) => {
                this.pressedMainKeys.add(keyIndex)
                key.setPointerCapture(event.pointerId)
                this.state.onMainKeyPress(keyIndex)
            }))
            this.terminator.with(key.bind('pointerup', (event: PointerEvent) => {
                this.pressedMainKeys.delete(keyIndex)
                this.state.onMainKeyRelease(keyIndex)
            }))
        })

        this.functionKeys.forEach((key: FunctionKey, keyId: FunctionKeyIndex) => {
            this.terminator.with(key.bind('pointerdown', (event: PointerEvent) => {
                key.setPointerCapture(event.pointerId)
                this.state.onFunctionKeyPress(keyId)
            }))
            this.terminator.with(key.bind('pointerup', (event: PointerEvent) => {
                this.state.onFunctionKeyRelease(keyId)
            }))
        })
    }

    switchToStepModeState(): void {
        this.state.terminate()
        this.state = new StepModeState(this)
    }

    switchToTapModeState(): void {
        this.state.terminate()
        this.state = new TapModeState(this)
    }

    switchToShuffleFlamState() {
        this.state.terminate()
        this.state = new ShuffleFlamState(this)
    }

    switchToClearStepsState() {
        if (this.state instanceof StepModeState) {
            this.state.terminate()
            this.state = new ClearStepsState(this)
        }
        if (this.state instanceof TapModeState) {
            this.state.terminate()
            this.state = new ClearTapState(this)
        }
    }

    switchToInstrumentSelectModeState(): void {
        this.state.terminate()
        this.state = new InstrumentSelectState(this)
    }

    switchToLastStepSelectState(): void {
        this.state.terminate()
        this.state = new LastStepSelectState(this)
    }

    clearMainKeys(): void {
        this.mainKeys.forEach(button => button.setState(MainKeyState.Off))
    }

    showPatternSteps(): Terminable {
        const terminator = new Terminator()
        const memory = this.machine.memory
        let patternSubscription = TerminableVoid
        terminator.with({terminate: () => patternSubscription.terminate()})
        terminator.with(memory.patternIndex.addObserver(() => {
            patternSubscription.terminate()
            patternSubscription = memory.current().addObserver(() => {
                const pattern = this.machine.memory.current()
                const mapping = Utils.createStepToStateMapping(this.instrumentMode.get())
                this.mainKeys.forEach((key: MainKey, keyIndex: MainKeyIndex) =>
                    key.setState(keyIndex === MainKeyIndex.TotalAccent
                        ? MainKeyState.Off : mapping(pattern, keyIndex)))
            }, true)
        }, true))
        terminator.with(this.showRunningAnimation())
        return terminator
    }

    showRunningAnimation(): Terminable {
        const terminator = new Terminator()
        let flashing: MainKey = null
        terminator.with({
            terminate: () => {
                if (flashing !== null) {
                    flashing.applyState()
                    flashing = null
                }
            }
        })
        terminator.with(this.machine.stepIndex.addObserver(stepIndex => {
            if (flashing !== null) {
                flashing.applyState()
            }
            flashing = this.mainKeys.byIndex(stepIndex)
            flashing.flash()
        }))
        return terminator
    }

    terminate(): void {
        this.terminator.terminate()
    }
}