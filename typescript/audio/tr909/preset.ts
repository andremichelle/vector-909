import {Parameter, PrintMapping, Terminable, Terminator} from "../../lib/common.js"
import {Exp, Linear, Volume} from "../../lib/mapping.js"

const AccentMapping = new Linear(-18.0, 0.0)

export type BassdrumPreset = {
    tune: Parameter<number>
    level: Parameter<number>
    attack: Parameter<number>
    decay: Parameter<number>
}

export type SnaredrumPreset = {
    tune: Parameter<number>
    level: Parameter<number>
    tone: Parameter<number>
    snappy: Parameter<number>
}

export type TomPreset = {
    tune: Parameter<number>
    level: Parameter<number>
    decay: Parameter<number>
}

export type RimOrClapPreset = {
    level: Parameter<number>
}

export type HihatPreset = {
    level: Parameter<number>
    closedDecay: Parameter<number>
    openedDecay: Parameter<number>
}

export type CrashOrRidePreset = {
    level: Parameter<number>
    tune: Parameter<number>
}

export class Preset {
    readonly tempo = new Parameter<number>(new Exp(30.0, 300.0), PrintMapping.FLOAT_ONE, 120.0)
    readonly volume = new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, 0.0)
    readonly accent = new Parameter<number>(AccentMapping, PrintMapping.DECIBEL, -9.0)
    readonly bassdrum: Readonly<BassdrumPreset> = Object.seal({
        tune: new Parameter<number>(new Exp(0.007, 0.0294), PrintMapping.UnipolarPercent, 0.007),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        attack: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, 0.0),
        decay: new Parameter<number>(new Exp(0.012, 0.100), PrintMapping.UnipolarPercent, 0.1)
    })
    readonly snaredrum: Readonly<SnaredrumPreset> = Object.seal({
        tune: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.5),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        tone: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.5),
        snappy: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.5),
    })
    readonly tomLow: Readonly<TomPreset> = Object.seal({
        tune: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.5),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        decay: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0)
    })
    readonly tomMid: Readonly<TomPreset> = Object.seal({
        tune: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.5),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        decay: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0)
    })
    readonly tomHi: Readonly<TomPreset> = Object.seal({
        tune: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.5),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        decay: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0)
    })
    readonly rim: Readonly<RimOrClapPreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0)
    })
    readonly clap: Readonly<RimOrClapPreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0)
    })
    readonly hihat: Readonly<HihatPreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        closedDecay: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0),
        openedDecay: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0)
    })
    readonly crash: Readonly<CrashOrRidePreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        tune: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0)
    })
    readonly ride: Readonly<CrashOrRidePreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        tune: new Parameter<number>(Linear.Identity, PrintMapping.UnipolarPercent, 0.0)
    })

    observeAll(callback: (parameter: Parameter<any>) => void): Terminable {
        const terminator = new Terminator()
        const search = (object: any): void => {
            for (let key in object) {
                const element = object[key]
                if (element instanceof Parameter) {
                    terminator.with(element.addObserver(() => callback(element)))
                } else if (element instanceof Object) {
                    return search(element)
                }
            }
        }
        search(this)
        return terminator
    }

    serializePath(parameter: Parameter<any>): string {
        const search = (object: any, path: string[]): string[] => {
            for (let key in object) {
                const element = object[key]
                if (element === parameter) {
                    return path.concat(key)
                }
                if (element instanceof Parameter) {
                    continue
                }
                if (element instanceof Object) {
                    return search(element, path.concat(key))
                }
            }
            return path
        }
        return search(this, []).join(".")
    }

    deserialize(path: string): Parameter<any> {
        return path.split('.').reduce((object: any, key: string) => object[key], this)
    }
}