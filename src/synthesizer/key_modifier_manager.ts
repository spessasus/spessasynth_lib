import { KeyModifier } from "spessasynth_core";
import type { WorkletKMManagerData } from "./types";
import type { BasicSynthesizer } from "./basic_synthesizer.ts";

export class WorkletKeyModifierManagerWrapper {
    // The velocity override mappings for MIDI keys
    private keyModifiers: (KeyModifier | undefined)[][] = [];

    private synth: BasicSynthesizer;

    public constructor(synth: BasicSynthesizer) {
        this.synth = synth;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Modifies a single key.
     * @param channel The channel affected. Usually 0-15.
     * @param midiNote The MIDI note to change. 0-127.
     * @param options The key's modifiers.
     */
    public addModifier(
        channel: number,
        midiNote: number,
        options: Partial<{
            velocity: number;
            patch: {
                bank: number;
                program: number;
            };
            gain: number;
        }>
    ) {
        const velocity = options?.velocity ?? -1;
        const program = options?.patch?.program ?? -1;
        const bank = options?.patch?.bank ?? -1;
        const gain = options?.gain ?? 1;
        const mod = new KeyModifier(velocity, bank, program, gain);
        this.keyModifiers[channel] ??= [];
        this.keyModifiers[channel][midiNote] = mod;
        this.sendToWorklet("addMapping", {
            channel,
            midiNote,
            mapping: mod
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Gets a key modifier.
     * @param channel The channel affected. Usually 0-15.
     * @param midiNote The MIDI note to change. 0-127.
     * @returns The key modifier if it exists.
     */
    public getModifier(
        channel: number,
        midiNote: number
    ): KeyModifier | undefined {
        return this.keyModifiers?.[channel]?.[midiNote];
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Deletes a key modifier.
     * @param channel The channel affected. Usually 0-15.
     * @param midiNote The MIDI note to change. 0-127.
     */
    public deleteModifier(channel: number, midiNote: number) {
        this.sendToWorklet("deleteMapping", {
            channel,
            midiNote
        });
        if (this.keyModifiers[channel]?.[midiNote] === undefined) {
            return;
        }
        this.keyModifiers[channel][midiNote] = undefined;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Clears ALL Modifiers
     */
    public clearModifiers() {
        this.sendToWorklet("clearMappings", null);
        this.keyModifiers = [];
    }

    private sendToWorklet<T extends keyof WorkletKMManagerData>(
        type: T,
        data: WorkletKMManagerData[T]
    ) {
        const msg = {
            type,
            data
        } as {
            [K in keyof WorkletKMManagerData]: {
                type: K;
                data: WorkletKMManagerData[K];
            };
        }[keyof WorkletKMManagerData];
        this.synth.post({
            type: "keyModifierManager",
            channelNumber: -1,
            data: msg
        });
    }
}
