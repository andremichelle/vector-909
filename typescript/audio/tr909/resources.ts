import {Boot} from "../../lib/boot.js"

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
    ride: Float32Array
}


export const loadResources = (boot: Boot): () => Resources => {
    const fetchFloat32Array = (path: string): Promise<Float32Array> =>
        fetch(path)
            .then(x => x.arrayBuffer())
            .then(x => new Float32Array(x))
    const dependencies = {
        sine: boot.registerProcess(fetchFloat32Array('./resources/sine.raw')),
        bassdrum: {
            attack: boot.registerProcess(fetchFloat32Array('./resources/bassdrum-attack.raw')),
            cycle: boot.registerProcess(fetchFloat32Array('./resources/bassdrum-cycle.raw'))
        },
        snare: {
            tone: boot.registerProcess(fetchFloat32Array('./resources/snare-tone.raw')),
            noise: boot.registerProcess(fetchFloat32Array('./resources/snare-noise.raw')),
        },
        tomLow: boot.registerProcess(fetchFloat32Array('./resources/tom-low.raw')),
        tomMid: boot.registerProcess(fetchFloat32Array('./resources/tom-mid.raw')),
        tomHi: boot.registerProcess(fetchFloat32Array('./resources/tom-hi.raw')),
        rim: boot.registerProcess(fetchFloat32Array('./resources/rim.raw')),
        clap: boot.registerProcess(fetchFloat32Array('./resources/clap.raw')),
        closedHihat: boot.registerProcess(fetchFloat32Array('./resources/closed-hihat.raw')),
        openedHihat: boot.registerProcess(fetchFloat32Array('./resources/opened-hihat.raw')),
        crash: boot.registerProcess(fetchFloat32Array('./resources/crash.raw')),
        ride: boot.registerProcess(fetchFloat32Array('./resources/ride.raw'))
    }

    return () => ({
        sine: dependencies.sine.get(),
        bassdrum: {
            attack: dependencies.bassdrum.attack.get(),
            cycle: dependencies.bassdrum.cycle.get()
        },
        snaredrum: {
            tone: dependencies.snare.tone.get(),
            noise: dependencies.snare.noise.get()
        },
        tomLow: dependencies.tomLow.get(),
        tomMid: dependencies.tomMid.get(),
        tomHi: dependencies.tomHi.get(),
        rim: dependencies.rim.get(),
        clap: dependencies.clap.get(),
        closedHihat: dependencies.closedHihat.get(),
        openedHihat: dependencies.openedHihat.get(),
        crash: dependencies.crash.get(),
        ride: dependencies.ride.get()
    })
}