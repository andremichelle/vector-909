import {BankGroupIndex, PatternGroupIndex, PatternIndex} from "./memory.js"
import {ChannelIndex, PatternFormat, Step} from "./pattern.js"
import {Resources} from "./resources.js"

export type ToWorkletMessage =
    | { type: "update-parameter", path: string[], unipolar: number }
    | { type: "update-pattern-index", bankGroupIndex: BankGroupIndex, patternGroupIndex: PatternGroupIndex, patternIndex: PatternIndex }
    | { type: "update-pattern-data", bankGroupIndex: BankGroupIndex, patternIndex: PatternIndex, format: PatternFormat }
    | { type: "play-channel", channelIndex: ChannelIndex, step: Step }

export type ToMainMessage = { type: "update-step", index: number }

export type ProcessorOptions = { resources: Resources }