import type { WorkerSynthesizerCore } from "./worker_synthesizer_core.ts";
import { SpessaSynthProcessor, SpessaSynthSequencer } from "spessasynth_core";

export interface WorkerRenderAudioOptions {
    /**
     * Extra fadeout time after the song finishes, in seconds.
     */
    extraTime: number;
    /**
     * If channels should be rendered separately.
     */
    separateChannels: boolean;

    /**
     * The amount of times to loop the song.
     */
    loopCount: number;

    /**
     * The function that tracks the rendering progress.
     * @param progress mapped 0 to 1.
     * @param stage 0 is a dry pass, 1 is adding effects.
     */
    progressCallback?: (progress: number, stage: number) => unknown;

    /**
     * If the current parameters of the synthesizer should be preserved.
     */
    preserveSynthParams: boolean;

    /**
     * If the effects should be enabled.
     */
    enableEffects: boolean;

    /**
     * Which sequencer to render. Defaults to the first one (0).
     */
    sequencerID: number;
}

export const DEFAULT_WORKER_RENDER_AUDIO_OPTIONS: WorkerRenderAudioOptions = {
    extraTime: 2,
    separateChannels: false,
    loopCount: 0,
    progressCallback: undefined,
    preserveSynthParams: true,
    enableEffects: true,
    sequencerID: 0
};

const RENDER_BLOCKS_PER_PROGRESS = 64;
const BLOCK_SIZE = 128;

type StereoAudioChunk = [Float32Array, Float32Array];

interface ReturnedChunks {
    effects: StereoAudioChunk;
    dry: StereoAudioChunk[];
}

export function renderAudioWorker(
    this: WorkerSynthesizerCore,
    sampleRate: number,
    options: WorkerRenderAudioOptions
): ReturnedChunks {
    const rendererSynth = new SpessaSynthProcessor(sampleRate, {
        enableEventSystem: false
    });
    const rendererSeq = new SpessaSynthSequencer(rendererSynth);

    // No cap
    rendererSynth.setMasterParameter("autoAllocateVoices", true);

    // Copy sound banks
    for (const entry of this.synthesizer.soundBankManager.soundBankList)
        rendererSynth.soundBankManager.addSoundBank(
            entry.soundBank,
            entry.id,
            entry.bankOffset
        );
    rendererSynth.soundBankManager.priorityOrder =
        this.synthesizer.soundBankManager.priorityOrder;
    this.stopAudioLoop();

    const seq = this.sequencers[options.sequencerID];
    const parsedMid = seq.midiData;
    if (!parsedMid) {
        throw new Error("No MIDI is loaded!");
    }
    const playbackRate = seq.playbackRate;
    // Calculate times
    const loopStartAbsolute =
        parsedMid.midiTicksToSeconds(parsedMid.loop.start) / playbackRate;
    const loopEndAbsolute =
        parsedMid.midiTicksToSeconds(parsedMid.loop.end) / playbackRate;
    const loopDuration = loopEndAbsolute - loopStartAbsolute;
    const duration =
        parsedMid.duration / playbackRate +
        options.extraTime +
        loopDuration * options.loopCount;
    // Total duration in samples
    const sampleDuration = sampleRate * duration;

    // Initialize
    rendererSeq.loopCount = options.loopCount;
    if (options.preserveSynthParams) {
        rendererSeq.playbackRate = seq.playbackRate;
        const snapshot = this.synthesizer.getSnapshot();
        rendererSynth.applySynthesizerSnapshot(snapshot);
    }
    rendererSeq.loadNewSongList([parsedMid]);
    rendererSeq.play();

    // Allocate memory
    // Effects
    const wetL = new Float32Array(sampleDuration);
    const wetR = new Float32Array(sampleDuration);
    const effects: StereoAudioChunk = [wetL, wetR];
    // Final output
    const returnedChunks: ReturnedChunks = {
        effects,
        dry: []
    };
    const sampleDurationNoLastQuantum = sampleDuration - BLOCK_SIZE;
    if (options.separateChannels) {
        const dry: StereoAudioChunk[] = [];
        for (let i = 0; i < 16; i++) {
            const d: StereoAudioChunk = [
                new Float32Array(sampleDuration),
                new Float32Array(sampleDuration)
            ];
            dry.push(d);
            returnedChunks.dry.push(d);
        }
        let index = 0;
        while (true) {
            for (let i = 0; i < RENDER_BLOCKS_PER_PROGRESS; i++) {
                if (index >= sampleDurationNoLastQuantum) {
                    rendererSeq.processTick();
                    rendererSynth.processSplit(
                        dry,
                        wetL,
                        wetR,
                        index,
                        sampleDuration - index
                    );
                    this.startAudioLoop();
                    return returnedChunks;
                }
                rendererSeq.processTick();
                rendererSynth.processSplit(dry, wetL, wetR, index, BLOCK_SIZE);
                index += BLOCK_SIZE;
            }
            this.postProgress("renderAudio", index / sampleDuration);
        }
    } else {
        const dryL = new Float32Array(sampleDuration);
        const dryR = new Float32Array(sampleDuration);
        const dry: StereoAudioChunk = [dryL, dryR];
        returnedChunks.dry.push(dry);
        let index = 0;
        while (true) {
            for (let i = 0; i < RENDER_BLOCKS_PER_PROGRESS; i++) {
                if (index >= sampleDurationNoLastQuantum) {
                    rendererSeq.processTick();
                    rendererSynth.process(
                        dryL,
                        dryR,
                        index,
                        sampleDuration - index
                    );
                    this.startAudioLoop();
                    return returnedChunks;
                }
                rendererSeq.processTick();

                rendererSynth.process(dryL, dryR, index, BLOCK_SIZE);
                index += BLOCK_SIZE;
            }
            this.postProgress("renderAudio", index / sampleDuration);
        }
    }
}
