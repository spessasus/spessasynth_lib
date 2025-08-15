import type { WorkerSynthesizerCore } from "./worker_synthesizer_core.ts";
import type {
    WorkerDLSWriteOptions,
    WorkerSoundFont2WriteOptions
} from "../types.ts";
import { BasicSoundBank, type SampleEncodingFunction } from "spessasynth_core";

export async function writeSF2Worker(
    this: WorkerSynthesizerCore,
    opts: WorkerSoundFont2WriteOptions
): Promise<{
    binary: ArrayBuffer;
    bank: BasicSoundBank;
}> {
    let sf = this.getBank(opts);

    if (opts.compress && !this.compressionFunction) {
        const e = new Error(
            `Compression enabled but no compression has been provided to WorkerSynthesizerCore.`
        );
        this.post({
            type: "soundBankError",
            data: e,
            currentTime: this.synthesizer.currentSynthTime
        });
        throw e;
    }

    // Trim
    if (opts.trim) {
        if (!this.sequencer.midiData) {
            throw new Error(
                "Sound bank MIDI trimming is enabled but no MIDI is loaded!"
            );
        }
        // Copy
        const sfCopy = BasicSoundBank.copyFrom(sf);
        sfCopy.trimSoundBank(this.sequencer.midiData);
        sf = sfCopy;
    }

    let compressionFunction: SampleEncodingFunction | undefined;

    if (this.compressionFunction !== undefined) {
        compressionFunction = (audioData, sampleRate) =>
            this.compressionFunction!(
                audioData,
                sampleRate,
                opts.compressionQuality
            );
    }

    const b = await sf.writeSF2({
        ...opts,
        progressFunction: (sampleName, sampleIndex, sampleCount) => {
            this.postProgress("workerSynthWriteFile", {
                sampleCount,
                sampleIndex,
                sampleName
            });
            return new Promise<void>((r) => r());
        },
        compressionFunction
    });
    return {
        binary: b,
        bank: sf
    };
}

export async function writeDLSWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerDLSWriteOptions
): Promise<{
    binary: ArrayBuffer;
    bank: BasicSoundBank;
}> {
    let sf = this.getBank(opts);

    // Trim
    if (opts.trim) {
        if (!this.sequencer.midiData) {
            throw new Error(
                "Sound bank MIDI trimming is enabled but no MIDI is loaded!"
            );
        }
        const sfCopy = BasicSoundBank.copyFrom(sf);
        sfCopy.trimSoundBank(this.sequencer.midiData);
        sf = sfCopy;
    }

    const b = await sf.writeDLS({
        ...opts,
        progressFunction: (sampleName, sampleIndex, sampleCount) => {
            this.postProgress("workerSynthWriteFile", {
                sampleCount,
                sampleIndex,
                sampleName
            });
            return new Promise<void>((r) => r());
        }
    });
    return {
        binary: b,
        bank: sf
    };
}
