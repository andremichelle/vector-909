import {RimOrClapPreset} from "../preset.js"
import {Resources} from "../resources.js"
import {Channel, Voice} from "./common.js"

export class RimVoice extends Voice {
    private gainEnvelope: number

    constructor(resources: Resources, preset: RimOrClapPreset, channel: Channel, sampleRate: number, offset: number, level: number) {
        super(channel, sampleRate, offset)
    }

    stop(): void {
    }

    process(output: Float32Array): boolean {
        for (let i = this.offset; i < output.length; i++) {
        }
        this.offset = 0
        return false
    }
}