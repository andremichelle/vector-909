import {secondsToBars} from "../audio/common.js"
import {Scale} from "../audio/tr909/memory.js"
import {TR909Machine} from "../audio/tr909/worklet.js"
import {Events, ObservableValueImpl, Terminable, TerminableVoid, Terminator} from "../lib/common.js"
import {HTML} from "../lib/dom.js"
import {MachineContext} from "./context.js"
import {Digits} from "./digits.js"
import {Knob} from "./knobs.js"

export enum Mode {
    Steps, Tap, LastStep, ShuffleFlam, Clear, SelectInstrument
}

export class GUI {
    static installGlobalShortcuts(singleInstance: GUI): void {
        const codes: Readonly<Map<string, Mode>> = new Map<string, Mode>([
            ['KeyS', Mode.ShuffleFlam],
            ['KeyC', Mode.Clear],
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
                singleInstance.currentMode.set(singleInstance.runningMode.get())
                lastCode = null
            }
        })
    }

    private readonly terminator
    private readonly digits: Digits

    readonly runningMode = new ObservableValueImpl<Mode>(Mode.Tap)
    readonly currentMode = new ObservableValueImpl<Mode>(this.runningMode.get())
    readonly machineContext: MachineContext

    constructor(private readonly parentNode: ParentNode,
                private readonly machine: TR909Machine) {
        this.terminator = new Terminator()
        this.digits = new Digits(HTML.query('svg[data-display=led-display]', parentNode))
        this.digits.show(0)
        this.machineContext = MachineContext.create(machine, parentNode)

        this.installKnobs()
        // this.installScale()
        this.installTransport()
        this.installBlinkingSynchronizer()
    }

    private installKnobs(): void {
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

    private installScale(): void {
        const memory = this.machine.memory
        this.terminator.with(Events.bindEventListener(HTML.query('[data-button=scale]'), 'pointerdown', () => {
            const scale = memory.current().scale
            scale.set(scale.get().cycleNext())
        }))
        const indicator: SVGUseElement = HTML.query('[data-control=scale] [data-control=indicator]')
        const scaleToY = scale => {
            switch (scale) {
                case Scale.N6D16:
                    return 0
                case Scale.N3D8:
                    return 16
                case Scale.D32:
                    return 32
                case Scale.D16:
                    return 48
            }
        }
        let subscription: Terminable = TerminableVoid
        memory.patternIndex.addObserver(() => {
            subscription.terminate()
            subscription = memory.current().scale
                .addObserver(scale => indicator.y.baseVal.value = scaleToY(scale), true)
        }, true)
        this.terminator.with({terminate: () => subscription.terminate()})
    }

    private installTransport() {
        // Use Events and terminate
        const transport = this.machine.transport
        HTML.query('button[data-control=transport-start]', this.parentNode)
            .addEventListener('pointerdown', () => {
                if (!transport.isPlaying()) {
                    transport.moveTo(0.0)
                    transport.play()
                }
            })
        HTML.query('button[data-control=transport-stop-continue]', this.parentNode)
            .addEventListener('pointerdown', () => transport.togglePlayback())
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.code === 'Space' && !event.repeat) {
                transport.togglePlayback()
            }
        })
    }

    private installBlinkingSynchronizer(): void {
        let running = true
        let visible = true
        let frame: number = 0 | 0
        let position: number = 0.0
        let lastTime: number = Date.now()
        const style: CSSStyleDeclaration = document.documentElement.style
        const next = () => {
            const now = Date.now()
            const elapsedTime = (now - lastTime) / 1000.0
            position += secondsToBars(elapsedTime, this.machine.preset.tempo.get()) * 8.0
            lastTime = now
            if (position >= 1.0) {
                style.setProperty('--synchronous-beat-visibility', visible ? 'visible' : 'hidden')
                visible = !visible
                position -= 1.0
            }
            const flash: boolean = frame % 4 < 2
            HTML.queryAll('.flash-active', this.parentNode).forEach(element => element.classList.toggle('active', flash))
            frame++
            if (running) {
                requestAnimationFrame(next)
            }
        }
        requestAnimationFrame(next)
        this.terminator.with({terminate: () => running = false})
    }
}