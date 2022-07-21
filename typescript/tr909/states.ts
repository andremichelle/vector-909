import {GrooveFunction, GrooveIdentity} from "../audio/grooves.js"
import {ChannelIndex, Pattern, Step} from "../audio/tr909/memory.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {ArrayUtils, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {PowInjective} from "../lib/injective.js"
import {ButtonIndex, InstrumentSelectIndex, InstrumentSelectIndexStates, MainButton, MainButtonState} from "./gui.js"

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

export class MachineContext {
    readonly shiftButton: HTMLButtonElement
    readonly trackIndexButtons: HTMLButtonElement[]
    readonly patternGroupButtons: HTMLButtonElement[]

    readonly trackIndex: ObservableValueImpl<number> = new ObservableValueImpl<number>(0)
    readonly patternGroupIndex: ObservableValueImpl<number> = new ObservableValueImpl<number>(0)

    private state: NonNullable<MachineState>

    constructor(readonly machine: TR909Machine, parentNode: ParentNode) {
        this.shiftButton = HTML.query('[data-button=shift]', parentNode)
        this.trackIndexButtons = HTML.queryAll('[data-button=track-index]', parentNode)
        this.patternGroupButtons = HTML.queryAll('[data-button=pattern-group]', parentNode)
        this.state = new TrackPlayState(this)
    }
}

export interface MachineState {
    readonly context: MachineContext
}

export class TrackPlayState implements MachineState {
    private readonly terminator: Terminator = new Terminator()

    constructor(readonly context: MachineContext) {
        this.terminator.with(this.context.trackIndex.addObserver(trackIndex => {
            this.context.trackIndexButtons.forEach((button: HTMLButtonElement, buttonIndex: number) =>
                button.classList.toggle('blink', buttonIndex === trackIndex))
        }, true))
        this.terminator.with(this.context.patternGroupIndex.addObserver(patternGroupIndex => {
            this.context.patternGroupButtons.forEach((button: HTMLButtonElement, buttonIndex: number) =>
                button.classList.toggle('blink', buttonIndex === patternGroupIndex))
        }, true))
    }
}

export class MainButtonsContext {
    readonly selectedChannel: ObservableValueImpl<ChannelIndex> = new ObservableValueImpl<ChannelIndex>(ChannelIndex.Bassdrum)
    readonly selectedInstrument: ObservableValueImpl<InstrumentSelectIndex> = new ObservableValueImpl<InstrumentSelectIndex>(InstrumentSelectIndex.Bassdrum)

    private state: NonNullable<MainButtonsState> = new StepModeState(this)

    constructor(readonly machine: TR909Machine,
                readonly buttons: MainButton[]) {
        const terminator = new Terminator()
        this.buttons.forEach((button: MainButton, index: number) => {
            terminator.with(button.bind('pointerdown', (event: PointerEvent) => {
                button.setPointerCapture(event.pointerId)
                this.state.onButtonPress(event, index)
            }))
            terminator.with(button.bind('pointerup', (event: PointerEvent) => this.state.onButtonUp(event, index)))
        })
        // TODO terminator.terminate
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

    switchToInstrumentSelectModeState(): void {
        this.state.terminate()
        this.state = new InstrumentSelectState(this)
    }

    switchToLastStepSelectState(): void {
        this.state.terminate()
        this.state = new LastStepSelectState(this)
    }

    map(indices: number[]): MainButton[] {
        return indices.map(index => this.buttons[index])
    }

    forEach(fn: (value: MainButton, index: number, array: MainButton[]) => void): void {
        this.buttons.forEach(fn)
    }

    getByIndex(index: number): MainButton {
        return this.buttons[index]
    }

    clear(): void {
        this.buttons.forEach(button => button.setState(MainButtonState.Off))
    }
}

interface MainButtonsState extends Terminable {
    readonly context: MainButtonsContext

    onButtonPress(event: PointerEvent, index: ButtonIndex): void

    onButtonUp(event: PointerEvent, index: ButtonIndex): void
}

class NothingState implements MainButtonsState {
    constructor(readonly context: MainButtonsContext) {
    }

    onButtonPress(event: PointerEvent, index: ButtonIndex): void {
    }

    onButtonUp(event: PointerEvent, index: ButtonIndex): void {
    }

    terminate(): void {
    }
}

class TapModeState implements MainButtonsState {
    private readonly multiTouches: Set<number> = new Set<number>()
    private readonly stepIndexSubscription: Terminable

