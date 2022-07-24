import {BankGroupIndex, PatternIndex} from "./memory.js"
import {ChannelIndex, PatternFormat, Step} from "./pattern.js"
import {Resources} from "./resources.js"
import {StateFormat} from "./state.js"

export type ToWorkletMessage =
    | { type: "update-parameter", path: string[], unipolar: number }
    | { type: "update-state", format: StateFormat }
    | { type: "update-pattern", bankGroupIndex: BankGroupIndex, arrayIndex: number, format: PatternFormat }
    | { type: "play-channel", channelIndex: ChannelIndex, step: Step }

export type ToMainMessage = { type: "update-step", index: number }

export type ProcessorOptions = { resources: Resources }