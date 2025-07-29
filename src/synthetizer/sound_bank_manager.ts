import { SpessaSynthCoreUtils } from "spessasynth_core";
import type { Synthetizer } from "./synthetizer";
import type { WorkletMessage, WorkletSBKManagerData } from "./types";

export class SoundBankManager {
    /**
     * The current list of soundbanks,
     * in order from the most important to the least.
     */
    soundBankList: { id: string; bankOffset: number }[];

    private port: MessagePort;

    private synth: Synthetizer;

    /**
     * Creates a new instance of the soundfont manager.
     */
    constructor(synth: Synthetizer) {
        this.soundBankList = [
            {
                id: "main",
                bankOffset: 0
            }
        ];

        this.port = synth.worklet.port;
        this.synth = synth;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a new sound bank buffer with a given ID.
     * @param soundBankBuffer The sound bank's buffer
     * @param id The sound bank's unique identifier.
     * @param bankOffset The sound bank's bank offset. Default is 0.
     */
    async addNewSoundBank(
        soundBankBuffer: ArrayBuffer,
        id: string,
        bankOffset: number = 0
    ) {
        this.sendToWorklet("addNewSoundBank", {
            soundBankBuffer,
            bankOffset,
            id
        });
        await new Promise((r) => (this.synth._resolveWhenReady = r));
        const found = this.soundBankList.find((s) => s.id === id);
        if (found !== undefined) {
            found.bankOffset = bankOffset;
        } else {
            this.soundBankList.push({
                id: id,
                bankOffset: bankOffset
            });
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Deletes a sound bank with the given ID.
     * @param id The sound bank to delete.
     */
    deleteSoundBank(id: string) {
        if (this.soundBankList.length === 0) {
            SpessaSynthCoreUtils.SpessaSynthWarn(
                "1 sound bank left. Aborting!"
            );
            return;
        }
        if (this.soundBankList.findIndex((s) => s.id === id) === -1) {
            SpessaSynthCoreUtils.SpessaSynthWarn(
                `No sound banks with id of "${id}" found. Aborting!`
            );
            return;
        }
        this.sendToWorklet("deleteSoundBank", id);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Rearranges the sound banks in a given order.
     * @param newList {string[]} The order of sound banks, a list of identifiers, first overwrites second.
     */
    rearrangeSoundBanks(newList: string[]) {
        this.sendToWorklet("rearrangeSoundBanks", newList);
        this.soundBankList.sort(
            (a, b) => newList.indexOf(a.id) - newList.indexOf(b.id)
        );
    }

    /**
     * DELETES ALL SOUND BANKS! and creates a new one with id "main".
     * @param newBuffer The new sound bank to reload the Synth with.
     */
    async reloadManager(newBuffer: ArrayBuffer) {
        this.sendToWorklet("reloadSoundBank", newBuffer);
        await new Promise((r) => (this.synth._resolveWhenReady = r));
    }

    private sendToWorklet<T extends keyof WorkletSBKManagerData>(
        type: T,
        data: WorkletSBKManagerData[T]
    ) {
        const msg: WorkletMessage = {
            messageType: "soundBankManager",
            channelNumber: -1,
            messageData: {
                type,
                data
            }
        };
        this.port.postMessage(msg);
    }
}
