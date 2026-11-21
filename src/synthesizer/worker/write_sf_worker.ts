import type { WorkerSynthesizerCore } from "./worker_synthesizer_core";
import type {
    WorkerBankWriteOptions,
    WorkerDLSWriteOptions,
    WorkerSFeWriteOptions,
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
    if (!modifiesSamples && !opts.trim) return sf;

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

/**
 * Compresses or decompresses the samples of the bank in place, if requested.
 * @param sf The bank to change, it must be a copy of the synthesizer's bank.
 * @param action What to do with the samples.
 * @param quality The compression quality, if compressing.
 */
async function applySampleAction(
    this: WorkerSynthesizerCore,
    sf: BasicSoundBank,
    action: "keep" | "compress" | "decompress",
    quality: number
) {
    let compressionFunction: SampleEncodingFunction | undefined;

    if (this.compressionFunction !== undefined) {
        compressionFunction = (audioData, sampleRate) =>
            this.compressionFunction!(audioData, sampleRate, quality);
    }

    switch (action) {
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
}

export async function writeSF2Worker(
    this: WorkerSynthesizerCore,
    opts: WorkerSoundFont2WriteOptions
) {
    const sf = getBankToWrite.call(
        this,
        opts,
        opts.compressionAction !== "keep"
    );

    await applySampleAction.call(
        this,
        sf,
        opts.compressionAction,
        opts.compressionQuality
    );

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

export async function writeSFeWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerSFeWriteOptions
) {
    const sf = getBankToWrite.call(
        this,
        opts,
        opts.compressionAction !== "keep"
    );
    await applySampleAction.call(
        this,
        sf,
        opts.compressionAction,
        opts.compressionQuality
    );

    const b = sf.writeSFe({
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
