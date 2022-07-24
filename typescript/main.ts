import {LimiterWorklet} from "./audio/limiter/worklet.js"
import {MeterWorklet, StereoMeterWorklet} from "./audio/meter/worklet.js"
import {MetronomeWorklet} from "./audio/metronome/worklet.js"
import {Machine} from "./audio/tr909/machine.js"
import {loadResources} from "./audio/tr909/resources.js"
import {Boot, newAudioContext, preloadImagesOfCssFile} from "./lib/boot.js"
import {Waiting} from "./lib/common.js"
import {HTML} from "./lib/dom.js"
import {GUI} from "./tr909/gui.js"

const showProgress = (() => {
        const progress: SVGSVGElement = document.querySelector("svg.preloader")
        window.onerror = () => progress.classList.add("error")
        window.onunhandledrejection = () => progress.classList.add("error")
        return (percentage: number) => progress.style.setProperty("--percentage", percentage.toFixed(2))
    })()

;(async () => {
    console.debug("booting...")

    // --- BOOT STARTS ---
    const context = newAudioContext()
    console.debug(`sampleRate: ${context.sampleRate}Hz`)
    const boot = new Boot()
    boot.addObserver(boot => showProgress(boot.normalizedPercentage()))
    boot.registerProcess(preloadImagesOfCssFile("./bin/main.css"))
    boot.registerProcess(LimiterWorklet.loadModule(context))
    boot.registerProcess(MeterWorklet.loadModule(context))
    boot.registerProcess(MetronomeWorklet.loadModule(context))
    boot.registerProcess(Machine.loadModule(context))
    const getResources = loadResources(boot)
    await boot.waitForCompletion()
    // --- BOOT ENDS ---

    const main: HTMLElement = HTML.query('main')
    const parentNode = HTML.query('div.tr-909')
    const debugZoom = HTML.query('[data-output=zoom]')
    const debugMode = HTML.query('[data-output=mode]')
    const debugTransporting = HTML.query('[data-output=transporting]')
    const debugInstrument = HTML.query('[data-output=instrument]')

    // prevent dragging entire document on mobile
    document.addEventListener('touchmove', (event: TouchEvent) => event.preventDefault(), {passive: false})
    document.addEventListener('dblclick', (event: Event) => event.preventDefault(), {passive: false})
    document.addEventListener('contextmenu', event => event.preventDefault())
    const resize = () => {
        document.body.style.height = `${window.innerHeight}px`
        const padding = 16
        let scale = Math.min(
            window.innerWidth / (parentNode.clientWidth + padding),
            window.innerHeight / (parentNode.clientHeight + padding))
        if (scale > 1.0) {
            scale = 1.0
        }
        debugZoom.textContent = `${Math.round(scale * 100)}%`
        main.style.setProperty("--scale", `${scale}`)
    }

    window.addEventListener("resize", resize)
    resize()
    const body = HTML.query("body")
    HTML.queryAll("svg.preloader", body).forEach(element => element.remove())
    await Waiting.forFrames(10)
    HTML.queryAll("main", body).forEach(element => element.classList.remove("invisible"))
    console.debug("boot complete.")

    const machine = new Machine(context, getResources())

    const meter = new StereoMeterWorklet(context)
    machine.master.connect(meter).connect(context.destination)

    meter.domElement.classList.add('meter')
    HTML.query('body').appendChild(meter.domElement)

    const gui = new GUI(parentNode, machine)

    // debugging
    const run = () => {
        debugMode.textContent = gui.machineContext.stateName()
        debugTransporting.textContent = machine.transport.isPlaying() ? 'Playing' : 'Paused'
        debugInstrument.textContent = gui.machineContext.instrumentMode.get().name
        requestAnimationFrame(run)
    }
    requestAnimationFrame(run)
})()