import type { WorkerSynthesizerCore } from "./worker_synthesizer_core";
import type { WorkerRMIDIWriteOptions } from "../types";
import { BasicMIDI, type BasicSoundBank } from "spessasynth_core";
import {
    writeDLSWorker,
    writeSF2Worker,
    writeSFeWorker
} from "./write_sf_worker";

export async function writeRMIDIWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerRMIDIWriteOptions
) {
    const midi = this.sequencers[opts.sequencerID]?.midiData;
    if (!midi) {
        throw new Error("No MIDI is loaded!");
    }
    let written: { binary: ArrayBuffer; bank: BasicSoundBank };
    switch (opts.format) {
        case "sf2": {
            written = await writeSF2Worker.call(this, opts);
            break;
        }

        case "dls": {
            written = writeDLSWorker.call(this, opts);
            break;
        }

        case "sfe": {
            // RMIDI holds a RIFF chunk, so never RF64
            written = writeSFeWorker.call(this, { ...opts, rf64: false });
            break;
        }
    }
    const { binary, bank } = written;

    const mid = BasicMIDI.copyFrom(midi);
    if (opts.applySnapshot) mid.applySnapshot(this.synthesizer.getSnapshot());
    return mid.writeRMIDI(binary, {
        soundBank: bank,
        ...opts
    });
}
