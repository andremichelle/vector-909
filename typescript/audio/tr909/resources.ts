export const ResourceSampleRate = 44100.0
export type Resources = {
    sine: Float32Array, // testing
    bassdrum: {
        attack: Float32Array,
        cycle: Float32Array
    },
    snaredrum: {
        tone: Float32Array,
        noise: Float32Array
    },
    tomLow: Float32Array,
    tomMid: Float32Array,
    tomHi: Float32Array,
    rim: Float32Array,
    clap: Float32Array,
    closedHihat: Float32Array,
    openedHihat: Float32Array,
    crash: Float32Array,
    ride: Float32Array,
}