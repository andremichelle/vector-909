var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Boot, newAudioContext, preloadImagesOfCssFile } from "./lib/boot.js";
import { HTML } from "./lib/dom.js";
const showProgress = (() => {
    const progress = document.querySelector("svg.preloader");
    window.onerror = () => progress.classList.add("error");
    window.onunhandledrejection = () => progress.classList.add("error");
    return (percentage) => progress.style.setProperty("--percentage", percentage.toFixed(2));
})();
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.debug("booting...");
    const boot = new Boot();
    boot.addObserver(boot => showProgress(boot.normalizedPercentage()));
    boot.registerProcess(preloadImagesOfCssFile("./bin/main.css"));
    const context = newAudioContext();
    yield boot.waitForCompletion();
    window.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            const device = HTML.query('.tr-909');
            device.classList.toggle('template');
            event.preventDefault();
        }
    });
    document.querySelectorAll('button.switch')
        .forEach((button, index) => {
        button.addEventListener('pointerdown', () => button.classList.toggle('active'));
        button.classList.toggle('active', index % 4 === 0);
    });
    document.querySelectorAll('button.translucent-button')
        .forEach((button, index) => {
        button.addEventListener('pointerdown', () => button.classList.toggle('active'));
    });
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
    const resize = () => {
        document.body.style.height = `${window.innerHeight}px`;
        const element = HTML.query('.tr-909');
        const padding = 64;
        const scale = Math.min(Math.min(window.innerWidth / (element.clientWidth + padding), window.innerHeight / (element.clientHeight + padding)), 1.0);
        const main = HTML.query('main');
        HTML.query('span.zoom').textContent = `Zoom: ${Math.round(scale * 100)}%`;
        main.style.setProperty("--scale", `${scale}`);
    };
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(() => {
        document.querySelectorAll("body svg.preloader").forEach(element => element.remove());
        document.querySelectorAll("body main").forEach(element => element.classList.remove("invisible"));
    });
    console.debug("boot complete.");
}))();
//# sourceMappingURL=main.js.map