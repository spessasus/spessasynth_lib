import type { WorkerSynthesizerCore } from "./worker_synthesizer_core.ts";
import type { WorkerRMIDIWriteOptions } from "../types.ts";
import { BasicMIDI, BasicSoundBank } from "spessasynth_core";
import { writeDLSWorker, writeSF2Worker } from "./write_sf_worker.ts";

export async function writeRMIDIWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerRMIDIWriteOptions
) {
    const sq = this.sequencers[opts.sequencerID];
    if (!sq.midiData) {
        throw new Error("No MIDI is loaded!");
    }
    let sf: BasicSoundBank;
    let sfBin: ArrayBuffer;
    if (opts.format === "sf2") {
        const bin = await writeSF2Worker.call(this, opts);
        sfBin = bin.binary;
        sf = bin.bank;
    } else {
        const bin = await writeDLSWorker.call(this, opts);
        sfBin = bin.binary;
        sf = bin.bank;
    }

    const mid = BasicMIDI.copyFrom(sq.midiData);
    return mid.writeRMIDI(sfBin, {
        soundBank: sf,
        ...opts
    });
}
