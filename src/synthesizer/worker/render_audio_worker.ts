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
}

export const DEFAULT_WORKER_RENDER_AUDIO_OPTIONS: WorkerRenderAudioOptions = {
    extraTime: 2,
    separateChannels: false,
    loopCount: 0,
    progressCallback: undefined,
    preserveSynthParams: true,
    enableEffects: true
};

const RENDER_BLOCKS_PER_PROGRESS = 64;
const BLOCK_SIZE = 128;

type StereoAudioChunk = [Float32Array, Float32Array];

interface ReturnedChunks {
    reverb: StereoAudioChunk;
    chorus: StereoAudioChunk;
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

    // Copy sound banks
    this.synthesizer.soundBankManager.soundBankList.forEach((entry) =>
        rendererSynth.soundBankManager.addSoundBank(
            entry.soundBank,
            entry.id,
            entry.bankOffset
        )
    );
    rendererSynth.soundBankManager.priorityOrder =
        this.synthesizer.soundBankManager.priorityOrder;
    this.stopAudioLoop();

    const parsedMid = this.sequencer.midiData;
    if (!parsedMid) {
        throw new Error("No MIDI is loaded!");
    }
    const playbackRate = this.sequencer.playbackRate;
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
        rendererSeq.playbackRate = this.sequencer.playbackRate;
        const snapshot = this.synthesizer.getSnapshot();
        rendererSynth.applySynthesizerSnapshot(snapshot);
    }
    rendererSeq.loadNewSongList([parsedMid]);
    rendererSeq.play();

    const progressCallback = (progress: number) => {
        this.postProgress("renderAudio", progress);
    };

    // Allocate memory
    // Reverb, chorus
    const reverb: StereoAudioChunk = [
        new Float32Array(sampleDuration),
        new Float32Array(sampleDuration)
    ];
    const chorus: StereoAudioChunk = [
        new Float32Array(sampleDuration),
        new Float32Array(sampleDuration)
    ];
    // Final output
    const returnedChunks: ReturnedChunks = {
        reverb,
        chorus,
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
                    rendererSynth.renderAudioSplit(
                        reverb,
                        chorus,
                        dry,
                        index,
                        sampleDuration - index
                    );
                    return returnedChunks;
                }
                rendererSeq.processTick();
                rendererSynth.renderAudioSplit(
                    reverb,
                    chorus,
                    dry,
                    index,
                    BLOCK_SIZE
                );
                index += BLOCK_SIZE;
            }
            progressCallback(index / sampleDuration);
        }
    } else {
        const dry: StereoAudioChunk = [
            new Float32Array(sampleDuration),
            new Float32Array(sampleDuration)
        ];
        returnedChunks.dry.push(dry);
        let index = 0;
        while (true) {
            for (let i = 0; i < RENDER_BLOCKS_PER_PROGRESS; i++) {
                if (index >= sampleDurationNoLastQuantum) {
                    rendererSeq.processTick();
                    rendererSynth.renderAudio(
                        dry,
                        reverb,
                        chorus,
                        index,
                        sampleDuration - index
                    );
                    this.startAudioLoop();
                    return returnedChunks;
                }
                rendererSeq.processTick();
                rendererSynth.renderAudio(
                    dry,
                    reverb,
                    chorus,
                    index,
                    BLOCK_SIZE
                );
                index += BLOCK_SIZE;
            }
            progressCallback(index / sampleDuration);
        }
    }
}
