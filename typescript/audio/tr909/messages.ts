import {ChannelIndex, PatternFormat, Step} from "./memory.js"

export type ToWorkletMessage =
    | { type: "update-parameter", path: string, unipolar: number }
    | { type: "update-pattern", index: number, format: PatternFormat }
    | { type: "play-channel", channelIndex: ChannelIndex, step: Step }

export type ToMainMessage = { type: "update-step", index: number }
