import {ChannelIndex, PatternFormat, Step} from "./memory.js"
import {Resources} from "./resources.js"

export type ToWorkletMessage =
    | { type: "update-outputLatency", outputLatency: number }
    | { type: "update-parameter", path: string, unipolar: number }
    | { type: "update-pattern", index: number, format: PatternFormat }
    | { type: "play-channel", channelIndex: ChannelIndex, step: Step }

export type ToMainMessage = { type: "update-step", index: number }

export type ProcessorOptions = { resources: Resources }