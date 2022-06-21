import {Transport} from "./audio/common.js"
import {LimiterWorklet} from "./audio/limiter/worklet.js"
import {MeterWorklet} from "./audio/meter/worklet.js"
import {MetronomeWorklet} from "./audio/metronome/worklet.js"
import {Instrument} from "./audio/tr909/patterns.js"
import {loadResources} from "./audio/tr909/resources.js"
import {TR909Machine} from "./audio/tr909/worklet.js"
import {Boot, newAudioContext, preloadImagesOfCssFile} from "./lib/boot.js"
import {HTML} from "./lib/dom.js"
import {Digits} from "./tr909/digits.js"
import {GUI} from "./tr909/gui.js"
import {MainButtonsContext} from "./tr909/main-buttons.js"

const showProgress = (() => {
    const progress: SVGSVGElement = document.querySelector("svg.preloader")
    window.onerror = () => progress.classList.add("error")
    window.onunhandledrejection = () => progress.classList.add("error")
    return (percentage: number) => progress.style.setProperty("--percentage", percentage.toFixed(2))
})()

let shiftMode: boolean = false
let instrumentSelectMode: boolean = false

;(async () => {
    console.debug("booting...")

    // --- BOOT STARTS ---
    const context = newAudioContext()
    console.debug(`sampleRate: ${context.sampleRate}`)
    const boot = new Boot()
    boot.addObserver(boot => showProgress(boot.normalizedPercentage()))
    boot.registerProcess(preloadImagesOfCssFile("./bin/main.css"))
    boot.registerProcess(LimiterWorklet.loadModule(context))
    boot.registerProcess(MeterWorklet.loadModule(context))
    boot.registerProcess(MetronomeWorklet.loadModule(context))
    boot.registerProcess(TR909Machine.loadModule(context))
    const getResources = loadResources(boot)
    await boot.waitForCompletion()
    // --- BOOT ENDS ---

    const machine = new TR909Machine(context, getResources())
    machine.master.connect(context.destination)

    const transport = new Transport()
    machine.watchTransport(transport)

    const parentNode = HTML.query('div.tr-909')
    GUI.installKnobs(parentNode, machine.preset)
    GUI.installGlobalTransportButtons(parentNode, transport)
    GUI.installScale(parentNode, machine.memory)

    const digits: Digits = new Digits(HTML.query('svg[data-display=led-display]', parentNode))
    machine.preset.tempo.addObserver(bpm => digits.show(bpm), true)

    const mainButtons = Array.from<HTMLButtonElement>(HTML.queryAll('[data-control=main-buttons] [data-control=main-button]', parentNode))
    mainButtons.push(HTML.query('[data-control=main-button][data-parameter=total-accent]'))
    const mainButtonsContext = new MainButtonsContext(machine, mainButtons)

    const shiftButton = HTML.query('[data-button=shift]')
    const setShiftMode = (enabled: boolean): void => {
        if (shiftMode === enabled) return
        shiftMode = enabled
        shiftButton.classList.toggle('active', enabled)
    }
    const instrumentSelectButton = HTML.query('[data-button=instrument-select]')
    const setInstrumentSelectMode = (enabled: boolean): void => {
        if (instrumentSelectMode === enabled) return
        instrumentSelectMode = enabled
        instrumentSelectButton.classList.toggle('active', enabled)
        if (enabled) {
            mainButtonsContext.switchToInstrumentSelectMode()
        } else {
            mainButtonsContext.switchToStepMode()
        }
    }
    window.addEventListener('keydown', event => {
        setShiftMode(event.shiftKey)
        setInstrumentSelectMode(event.altKey)
    }, {capture: true})
    window.addEventListener('keyup', event => {
        setShiftMode(event.shiftKey)
        setInstrumentSelectMode(event.altKey)
    }, {capture: true})

    // debugging
    const debugTransporting = HTML.query('[data-output=transporting]')
    const debugInstrumentSelect = HTML.query('[data-output=instrument-select]')
    const debugInstrument = HTML.query('[data-output=instrument]')
    const debugShiftMode = HTML.query('[data-output=shift-mode]')
    const run = () => {
        debugShiftMode.textContent = shiftMode ? 'Shift' : 'No'
        debugInstrumentSelect.textContent = instrumentSelectMode ? 'Select' : 'No'
        debugInstrument.textContent = Instrument[mainButtonsContext.selectedInstruments.get()]
        debugTransporting.textContent = transport.isMoving() ? 'Moving' : 'Paused'
        requestAnimationFrame(run)
    }
    requestAnimationFrame(run)

    // test
    /*document.querySelectorAll('button.translucent-button')
        .forEach((button: Element) =>
            button.addEventListener('pointerdown', () =>
                button.classList.toggle('active')))*/

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