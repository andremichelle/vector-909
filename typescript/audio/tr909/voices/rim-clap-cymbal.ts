import {dbToGain} from "../../common.js"
import {CrashOrRidePreset, RimOrClapPreset} from "../preset.js"
import {ResourceSampleRate} from "../resources.js"
import {Channel, isRunning, Voice} from "./common.js"

export class RimOrClapOrCymbalVoice extends Voice {
    private readonly rate: number
    private readonly gain: number
    private readonly fadeOutDuration: number

    private position: number
    private fadeOutRemaining: number
    private fadeOutIndex: number = -1

    constructor(private readonly array: Float32Array,
                preset: RimOrClapPreset | CrashOrRidePreset,
                channel: Channel,
                sampleRate: number,
                offset: number,
                level: number) {
        super(channel, sampleRate, offset)

        this.gain = dbToGain(preset.level.get() + level)
        this.fadeOutRemaining = 0
        this.fadeOutDuration = (sampleRate * 0.005) | 0
        this.position = 0.0
        this.rate = ResourceSampleRate / sampleRate
        if ('tune' in preset) {
            this.rate *= Math.pow(2.0, preset.tune.get())
        }
    }

    stop(offset: number): void {
        this.fadeOutIndex = offset
        this.terminate()
    }

    process(output: Float32Array): isRunning {
        for (let i = this.offset; i < output.length; i++) {
            const pi = this.position | 0
            if (pi + 1 >= this.array.length) {
                return false
            }
            if (this.fadeOutIndex === i) {
                this.fadeOutIndex = -1
                this.fadeOutRemaining = this.fadeOutDuration
            }
            const p0 = this.array[pi]
            let value = (p0 + (this.position - pi) * (this.array[pi + 1] - p0)) * this.gain
            if (0 < this.fadeOutRemaining) {
                if (--this.fadeOutRemaining === 0) {
                    return false
                }
                value *= this.fadeOutRemaining / this.fadeOutDuration
            }
            output[i] += value
            this.position += this.rate
        }
        this.offset = 0
        return true
    }
}