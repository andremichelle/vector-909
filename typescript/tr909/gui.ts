import {Transport} from "../audio/common.js"
import {Scale} from "../audio/tr909/patterns.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {Events, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {Knob} from "./knobs.js"
import {MainButtonsContext} from "./main-buttons.js"

export enum Mode {
    Steps, Tap, LastStep, ShuffleFlam, SelectInstrument, ShiftMode
}

export class GUI {
    static installGlobalTransportButtons(parentNode: ParentNode, transport: Transport): void {
        HTML.query('button[data-control=transport-start]', parentNode)
            .addEventListener('pointerdown', () => transport.restart())
        HTML.query('button[data-control=transport-stop-continue]', parentNode)
            .addEventListener('pointerdown', () => transport.togglePlayback())
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.code === 'Space' && !event.repeat) {
                transport.togglePlayback()
            }
        })
    }

    static installGlobalShortcuts(singleInstance: GUI): void {
        const codes: Readonly<Map<string, Mode>> = new Map<string, Mode>([
            ['ShiftLeft', Mode.ShiftMode],
            ['KeyS', Mode.ShuffleFlam],
            ['KeyL', Mode.LastStep],
            ['KeyI', Mode.SelectInstrument]
        ])
        let lastCode = null
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            const mode = codes.get(event.code)
            if (mode === undefined) {
                return
            }
            singleInstance.currentMode.set(mode)
            lastCode = event.code
        })
        window.addEventListener('keyup', (event: KeyboardEvent) => {
            if (lastCode === event.code) {
                singleInstance.currentMode.set(Mode.Steps)
                lastCode = null
            }
        })
    }

    private readonly terminator = new Terminator()
    private readonly mainButtonsContext: MainButtonsContext

    readonly currentMode = new ObservableValueImpl<Mode>(Mode.Steps)

    constructor(private readonly parentNode: ParentNode, private readonly machine: TR909Machine) {
        this.mainButtonsContext = new MainButtonsContext(machine,
            [...(Array.from<HTMLButtonElement>(
                HTML.queryAll('[data-control=main-buttons] [data-control=main-button]', parentNode))),
                HTML.query('[data-control=main-button][data-parameter=total-accent]')])

        this.installKnobs()
        this.installScale()
        this.installFunctionButtons()
    }

    installKnobs(): void {
        const terminator = this.terminator
        const parentNode = this.parentNode
        const preset = this.machine.preset
        terminator.with(new Knob(HTML.query('[data-parameter=tempo]', parentNode), preset.tempo))
        terminator.with(new Knob(HTML.query('[data-parameter=volume]', parentNode), preset.volume))
        terminator.with(new Knob(HTML.query('[data-instrument=global] [data-parameter=accent]', parentNode), preset.accent))
        const bassdrumGroup = HTML.query('[data-instrument=bassdrum]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=tune]', bassdrumGroup), preset.bassdrum.tune))
        terminator.with(new Knob(HTML.query('[data-parameter=level]', bassdrumGroup), preset.bassdrum.level))
        terminator.with(new Knob(HTML.query('[data-parameter=attack]', bassdrumGroup), preset.bassdrum.attack))
        terminator.with(new Knob(HTML.query('[data-parameter=decay]', bassdrumGroup), preset.bassdrum.decay))
        const snaredrumGroup = HTML.query('[data-instrument=snaredrum]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=tune]', snaredrumGroup), preset.snaredrum.tune))
        terminator.with(new Knob(HTML.query('[data-parameter=level]', snaredrumGroup), preset.snaredrum.level))
        terminator.with(new Knob(HTML.query('[data-parameter=tone]', snaredrumGroup), preset.snaredrum.tone))
        terminator.with(new Knob(HTML.query('[data-parameter=snappy]', snaredrumGroup), preset.snaredrum.snappy))
        const tomLowGroup = HTML.query('[data-instrument=low-tom]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=tune]', tomLowGroup), preset.tomLow.tune))
        terminator.with(new Knob(HTML.query('[data-parameter=level]', tomLowGroup), preset.tomLow.level))
        terminator.with(new Knob(HTML.query('[data-parameter=decay]', tomLowGroup), preset.tomLow.decay))
        const tomMidGroup = HTML.query('[data-instrument=mid-tom]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=tune]', tomMidGroup), preset.tomMid.tune))
        terminator.with(new Knob(HTML.query('[data-parameter=level]', tomMidGroup), preset.tomMid.level))
        terminator.with(new Knob(HTML.query('[data-parameter=decay]', tomMidGroup), preset.tomMid.decay))
        const tomHiGroup = HTML.query('[data-instrument=hi-tom]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=tune]', tomHiGroup), preset.tomHi.tune))
        terminator.with(new Knob(HTML.query('[data-parameter=level]', tomHiGroup), preset.tomHi.level))
        terminator.with(new Knob(HTML.query('[data-parameter=decay]', tomHiGroup), preset.tomHi.decay))
        const rimClapGroup = HTML.query('[data-instrument=rim-clap]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=rim-level]', rimClapGroup), preset.rim.level))
        terminator.with(new Knob(HTML.query('[data-parameter=clap-level]', rimClapGroup), preset.clap.level))
        const hihatGroup = HTML.query('[data-instrument=hihat]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=level]', hihatGroup), preset.hihatLevel))
        terminator.with(new Knob(HTML.query('[data-parameter=cl-decay]', hihatGroup), preset.closedHihat.decay))
        terminator.with(new Knob(HTML.query('[data-parameter=op-decay]', hihatGroup), preset.openedHihat.decay))
        const cymbalParent = HTML.query('[data-instrument=cymbal]', parentNode)
        terminator.with(new Knob(HTML.query('[data-parameter=crash-level]', cymbalParent), preset.crash.level))
        terminator.with(new Knob(HTML.query('[data-parameter=ride-level]', cymbalParent), preset.ride.level))
        terminator.with(new Knob(HTML.query('[data-parameter=crash-tune]', cymbalParent), preset.crash.tune))
        terminator.with(new Knob(HTML.query('[data-parameter=ride-tune]', cymbalParent), preset.ride.tune))
    }

    installScale(): void {
        const memory = this.machine.memory
        this.terminator.with(Events.bindEventListener(HTML.query('[data-button=scale]'), 'pointerdown', () => {
            const scale = memory.current().scale
            scale.set(scale.get().cycleNext())
        }))
        const indicator: SVGUseElement = HTML.query('[data-control=scale] [data-control=indicator]')
        let subscription: Terminable = TerminableVoid
        memory.patternIndex.addObserver(() => {
            subscription.terminate()
            subscription = memory.current().scale.addObserver(scale => {
                switch (scale) {
                    case Scale.N6D16:
                        indicator.y.baseVal.value = 0
                        break
                    case Scale.N3D8:
                        indicator.y.baseVal.value = 16
                        break
                    case Scale.D32:
                        indicator.y.baseVal.value = 32
                        break
                    case Scale.D16:
                        indicator.y.baseVal.value = 48
                        break
                }
            }, true)
        }, true)
        this.terminator.with({terminate: () => subscription.terminate()})
    }

    installFunctionButtons() {
        const buttons: Readonly<Map<Mode, HTMLButtonElement>> = new Map<Mode, HTMLButtonElement>([
            [Mode.ShiftMode, HTML.query('[data-button=shift]')],
            [Mode.ShuffleFlam, HTML.query('[data-button=shuffle-flam]')],
            [Mode.LastStep, HTML.query('[data-button=last-step]')],
            [Mode.SelectInstrument, HTML.query('[data-button=instrument-select]')]
        ])
        const configButton = (mode: Mode, button: HTMLButtonElement): void => {
            button.addEventListener('pointerdown', (event: PointerEvent) => {
                button.setPointerCapture(event.pointerId)
                this.currentMode.set(mode)
            })
            button.addEventListener('pointerup', () => this.currentMode.set(Mode.Steps))
        }
        for (const entry of buttons) {
            configButton(entry[0], entry[1])
        }
        this.currentMode.addObserver(mode => {
            switch (mode) {
                case Mode.Steps:
                    this.mainButtonsContext.switchToStepMode()
                    break
                case Mode.Tap:
                    break
                case Mode.LastStep:
                    this.mainButtonsContext.switchToLastStepSelectState()
                    break
                case Mode.ShuffleFlam:
                    this.mainButtonsContext.switchToShuffleFlamState()
                    break
                case Mode.SelectInstrument:
                    this.mainButtonsContext.switchToInstrumentSelectMode()
                    break
                case Mode.ShiftMode:
                    break
            }
            for (const button of buttons.values()) {
                button.classList.remove('active')
            }
            buttons.get(mode)?.classList.add('active')
        }, true)
        return TerminableVoid
    }
}