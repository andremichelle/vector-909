import {Transport} from "./audio/common.js"
import {LimiterWorklet} from "./audio/limiter/worklet.js"
import {MeterWorklet} from "./audio/meter/worklet.js"
import {MetronomeWorklet} from "./audio/metronome/worklet.js"
import {GUI} from "./audio/tr909/gui.js"
import {Instrument, Step} from "./audio/tr909/patterns.js"
import {TR909Worklet} from "./audio/tr909/worklet.js"
import {Boot, newAudioContext, preloadImagesOfCssFile} from "./lib/boot.js"
import {ObservableValueImpl} from "./lib/common.js"
import {HTML} from "./lib/dom.js"
import {Digits} from "./tr909/digits.js"

const showProgress = (() => {
    const progress: SVGSVGElement = document.querySelector("svg.preloader")
    window.onerror = () => progress.classList.add("error")
    window.onunhandledrejection = () => progress.classList.add("error")
    return (percentage: number) => progress.style.setProperty("--percentage", percentage.toFixed(2))
})()

const fetchFloat32Array = (path: string): Promise<Float32Array> => {
    return fetch(path).then(x => x.arrayBuffer()).then(x => new Float32Array(x))
}

let shiftMode: boolean = false

;(async () => {
    console.debug("booting...")

    // --- BOOT STARTS ---
    const context = newAudioContext()
    const boot = new Boot()
    boot.addObserver(boot => showProgress(boot.normalizedPercentage()))
    boot.registerProcess(preloadImagesOfCssFile("./bin/main.css"))
    boot.registerProcess(LimiterWorklet.loadModule(context))
    boot.registerProcess(MeterWorklet.loadModule(context))
    boot.registerProcess(MetronomeWorklet.loadModule(context))
    boot.registerProcess(TR909Worklet.loadModule(context))
    const bassdrumAttack = boot.registerProcess(fetchFloat32Array('./resources/bassdrum-attack.raw'))
    const bassdrumCycle = boot.registerProcess(fetchFloat32Array('./resources/bassdrum-cycle.raw'))
    await boot.waitForCompletion()
    // --- BOOT ENDS ---

    const resources = {
        bassdrum: {
            attack: bassdrumAttack.get(),
            cycle: bassdrumCycle.get()
        }
    }

    const tr909Worklet = new TR909Worklet(context, resources)
    tr909Worklet.connect(context.destination)

    const transport = new Transport()
    tr909Worklet.listenToTransport(transport)

    const digits: Digits = new Digits(document.querySelector('svg[data-display=led-display]'))
    tr909Worklet.preset.tempo.addObserver(bpm => digits.show(bpm), true)

    const parentNode = HTML.query('div.tr-909')
    GUI.installKnobs(parentNode, tr909Worklet.preset)

    // Transport
    HTML.query('button[data-control=transport-start]', parentNode)
        .addEventListener('pointerdown', () => transport.restart())
    HTML.query('button[data-control=transport-stop-continue]', parentNode)
        .addEventListener('pointerdown', () => transport.togglePlayback())

    const selectedInstruments = new ObservableValueImpl<Instrument>(Instrument.Bassdrum)
    const pattern = tr909Worklet.memory.current()

    const stepButtons = Array.from(HTML.queryAll('[data-control=step]', HTML.query('[data-control=steps]')))
    const updateStepButtons = () => {
        const instrument = selectedInstruments.get()
        for (let stepIndex = 0; stepIndex < 16; stepIndex++) {
            const step: Step = pattern.getStep(instrument, stepIndex)
            const button = stepButtons[stepIndex]
            button.classList.toggle('half', step === Step.Active)
            button.classList.toggle('active', step === Step.Accent)
        }
    }
    pattern.addObserver(() => updateStepButtons(), false)
    selectedInstruments.addObserver(() => updateStepButtons(), false)
    updateStepButtons()

    const buttonIndexToInstrument = (buttonIndex: number): Instrument => {
        switch (buttonIndex) {
            case 0:
            case 1:
                return Instrument.Bassdrum
            case 2:
            case 3:
                return Instrument.Snaredrum
            case 4:
            case 5:
                return Instrument.TomLow
            case 6:
            case 7:
                return Instrument.TomMid
            case 8:
            case 9:
                return Instrument.TomHi
            case 10:
                return Instrument.Rim
            case 11:
                return Instrument.Clap
            // TODO How do we solve the Hihat? 12+13 are open hihats :(
            case 12:
                return Instrument.HihatClosed
            case 13:
                return Instrument.HihatClosed
            case 14:
                return Instrument.Crash
            case 15:
                return Instrument.Ride
        }
    }

    stepButtons
        .forEach((button: Element, buttonIndex: number) => {
            button.addEventListener('pointerdown', () => {
                if (shiftMode) {
                    selectedInstruments.set(buttonIndexToInstrument(buttonIndex))
                } else {
                    const step: Step = pattern.getStep(selectedInstruments.get(), buttonIndex)
                    pattern.setStep(selectedInstruments.get(), buttonIndex, (step + 1) % 3) // cycle through states
                }
            })
        })

    const shiftButton = HTML.query('[data-button=shift]')
    const setShiftMode = (enabled: boolean): void => {
        if (shiftMode === enabled) return
        shiftMode = enabled
        shiftButton.classList.toggle('active', shiftMode)
    }
    window.addEventListener('keydown', event => setShiftMode(event.shiftKey), {capture: true})
    window.addEventListener('keyup', event => setShiftMode(event.shiftKey), {capture: true})

    document.querySelectorAll('button.translucent-button')
        .forEach((button: Element, index: number) => {
            button.addEventListener('pointerdown', () => button.classList.toggle('active'))
        })


    // debugging
    const debugTransporting = HTML.query('[data-output=transporting]')
    const debugInstrument = HTML.query('[data-output=instrument]')
    const debugShiftMode = HTML.query('[data-output=shift-mode]')
    const run = () => {
        debugShiftMode.textContent = shiftMode ? 'Shift' : 'No'
        debugInstrument.textContent = Instrument[selectedInstruments.get()]
        debugTransporting.textContent = transport.isMoving() ? 'Moving' : 'Paused'
        requestAnimationFrame(run)
    }
    requestAnimationFrame(run)


    // prevent dragging entire document on mobile
    document.addEventListener('touchmove', (event: TouchEvent) => event.preventDefault(), {passive: false})
    document.addEventListener('dblclick', (event: Event) => event.preventDefault(), {passive: false})
    const main: HTMLElement = HTML.query('main')
    const tr909 = HTML.query('.tr-909')
    const zoomLabel = HTML.query('span.zoom')
    const resize = () => {
        document.body.style.height = `${window.innerHeight}px`
        const padding = 64
        let scale = Math.min(
            window.innerWidth / (tr909.clientWidth + padding),
            window.innerHeight / (tr909.clientHeight + padding))
        if (scale > 1.0) {
            scale = 1.0
        }
        zoomLabel.textContent = `Zoom: ${Math.round(scale * 100)}%`
        main.style.setProperty("--scale", `${scale}`)
    }
    window.addEventListener("resize", resize)
    resize()
    requestAnimationFrame(() => {
        document.querySelectorAll("body svg.preloader").forEach(element => element.remove())
        document.querySelectorAll("body main").forEach(element => element.classList.remove("invisible"))
    })
    console.debug("boot complete.")
})()