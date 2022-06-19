import {PatternFormat} from "./patterns.js"

export type Message =
    | { type: "update-parameter", path: string, unipolar: number }
    | { type: "update-pattern", index: number, format: PatternFormat }
    | { type: "void" }