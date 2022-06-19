import {LimiterWorklet} from "./audio/limiter/worklet.js"
import {MeterWorklet} from "./audio/meter/worklet.js"
import {MetronomeWorklet} from "./audio/metronome/worklet.js"
import {TR909Worklet} from "./audio/tr909/worklet.js"
import {Boot, newAudioContext, preloadImagesOfCssFile} from "./lib/boot.js"
import {HTML} from "./lib/dom.js"
import {Knob} from "./tr909/knobs.js"

const showProgress = (() => {
    const progress: SVGSVGElement = document.querySelector("svg.preloader")
    window.onerror = () => progress.classList.add("error")
    window.onunhandledrejection = () => progress.classList.add("error")
    return (percentage: number) => progress.style.setProperty("--percentage", percentage.toFixed(2))
})();

(async () => {
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
    await boot.waitForCompletion()
    // --- BOOT ENDS ---

    const tr909Worklet = new TR909Worklet(context)
    tr909Worklet.connect(context.destination)

    new Knob(HTML.query('[data-instrument=bassdrum] [data-parameter=tune]'), tr909Worklet.preset.bassdrum.tune)
    new Knob(HTML.query('[data-instrument=bassdrum] [data-parameter=level]'), tr909Worklet.preset.bassdrum.level)
    new Knob(HTML.query('[data-instrument=bassdrum] [data-parameter=attack]'), tr909Worklet.preset.bassdrum.attack)
    new Knob(HTML.query('[data-instrument=bassdrum] [data-parameter=decay]'), tr909Worklet.preset.bassdrum.decay)

    document.querySelectorAll('button.switch')
        .forEach((button: Element, index: number) => {
            button.addEventListener('pointerdown', () => button.classList.toggle('active'))
            button.classList.toggle('active', index % 4 === 0)
        })
    document.querySelectorAll('button.translucent-button')
        .forEach((button: Element, index: number) => {
            button.addEventListener('pointerdown', () => button.classList.toggle('active'))
        })

    // const display = document.querySelector('svg.digits')
    // display.querySelectorAll('g').forEach(g => console.log(g.querySelectorAll('path')))

    // prevent dragging entire document on mobile
    document.addEventListener('touchmove', (event: TouchEvent) => event.preventDefault(), {passive: false})
    document.addEventListener('dblclick', (event: Event) => event.preventDefault(), {passive: false})
    const main: HTMLElement = HTML.query('main')
    const tr909 = HTML.query('.tr-909')
    const zoomLabel = HTML.query('span.zoom')
    const zoomCheckbox: HTMLInputElement = HTML.query('input[data-control=zoom-enabled]')
    const doZoom = () => {
        if (!zoomCheckbox.checked) return
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
    zoomCheckbox.oninput = () => doZoom()
    const resize = () => {
        document.body.style.height = `${window.innerHeight}px`
        doZoom()
    }
    window.addEventListener("resize", resize)
    resize()
    requestAnimationFrame(() => {
        document.querySelectorAll("body svg.preloader").forEach(element => element.remove())
        document.querySelectorAll("body main").forEach(element => element.classList.remove("invisible"))
    })
    console.debug("boot complete.")
})()