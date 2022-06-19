import {LimiterWorklet} from "./audio/limiter/worklet.js"
import {MeterWorklet} from "./audio/meter/worklet.js"
import {MetronomeWorklet} from "./audio/metronome/worklet.js"
import {Instrument, Step} from "./audio/tr909/patterns.js"
import {TR909Worklet} from "./audio/tr909/worklet.js"
import {Boot, newAudioContext, preloadImagesOfCssFile} from "./lib/boot.js"
import {ObservableValueImpl} from "./lib/common.js"
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

    const bassdrumCycle = await fetch('./resources/bassdrum-cycle.raw').then(x => x.arrayBuffer()).then(x => new Float32Array(x))
    const bassdrumAttack = await fetch('./resources/bassdrum-attack.raw').then(x => x.arrayBuffer()).then(x => new Float32Array(x))

    const tr909Worklet = new TR909Worklet(context, {
        bassdrum: {
            attack: bassdrumAttack,
            cycle: bassdrumCycle
        }
    })
    tr909Worklet.connect(context.destination)

    new Knob(HTML.query('[data-instrument=global] [data-parameter=accent]'), tr909Worklet.preset.accent)

    const bassdrumElement = HTML.query('[data-instrument=bassdrum]')
    new Knob(HTML.query('[data-parameter=tune]', bassdrumElement), tr909Worklet.preset.bassdrum.tune)
    new Knob(HTML.query('[data-parameter=level]', bassdrumElement), tr909Worklet.preset.bassdrum.level)
    new Knob(HTML.query('[data-parameter=attack]', bassdrumElement), tr909Worklet.preset.bassdrum.attack)
    new Knob(HTML.query('[data-parameter=decay]', bassdrumElement), tr909Worklet.preset.bassdrum.decay)

    const instrument = new ObservableValueImpl<Instrument>(Instrument.Bassdrum)
    const pattern = tr909Worklet.memory.current()

    const stepButtons = Array.from(HTML.queryAll('[data-control=step]', HTML.query('[data-control=steps]')))
    const updateStepButtons = () => {
        for (let stepIndex = 0; stepIndex < 16; stepIndex++) {
            const step: Step = pattern.getStep(instrument.get(), stepIndex)
            const button = stepButtons[stepIndex]
            button.classList.toggle('half', step === Step.Active)
            button.classList.toggle('active', step === Step.Accent)
        }
    }

    pattern.addObserver(() => updateStepButtons(), true)

    stepButtons
        .forEach((button: Element, stepIndex: number) => {
            button.addEventListener('pointerdown', () => {
                const step: Step = pattern.getStep(instrument.get(), stepIndex)
                pattern.setStep(instrument.get(), stepIndex, (step + 1) % 3) // cycle through states
            })
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