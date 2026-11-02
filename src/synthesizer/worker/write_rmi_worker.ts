import type { WorkerSynthesizerCore } from "./worker_synthesizer_core";
import type { WorkerRMIDIWriteOptions } from "../types";
import { BasicMIDI } from "spessasynth_core";
import { writeDLSWorker, writeSF2Worker } from "./write_sf_worker";

export async function writeRMIDIWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerRMIDIWriteOptions
) {
    const midi = this.sequencers[opts.sequencerID]?.midiData;
    if (!midi) {
        throw new Error("No MIDI is loaded!");
    }
    const { binary, bank } =
        opts.format === "sf2"
            ? await writeSF2Worker.call(this, opts)
            : writeDLSWorker.call(this, opts);

    const mid = BasicMIDI.copyFrom(midi);
    if (opts.applySnapshot) mid.applySnapshot(this.synthesizer.getSnapshot());
    return mid.writeRMIDI(binary, {
        soundBank: bank,
        ...opts
    });
}
