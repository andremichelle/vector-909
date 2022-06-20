// TODO Arrays should be shared with SAB for no costs when using multiple instances.
// However, it is a pain right now with all those security pitfalls.
export type Resources = {
    bassdrum: {
        attack: Float32Array,
        cycle: Float32Array
    },
    rim: Float32Array,
    clap: Float32Array,
    crash: Float32Array,
    ride: Float32Array,
}

export const ResourceSampleRate = 44100.0