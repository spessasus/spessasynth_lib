import type { WorkerSynthesizerCore } from "./worker_synthesizer_core.ts";
import type {
    WorkerDLSWriteOptions,
    WorkerSoundFont2WriteOptions
} from "../types.ts";
import { type BasicSoundBank, SoundBankLoader } from "spessasynth_core";

export async function writeSF2Worker(
    this: WorkerSynthesizerCore,
    opts: WorkerSoundFont2WriteOptions
): Promise<{
    binary: ArrayBuffer;
    bank: BasicSoundBank;
}> {
    let sf;
    if (
        opts.writeEmbeddedSoundBank &&
        this.sequencer.midiData.embeddedSoundBank
    ) {
        sf = SoundBankLoader.fromArrayBuffer(
            this.sequencer.midiData.embeddedSoundBank
        );
    } else
        sf = this.synthesizer.soundBankManager.soundBankList.find(
            (b) => b.id === opts.bankID
        )?.soundBank;
    if (!sf) {
        const e = new Error(
            `${opts.bankID} does not exist in the sound bank list!`
        );
        this.post({
            type: "soundBankError",
            data: e
        });
        throw e;
    }

    if (opts.compress && !this.compressionFunction) {
        const e = new Error(
            `Compression enabled but no compression has been provided to WorkerSynthesizerCore.`
        );
        this.post({
            type: "soundBankError",
            data: e
        });
        throw e;
    }

    // Trim
    if (opts.trim) {
        sf.trimSoundBank(this.sequencer.midiData);
    }

    const b = await sf.writeSF2({
        ...opts,
        progressFunction: (sampleName, sampleIndex, sampleCount) => {
            this.postProgress("writeSoundBank", {
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

export async function writeDLSWorker(
    this: WorkerSynthesizerCore,
    opts: WorkerDLSWriteOptions
): Promise<{
    binary: ArrayBuffer;
    bank: BasicSoundBank;
}> {
    let sf;
    if (
        opts.writeEmbeddedSoundBank &&
        this.sequencer.midiData.embeddedSoundBank
    ) {
        sf = SoundBankLoader.fromArrayBuffer(
            this.sequencer.midiData.embeddedSoundBank
        );
    } else
        sf = this.synthesizer.soundBankManager.soundBankList.find(
            (b) => b.id === opts.bankID
        )?.soundBank;
    if (!sf) {
        const e = new Error(
            `${opts.bankID} does not exist in the sound bank list!`
        );
        this.post({
            type: "soundBankError",
            data: e
        });
        throw e;
    }

    // Trim
    if (opts.trim) {
        sf.trimSoundBank(this.sequencer.midiData);
    }

    const b = await sf.writeDLS({
        ...opts,
        progressFunction: (sampleName, sampleIndex, sampleCount) => {
            this.postProgress("writeSoundBank", {
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