    constructor(readonly context: MainButtonsContext) {
        this.stepIndexSubscription = this.context.machine.stepIndex.addObserver(index => {
            this.context.clear()
            this.context.getByIndex(index).setState(MainButtonState.Flash)
        }, true)
    }

    onButtonPress(event: PointerEvent, index: ButtonIndex): void {
        const playTrigger = ButtonMapping.toPlayTrigger(index, this.multiTouches)
        const machine = this.context.machine
        machine.play(playTrigger.channelIndex, playTrigger.step)
        this.multiTouches.add(index)
        if (machine.transport.isPlaying()) {
            machine.memory.current()
                .setStep(playTrigger.channelIndex, machine.stepIndex.get(), playTrigger.step ? Step.Accent : Step.Active)
        }
    }

    onButtonUp(event: PointerEvent, index: ButtonIndex): void {
        this.multiTouches.delete(index)
    }

    terminate(): void {
        this.multiTouches.clear()
        this.stepIndexSubscription.terminate()
    }
}

class StepModeState implements MainButtonsState {
    private patternStepsSubscription: Terminable = TerminableVoid
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.patternStepsSubscription.terminate()
            this.patternStepsSubscription = memory.current().addObserver(() => this.update(), true)
        }, true)
    }

    onButtonPress(event: PointerEvent, index: ButtonIndex): void {
        const pattern = this.context.machine.memory.current()
        const instrument = this.context.selectedChannel.get()
        const step: Step = pattern.getStep(instrument, index)
        pattern.setStep(instrument, index, (step + 1) % 3) // cycle through states
    }

    onButtonUp(event: PointerEvent, index: ButtonIndex): void {
    }

    terminate(): void {
        this.patternStepsSubscription.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        const channelIndex = this.context.selectedChannel.get()
        this.context.forEach((button: MainButton, buttonIndex: number) => {
            if (buttonIndex < 16) {
                const step: Step = pattern.getStep(channelIndex, buttonIndex)
                button.setState(step === Step.Active ? MainButtonState.Flash : step === Step.Accent ? MainButtonState.On : MainButtonState.Off)
            } else {
                // button.classList.remove('flash-active')
                // button.classList.toggle('active', pattern.isTotalAccent(buttonIndex))
            }
        })
    }
}

class ShuffleFlamState implements MainButtonsState {
    private static GrooveExp: number[] = ArrayUtils.fill(7, index => 1.0 + index * 0.2)

    private subscriptions = new Terminator()
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.subscriptions.terminate()
            const pattern = memory.current()
            this.subscriptions.with(pattern.groove.addObserver(() => this.update(), true))
            this.subscriptions.with(pattern.flamDelay.addObserver(() => this.update(), true))
        }, true)
    }

    onButtonPress(event: PointerEvent, index: ButtonIndex): void {
        const pattern = this.context.machine.memory.current()
        if (index === 0) {
            pattern.groove.set(GrooveIdentity)
        } else if (index < 7) {
            const grooveFunction = new GrooveFunction()
            const powInjective = new PowInjective()
            powInjective.exponent.set(ShuffleFlamState.GrooveExp[index])
            grooveFunction.injective.set(powInjective)
            pattern.groove.set(grooveFunction)
        } else if (index >= 8 && index < 16) {
            const flamIndex = index - 8
            pattern.flamDelay.set(Pattern.FlamDelays[flamIndex])
        }
    }

    onButtonUp(event: PointerEvent, index: ButtonIndex): void {
    }

    terminate(): void {
        this.subscriptions.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        this.context.clear()
        const pattern = this.context.machine.memory.current()
        const groove = pattern.groove.get()
        if (groove === GrooveIdentity) {
            this.context.getByIndex(0).setState(MainButtonState.On)
        } else if (groove instanceof GrooveFunction) {
            const injective = groove.injective.get()
            if (injective instanceof PowInjective) {
                const index = ShuffleFlamState.GrooveExp.indexOf(injective.exponent.get())
                if (index >= 0 && index < 7) {
                    this.context.getByIndex(index).setState(MainButtonState.On)
                }
            }
        }
        const flamIndex = Pattern.FlamDelays.indexOf(pattern.flamDelay.get())
        if (flamIndex >= 0) {
            this.context.getByIndex(flamIndex + 8).setState(MainButtonState.On)
        }
    }
}

class LastStepSelectState implements MainButtonsState {
    private patternLastStepSubscription: Terminable = TerminableVoid
    private patternIndexSubscription: Terminable = TerminableVoid

