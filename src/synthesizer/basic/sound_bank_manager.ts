import { type SoundBankManagerListEntry, SpessaLog } from "spessasynth_core";
import type { BasicSynthesizerMessage, WorkletSBKManagerData } from "../types";
import type { BasicSynthesizer } from "./basic_synthesizer";

/**
 * The sound bank manager allows for handling multiple sound banks with a single synthesizer instance.
 *
 * It is accessible via the {@link BasicSynthesizer.soundBankManager} property.
 *
 * Every operation sends a new {@link SynthesizerEvent.presetListChange `presetListChange`} event.
 * @group Synthesizer.Basic
 */
export class SoundBankManager {
    /**
     * All the sound banks, ordered from the most important to the least.
     * @internal
     */
    public soundBankList: Omit<SoundBankManagerListEntry, "soundBank">[];

    private synth: BasicSynthesizer;

    /**
     * Creates a new instance of the sound bank manager.
     * @internal
     */
    public constructor(synth: BasicSynthesizer) {
        this.soundBankList = [];
        this.synth = synth;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The IDs of the sound banks in the current order. (from the most important to last)
     * This can be used to set or retrieve the current order.
     * Presets in the first bank override the second bank if they have the same MIDI patch and so on.
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
     * This method adds a new sound bank with a given ID to the list,
     * or replaces an existing one.
     *
     *
     * > **Warning**
     * >
     * > This method detaches the provided `ArrayBuffer` by transferring it to the synthesizer.
     * > It can't be used after passing it to the object!
     *
     * @param soundBankBuffer The new sound bank to add, a binary data of the file.
     * @param id The sound bank's unique identifier. If it already exists, it will be replaced.
     * @param bankOffset The sound bank's bank MSB offset. Default is 0.
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
     * This method removes a sound bank with a given ID from the sound bank list.
     * @param id The ID of the sound bank to remove.
     */
    public async deleteSoundBank(id: string) {
        if (this.soundBankList.length < 2) {
            SpessaLog.warn("1 sound bank left. Aborting!");
            return;
        }
        if (!this.soundBankList.some((s) => s.id === id)) {
            SpessaLog.warn(
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
