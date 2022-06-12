import {Boot, newAudioContext, preloadImagesOfCssFile} from "./lib/boot.js"
import {HTML} from "./lib/dom.js"

const showProgress = (() => {
    const progress: SVGSVGElement = document.querySelector("svg.preloader")
    window.onerror = () => progress.classList.add("error")
    window.onunhandledrejection = () => progress.classList.add("error")
    return (percentage: number) => progress.style.setProperty("--percentage", percentage.toFixed(2))
})();

(async () => {
    console.debug("booting...")

    // --- BOOT STARTS ---

    const boot = new Boot()
    boot.addObserver(boot => showProgress(boot.normalizedPercentage()))
    boot.registerProcess(preloadImagesOfCssFile("./bin/main.css"))
    const context = newAudioContext()
    await boot.waitForCompletion()

    // --- BOOT ENDS ---

    window.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.code === 'Space') {
            const device: HTMLElement = HTML.query('.tr-909')
            device.classList.toggle('template')
            event.preventDefault()
        }
    })
    document.querySelectorAll('button.switch')
        .forEach((button: Element, index: number) => {
            button.addEventListener('pointerdown', () => button.classList.toggle('active'))
            button.classList.toggle('active', index % 4 === 0)
        })
    document.querySelectorAll('button.translucent-button')
        .forEach((button: Element, index: number) => {
            button.addEventListener('pointerdown', () => button.classList.toggle('active'))
        })

    // prevent dragging entire document on mobile
    document.addEventListener('touchmove', (event: TouchEvent) => event.preventDefault(), {passive: false})
    document.addEventListener('dblclick', (event: Event) => event.preventDefault(), {passive: false})
    const resize = () => {
        document.body.style.height = `${window.innerHeight}px`
        const element = HTML.query('.tr-909')
        const padding = 64
        const scale = Math.min(Math.min(
            window.innerWidth / (element.clientWidth + padding),
            window.innerHeight / (element.clientHeight + padding)), 1.0)
        const main: HTMLElement = HTML.query('main')
        HTML.query('span.zoom').textContent = `Zoom: ${Math.round(scale * 100)}%`
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