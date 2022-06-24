import {Instrument, PatternFormat} from "./patterns.js"

export type ToWorkletMessage =
    | { type: "update-parameter", path: string, unipolar: number }
    | { type: "update-pattern", index: number, format: PatternFormat }
    | { type: "play-instrument", instrument: Instrument, accent: boolean }

export type ToMainMessage = {type: "update-step", index: number}
