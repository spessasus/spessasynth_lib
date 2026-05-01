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

    const sq = this.sequencers[opts.sequencerID];

    // Trim
    if (opts.trim) {
        if (!sq.midiData) {
            throw new Error(
                "Sound bank MIDI trimming is enabled but no MIDI is loaded!"
            );
        }
        // Copy
        const sfCopy = BasicSoundBank.copyFrom(sf);
        sfCopy.trimSoundBank(sq.midiData);
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

    switch (opts.compressionAction) {
        case "keep":
        default: {
            // No action
            break;
        }

        case "compress": {
            if (!compressionFunction) {
                const e = new Error(
                    `Compression enabled but no compression function has been provided to WorkerSynthesizerCore.`
                );
                this.post({
                    type: "soundBankError",
                    data: e,
                    currentTime: this.synthesizer.currentSynthTime
                });
                throw e;
            }
            await sf.setSampleFormat({
                compressionFunction,
                format: "compressed",
                progressFunction: (progress) => {
                    this.postProgress("workerSynthWriteFile", progress);
                    return new Promise<void>((r) => r());
                }
            });
            break;
        }

        case "decompress": {
            await sf.setSampleFormat({
                format: "pcm",
                progressFunction: (progress) => {
                    this.postProgress("workerSynthWriteFile", progress);
                    return new Promise<void>((r) => r());
                }
            });
        }
    }

    const b = sf.writeSF2({
        ...opts,
        progressFunction: (progress) => {
            this.postProgress("workerSynthWriteFile", progress);
            return new Promise<void>((r) => r());
        }
    });
    return {
        binary: b,
        bank: sf
    };
}

export function writeDLSWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerDLSWriteOptions
) {
    let sf = this.getBank(opts);
    const sq = this.sequencers[opts.sequencerID];

    // Trim
    if (opts.trim) {
        if (!sq.midiData) {
            throw new Error(
                "Sound bank MIDI trimming is enabled but no MIDI is loaded!"
            );
        }
        const sfCopy = BasicSoundBank.copyFrom(sf);
        sfCopy.trimSoundBank(sq.midiData);
        sf = sfCopy;
    }

    const b = sf.writeDLS({
        ...opts,
        progressFunction: (progress) => {
            this.postProgress("workerSynthWriteFile", progress);
            return new Promise<void>((r) => r());
        }
    });
    return {
        binary: b,
        bank: sf
    };
}
