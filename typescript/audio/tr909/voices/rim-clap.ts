import {dbToGain} from "../../common.js"
import {RimOrClapPreset} from "../preset.js"
import {ResourceSampleRate} from "../resources.js"
import {Channel, Voice} from "./common.js"

export class RimOrClapVoice extends Voice {
    private readonly rate: number
    private readonly gain: number

    private position: number

    constructor(private readonly array: Float32Array,
                preset: RimOrClapPreset,
                channel: Channel,
                sampleRate: number,
                offset: number,
                level: number) {
        super(channel, sampleRate, offset)

        this.position = 0.0
        this.rate = ResourceSampleRate / sampleRate
        this.gain = dbToGain(preset.level.get() + level)
    }

    stop(): void {
    }

    process(output: Float32Array): boolean {
        for (let i = this.offset; i < output.length; i++) {
            const pi = this.position | 0
            if (pi + 1 >= this.array.length) {
                return false
            }
            const p0 = this.array[pi]
            output[i] += (p0 + (this.position - pi) * (this.array[pi + 1] - p0)) * this.gain
            this.position += this.rate
        }
        this.offset = 0
        return true
    }
}