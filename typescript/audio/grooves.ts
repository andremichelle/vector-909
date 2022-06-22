import {
    Observable,
    ObservableImpl,
    ObservableValue,
    ObservableValueImpl,
    Observer,
    SettingsFormat,
    Terminable,
    TerminableVoid,
    Terminator
} from "../lib/common.js"
import {Injective, PowInjective} from "../lib/injective.js"

export const Grooves = {
    deserialize: (format: GrooveFormat): Groove => {
        if (format.class === 'identity') return GrooveIdentity
        if (format.class === 'function') {
            return new GrooveFunction().deserialize(format)
        }
    }
}

export type GrooveFormat = { class: 'identity' } | GrooveFunctionFormat

export interface GrooveFunctionFormat {
    class: 'function'
    duration: number
    injective: SettingsFormat<any>
}

export interface Groove extends Observable<Groove> {
    inverse(position: number): number

    transform(position: number): number

    serialize(): GrooveFormat

    deserialize(format: GrooveFormat): this
}

export const GrooveIdentity: Groove = new class implements Groove {
    constructor() {
    }

    inverse(position: number): number {
        return position
    }

    transform(position: number): number {
        return position
    }

    serialize(): GrooveFormat {
        return {class: 'identity'}
    }

    deserialize(format: GrooveFormat): this {
        return this
    }

    addObserver(observer: Observer<Groove>, notify: boolean): Terminable {
        if (notify) {
            observer(this)
        }
        return TerminableVoid
    }

    removeObserver(observer: Observer<Groove>): boolean {
        return true
    }

    terminate(): void {
    }
}

export class GrooveFunction implements Groove {
    private readonly terminator: Terminator = new Terminator()
    private readonly observable: ObservableImpl<Groove> = this.terminator.with(new ObservableImpl<Groove>())

    readonly duration: ObservableValue<number> = new ObservableValueImpl<number>(1.0 / 8.0)
    readonly injective: ObservableValue<Injective<any>> = new ObservableValueImpl(new PowInjective())

    constructor() {
        this.terminator.with(this.duration.addObserver(() => this.observable.notify(this), false))
        this.terminator.with(this.injective.addObserver(() => this.observable.notify(this), false))
    }

    inverse(position: number): number {
        const duration = this.duration.get()
        const start = Math.floor(position / duration) * duration
        const normalized = (position - start) / duration
        const transformed = this.injective.get().fx(normalized)
        return start + transformed * duration
    }

    transform(position: number): number {
        const duration = this.duration.get()
        const start = Math.floor(position / duration) * duration
        const normalized = (position - start) / duration
        const transformed = this.injective.get().fy(normalized)
        return start + transformed * duration
    }

    serialize(): GrooveFunctionFormat {
        return {
            class: "function",
            duration: this.duration.get(),
            injective: this.injective.get().serialize()
        }
    }

    deserialize(format: GrooveFunctionFormat): this {
        this.duration.set(format.duration)
        this.injective.set(Injective.from(format.injective))
        return this
    }

    addObserver(observer: Observer<Groove>, notify: boolean): Terminable {
        if (notify) observer(this)
        return this.observable.addObserver(observer)
    }

    removeObserver(observer: Observer<Groove>): boolean {
        return this.observable.removeObserver(observer)
    }

    terminate(): void {
        this.terminator.terminate()
    }
}