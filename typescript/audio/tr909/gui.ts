import {Terminable, Terminator} from "../../lib/common.js"
import {HTML} from "../../lib/dom.js"
import {Knob} from "../../tr909/knobs.js"
import {Preset} from "./preset.js"

const installKnobs = (parentNode: ParentNode, preset: Preset): Terminable => {
    const terminator = new Terminator()
    terminator.with(new Knob(HTML.query('[data-parameter=tempo]', parentNode), preset.tempo))
    terminator.with(new Knob(HTML.query('[data-parameter=volume]', parentNode), preset.volume))
    terminator.with(new Knob(HTML.query('[data-instrument=global] [data-parameter=accent]', parentNode), preset.accent))
    const bassdrumGroup = HTML.query('[data-instrument=bassdrum]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=tune]', bassdrumGroup), preset.bassdrum.tune))
    terminator.with(new Knob(HTML.query('[data-parameter=level]', bassdrumGroup), preset.bassdrum.level))
    terminator.with(new Knob(HTML.query('[data-parameter=attack]', bassdrumGroup), preset.bassdrum.attack))
    terminator.with(new Knob(HTML.query('[data-parameter=decay]', bassdrumGroup), preset.bassdrum.decay))
    const snaredrumGroup = HTML.query('[data-instrument=snaredrum]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=tune]', snaredrumGroup), preset.snaredrum.tune))
    terminator.with(new Knob(HTML.query('[data-parameter=level]', snaredrumGroup), preset.snaredrum.level))
    terminator.with(new Knob(HTML.query('[data-parameter=tone]', snaredrumGroup), preset.snaredrum.tone))
    terminator.with(new Knob(HTML.query('[data-parameter=snappy]', snaredrumGroup), preset.snaredrum.snappy))
    const tomLowGroup = HTML.query('[data-instrument=low-tom]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=tune]', tomLowGroup), preset.tomLow.tune))
    terminator.with(new Knob(HTML.query('[data-parameter=level]', tomLowGroup), preset.tomLow.level))
    terminator.with(new Knob(HTML.query('[data-parameter=decay]', tomLowGroup), preset.tomLow.decay))
    const tomMidGroup = HTML.query('[data-instrument=mid-tom]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=tune]', tomMidGroup), preset.tomMid.tune))
    terminator.with(new Knob(HTML.query('[data-parameter=level]', tomMidGroup), preset.tomMid.level))
    terminator.with(new Knob(HTML.query('[data-parameter=decay]', tomMidGroup), preset.tomMid.decay))
    const tomHiGroup = HTML.query('[data-instrument=hi-tom]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=tune]', tomHiGroup), preset.tomHi.tune))
    terminator.with(new Knob(HTML.query('[data-parameter=level]', tomHiGroup), preset.tomHi.level))
    terminator.with(new Knob(HTML.query('[data-parameter=decay]', tomHiGroup), preset.tomHi.decay))
    const rimClapGroup = HTML.query('[data-instrument=rim-clap]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=rim-level]', rimClapGroup), preset.rim.level))
    terminator.with(new Knob(HTML.query('[data-parameter=clap-level]', rimClapGroup), preset.clap.level))
    const hihatGroup = HTML.query('[data-instrument=hihat]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=level]', hihatGroup), preset.hihatLevel))
    terminator.with(new Knob(HTML.query('[data-parameter=cl-decay]', hihatGroup), preset.closedHihat.decay))
    terminator.with(new Knob(HTML.query('[data-parameter=op-decay]', hihatGroup), preset.openedHihat.decay))
    const cymbalParent = HTML.query('[data-instrument=cymbal]', parentNode)
    terminator.with(new Knob(HTML.query('[data-parameter=crash-level]', cymbalParent), preset.crash.level))
    terminator.with(new Knob(HTML.query('[data-parameter=ride-level]', cymbalParent), preset.ride.level))
    terminator.with(new Knob(HTML.query('[data-parameter=crash-tune]', cymbalParent), preset.crash.tune))
    terminator.with(new Knob(HTML.query('[data-parameter=ride-tune]', cymbalParent), preset.ride.tune))
    return terminator
}

export const GUI = {
    installKnobs
}