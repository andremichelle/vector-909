import {Parameter, PrintMapping, Terminable, Terminator} from "../../lib/common.js"
import {Exp, Linear, LinearInteger, Volume} from "../../lib/mapping.js"

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
    decay: Parameter<number>
}

export type CrashOrRidePreset = {
    level: Parameter<number>
    tune: Parameter<number>
}

const AccentMapping = new Linear(-18.0, 0.0)
const TempoMapping = new LinearInteger(37, 290)
const BassdrumTuneMapping = new Exp(0.007, 0.0294)
const BassdrumDecayMapping = new Exp(0.012, 0.100)
const TomDecayMapping = new Exp(0.04, 0.15)
const SnaredrumDecayMapping = new Exp(0.04, 0.2)
const OpenedHihatMapping = new Exp(0.03, 0.16)
const ClosedHihatMapping = new Exp(0.008, 0.06)
const TuneMapping = new Linear(-0.5, 0.5)

export class Preset {
    readonly tempo = new Parameter<number>(TempoMapping, PrintMapping.FLOAT_ONE, 120.0)
    readonly volume = new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, 0.0)
    readonly accent = new Parameter<number>(AccentMapping, PrintMapping.DECIBEL, -12.0)
    readonly bassdrum: Readonly<BassdrumPreset> = Object.seal({
        tune: new Parameter<number>(BassdrumTuneMapping, PrintMapping.UnipolarPercent, BassdrumTuneMapping.y(0.0)),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        attack: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, 0.0),
        decay: new Parameter<number>(BassdrumDecayMapping, PrintMapping.UnipolarPercent, BassdrumDecayMapping.y(0.5))
    })
    readonly snaredrum: Readonly<SnaredrumPreset> = Object.seal({
        tune: new Parameter<number>(TuneMapping, PrintMapping.UnipolarPercent, TuneMapping.y(0.5)),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        tone: new Parameter<number>(SnaredrumDecayMapping, PrintMapping.UnipolarPercent, SnaredrumDecayMapping.y(1.0)),
        snappy: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, 0.0)
    })
    readonly tomLow: Readonly<TomPreset> = Object.seal({
        tune: new Parameter<number>(TuneMapping, PrintMapping.UnipolarPercent, TuneMapping.y(0.5)),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        decay: new Parameter<number>(TomDecayMapping, PrintMapping.UnipolarPercent, TomDecayMapping.y(1.0))
    })
    readonly tomMid: Readonly<TomPreset> = Object.seal({
        tune: new Parameter<number>(TuneMapping, PrintMapping.UnipolarPercent, TuneMapping.y(0.5)),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        decay: new Parameter<number>(TomDecayMapping, PrintMapping.UnipolarPercent, TomDecayMapping.y(1.0))
    })
    readonly tomHi: Readonly<TomPreset> = Object.seal({
        tune: new Parameter<number>(TuneMapping, PrintMapping.UnipolarPercent, TuneMapping.y(0.5)),
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        decay: new Parameter<number>(TomDecayMapping, PrintMapping.UnipolarPercent, TomDecayMapping.y(1.0))
    })
    readonly rim: Readonly<RimOrClapPreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0)
    })
    readonly clap: Readonly<RimOrClapPreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0)
    })
    readonly hihatLevel = new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0)
    readonly closedHihat: Readonly<HihatPreset> = {
        level: this.hihatLevel,
        decay: new Parameter<number>(ClosedHihatMapping, PrintMapping.UnipolarPercent, ClosedHihatMapping.y(1.0))
    }
    readonly openedHihat: Readonly<HihatPreset> = {
        level: this.hihatLevel,
        decay: new Parameter<number>(OpenedHihatMapping, PrintMapping.UnipolarPercent, OpenedHihatMapping.y(1.0))
    }
    readonly crash: Readonly<CrashOrRidePreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        tune: new Parameter<number>(TuneMapping, PrintMapping.UnipolarPercent, TuneMapping.y(0.5))
    })
    readonly ride: Readonly<CrashOrRidePreset> = Object.seal({
        level: new Parameter<number>(Volume.Default, PrintMapping.DECIBEL, -6.0),
        tune: new Parameter<number>(TuneMapping, PrintMapping.UnipolarPercent, TuneMapping.y(0.5))
    })

    constructor() {
        Object.defineProperty(this.closedHihat, 'level', {enumerable: false})
        Object.defineProperty(this.openedHihat, 'level', {enumerable: false})
    }

    observeAll(callback: (parameter: Parameter<any>, path: string[]) => void): Terminable {
        const terminator = new Terminator()
        const search = (object: any, path: string[]): void => {
            for (let key in object) {
                const element = object[key]
                const elementPath = path.concat(key)
                if (element instanceof Parameter) {
                    terminator.with(element.addObserver(() => callback(element, elementPath)))
                } else if (element instanceof Object) {
                    search(element, elementPath)
                }
            }
        }
        search(this, [])
        return terminator
    }

    find(path: string): Parameter<any> {
        return path.split('.').reduce((object: any, key: string) => object[key], this)
    }
}