import {ObservableValue, ObservableValueImpl, SettingsFormat} from "../lib/common.js"
import {Injective, InjectiveData, PowInjective} from "../lib/injective.js"

export interface GrooveFormat {
    class: 'identity' | 'function'
}

export interface GrooveFunctionFormat extends GrooveFormat {
    class: 'function'
    duration: number
    injective: SettingsFormat<InjectiveData>
}

export interface Groove {
    inverse(position: number): number

    transform(position: number): number

    serialize(): GrooveFormat
}

export const GrooveIdentity = new class implements Groove {
    serialize(): GrooveFormat {
        return {class: 'identity'}
    }

    inverse(position: number): number {
        return position
    }

    transform(position: number): number {
        return position
    }
}

export class GrooveFunction implements Groove {
    readonly duration: ObservableValue<number> = new ObservableValueImpl<number>(1.0 / 8.0)
    readonly injective: ObservableValue<Injective<any>> = new ObservableValueImpl(new PowInjective())

    constructor() {
    }

    serialize(): GrooveFunctionFormat {
        return {
            class: "function",
            duration: this.duration.get(),
            injective: this.injective.get().serialize()
        }
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
}