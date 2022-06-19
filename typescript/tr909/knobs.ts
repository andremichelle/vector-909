import {Events, Parameter, Terminator} from "../lib/common.js"

export class Knob {
    private readonly terminator: Terminator = new Terminator()

    constructor(private readonly element: HTMLElement, private readonly parameter: Parameter<any>) {
        this.parameter.addObserver(() => {
            const degree = -150.0 + parameter.getUnipolar() * 300.0
            element.style.setProperty('--angle', `${degree}deg`)
        }, true)
        this.attachEvents()
    }

    private attachEvents(): void {
        this.terminator.with(Events.bindEventListener(this.element, 'pointerdown', (event: PointerEvent) => {
            console.log(event)
            this.element.setPointerCapture(event.pointerId)
            let startValue = this.parameter.getUnipolar()
            let startPointer = event.clientY

            const moving = new Terminator()
            moving.with(Events.bindEventListener(this.element, 'pointermove', (event: PointerEvent) =>
                this.parameter.setUnipolar(startValue - (event.clientY - startPointer) * 0.01)))
            moving.with(Events.bindEventListener(this.element, 'pointerup', () => moving.terminate()))
        }))
    }
}