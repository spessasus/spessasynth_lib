import {
    type SoundBankManagerListEntry,
    SpessaSynthCoreUtils
} from "spessasynth_core";
import type {
    BasicSynthesizerMessage,
    WorkletSBKManagerData
} from "../types.ts";
import type { BasicSynthesizer } from "./basic_synthesizer.ts";

type LibSBKManagerEntry = Omit<SoundBankManagerListEntry, "soundBank">;

export class SoundBankManager {
    /**
     * All the sound banks, ordered from the most important to the least.
     */
    public soundBankList: LibSBKManagerEntry[];

    private synth: BasicSynthesizer;

    /**
     * Creates a new instance of the sound bank manager.
     */
    public constructor(synth: BasicSynthesizer) {
        this.soundBankList = [];
        this.synth = synth;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The current sound bank priority order.
     * @returns The IDs of the sound banks in the current order.
     */
    public get priorityOrder() {
        return this.soundBankList.map((s) => s.id);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Rearranges the sound banks in a given order.
     * @param newList The order of sound banks, a list of identifiers, first overwrites second.
     */
    public set priorityOrder(newList: string[]) {
        this.sendToWorklet("rearrangeSoundBanks", newList);
        this.soundBankList.sort(
            (a, b) => newList.indexOf(a.id) - newList.indexOf(b.id)
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a new sound bank buffer with a given ID.
     * @param soundBankBuffer The sound bank's buffer
     * @param id The sound bank's unique identifier.
     * @param bankOffset The sound bank's bank offset. Default is 0.
     */
    public async addSoundBank(
        soundBankBuffer: ArrayBuffer,
        id: string,
        bankOffset = 0
    ) {
        this.sendToWorklet(
            "addSoundBank",
            {
                soundBankBuffer,
                bankOffset,
                id
            },
            [soundBankBuffer]
        );
        await this.awaitResponse();
        const found = this.soundBankList.find((s) => s.id === id);
        if (found === undefined) {
            this.soundBankList.push({
                id: id,
                bankOffset: bankOffset
            });
        } else {
            found.bankOffset = bankOffset;
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Deletes a sound bank with the given ID.
     * @param id The sound bank to delete.
     */
    public async deleteSoundBank(id: string) {
        if (this.soundBankList.length < 2) {
            SpessaSynthCoreUtils.SpessaSynthWarn(
                "1 sound bank left. Aborting!"
            );
            return;
        }
        if (!this.soundBankList.some((s) => s.id === id)) {
            SpessaSynthCoreUtils.SpessaSynthWarn(
                `No sound banks with id of "${id}" found. Aborting!`
            );
            return;
        }
        this.sendToWorklet("deleteSoundBank", id);
        this.soundBankList = this.soundBankList.filter((s) => s.id !== id);
        await this.awaitResponse();
    }

    private async awaitResponse() {
        return new Promise((r) =>
            this.synth.awaitWorkerResponse("soundBankManager", r)
        );
    }

    private sendToWorklet<T extends keyof WorkletSBKManagerData>(
        type: T,
        data: WorkletSBKManagerData[T],
        transferable: Transferable[] = []
    ) {
        const msg: BasicSynthesizerMessage = {
            type: "soundBankManager",
            channelNumber: -1,
            data: {
                type,
                data
            } as {
                [K in keyof WorkletSBKManagerData]: {
                    type: K;
                    data: WorkletSBKManagerData[K];
                };
            }[keyof WorkletSBKManagerData]
        };
        this.synth.post(msg, transferable);
    }
}