    constructor(readonly context: MainButtonsContext) {
        const memory = this.context.machine.memory
        this.patternIndexSubscription = memory.patternIndex.addObserver(() => {
            this.patternLastStepSubscription.terminate()
            this.patternLastStepSubscription = memory.current().addObserver(() => this.update(), true)
        }, true)
    }

    onButtonPress(event: PointerEvent, index: ButtonIndex): void {
        const pattern = this.context.machine.memory.current()
        pattern.lastStep.set(index + 1)
    }

    onButtonUp(event: PointerEvent, index: ButtonIndex): void {
    }

    terminate(): void {
        this.patternLastStepSubscription.terminate()
        this.patternIndexSubscription.terminate()
    }

    update(): void {
        const pattern = this.context.machine.memory.current()
        this.context.clear()
        this.context.getByIndex(pattern.lastStep.get() - 1).setState(MainButtonState.On)
    }
}

class InstrumentSelectState implements MainButtonsState {
    private readonly multiTouches: Set<ButtonIndex> = new Set<ButtonIndex>()

    private readonly update = (index: InstrumentSelectIndex) => {
        this.context.clear()
        InstrumentSelectIndexStates.get(index)
            .forEach(states => this.context.getByIndex(states[0]).setState(states[1]))
    }

    private readonly subscription = this.context.selectedInstrument.addObserver(this.update, true)

    constructor(readonly context: MainButtonsContext) {
    }

    onButtonPress(event: PointerEvent, index: ButtonIndex): void {
        this.multiTouches.add(index)
        this.evalTouches()
    }

    onButtonUp(event: PointerEvent, index: ButtonIndex): void {
        if (!event.shiftKey) {
            this.multiTouches.delete(index)
        }
    }

    terminate(): void {
        this.subscription.terminate()
        this.multiTouches.clear()
    }

    private evalTouches(): void {
        type Match = [number, InstrumentSelectIndex]

        this.context.selectedInstrument.set((Array.from(InstrumentSelectIndexStates.entries())
            .reduce((match: Match, entry: [InstrumentSelectIndex, [ButtonIndex, MainButtonState][]]) => {
                const count = entry[1].filter((state: [number, MainButtonState]) => state[1] === MainButtonState.On)
                    .reduce((count: number, state: [number, MainButtonState]) => this.multiTouches.has(state[0]) ? count + 1 : count, 0)
                if (match[0] < count) {
                    match[0] = count
                    match[1] = entry[0]
                }
                return match
            }, [0, InstrumentSelectIndex.Bassdrum]))[1])
    }
}

type PlayTrigger = { channelIndex: ChannelIndex, step: Step }

class ButtonMapping {
    static toPlayTrigger(index: number, multiTouches: Set<number>): PlayTrigger {
        switch (index) {
            case 0:
                return {channelIndex: ChannelIndex.Bassdrum, step: Step.Accent}
            case 1:
                return {channelIndex: ChannelIndex.Bassdrum, step: Step.Active}
            case 2:
                return {channelIndex: ChannelIndex.Snaredrum, step: Step.Accent}
            case 3:
                return {channelIndex: ChannelIndex.Snaredrum, step: Step.Active}
            case 4:
                return {channelIndex: ChannelIndex.TomLow, step: Step.Accent}
            case 5:
                return {channelIndex: ChannelIndex.TomLow, step: Step.Active}
            case 6:
                return {channelIndex: ChannelIndex.TomMid, step: Step.Accent}
            case 7:
                return {channelIndex: ChannelIndex.TomMid, step: Step.Active}
            case 8:
                return {channelIndex: ChannelIndex.TomHi, step: Step.Accent}
            case 9:
                return {channelIndex: ChannelIndex.TomHi, step: Step.Active}
            case 10:
                return {channelIndex: ChannelIndex.Rim, step: Step.Active}
            case 11:
                return {channelIndex: ChannelIndex.Clap, step: Step.Active}
            case 12:
                if (multiTouches.has(13)) {
                    return {channelIndex: ChannelIndex.Hihat, step: Step.Extra}
                } else {
                    return {channelIndex: ChannelIndex.Hihat, step: Step.Accent}
                }
            case 13:
                if (multiTouches.has(12)) {
                    return {channelIndex: ChannelIndex.Hihat, step: Step.Extra}
                } else {
                    return {channelIndex: ChannelIndex.Hihat, step: Step.Active}
                }
            case 14:
                return {channelIndex: ChannelIndex.Crash, step: Step.Active}
            case 15:
                return {channelIndex: ChannelIndex.Ride, step: Step.Active}
            case 16: {
                throw new Error("Implement Total Accent")
            }
        }
        throw new Error(`Unknown index(${index})`)
    }
}