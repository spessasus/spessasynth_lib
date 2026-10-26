import type { WorkerSynthesizerCore } from "./worker_synthesizer_core";
import type {
    WorkerBankWriteOptions,
    WorkerDLSWriteOptions,
    WorkerSoundFont2WriteOptions
} from "../types";
import { BasicSoundBank, type SampleEncodingFunction } from "spessasynth_core";

/**
 * Gets the bank to write, trimmed if requested.
 * @param opts The bank write options.
 * @param modifiesSamples If the samples will be modified, the bank is copied so the synthesizer's bank stays intact.
 */
function getBankToWrite(
    this: WorkerSynthesizerCore,
    opts: WorkerBankWriteOptions,
    modifiesSamples: boolean
) {
    const sf = this.getBank(opts);
    if (!opts.trim && !modifiesSamples) return sf;

    const sfCopy = BasicSoundBank.copyFrom(sf);
    if (opts.trim) {
        const midi = this.sequencers[opts.sequencerID]?.midiData;
        if (!midi) {
            throw new Error(
                "Sound bank MIDI trimming is enabled but no MIDI is loaded!"
            );
        }
        sfCopy.trim(midi.getUsedProgramsAndKeys(sfCopy));
    }
    return sfCopy;
}

export async function writeSF2Worker(
    this: WorkerSynthesizerCore,
    opts: WorkerSoundFont2WriteOptions
): Promise<{
    binary: ArrayBuffer;
    bank: BasicSoundBank;
}> {
    const sf = getBankToWrite.call(
        this,
        opts,
        opts.compressionAction !== "keep"
    );

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
                    currentTime: this.synthesizer.currentTime
                });
                throw e;
            }
            await sf.setSampleFormat({
                compressionFunction,
                format: "compressed",
                progressFunction: (progress) => {
                    this.postProgress("workerSynthWriteFile", progress);
                    return Promise.resolve();
                }
            });
            break;
        }

        case "decompress": {
            await sf.setSampleFormat({
                format: "pcm",
                progressFunction: (progress) => {
                    this.postProgress("workerSynthWriteFile", progress);
                    return Promise.resolve();
                }
            });
        }
    }

    const b = sf.writeSF2({
        ...opts,
        progressFunction: (progress) => {
            this.postProgress("workerSynthWriteFile", progress);
            return Promise.resolve();
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
    const sf = getBankToWrite.call(this, opts, false);

    const b = sf.writeDLS({
        ...opts,
        progressFunction: (progress) => {
            this.postProgress("workerSynthWriteFile", progress);
            return Promise.resolve();
        }
    });
    return {
        binary: b,
        bank: sf
    };
}
