import { SpessaSynthProcessor, SpessaSynthSequencer } from "spessasynth_core";
import { ReverbCapture } from "../basic/reverb_passthrough.ts";
import type { WorkerSynthesizerCore } from "./worker_synthesizer_core.ts";

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

export interface RenderedAudioWorkerChunks {
    /**
     * The output from spessasynth_core
     */
    output: StereoAudioChunk;
    /**
     * The dry channel output for visualization
     */
    visual: StereoAudioChunk[];
    /**
     * The convolver dry output for rendering in the main thread (optional)
     */
    convolver?: StereoAudioChunk;
}

// TODO: Ensure that everything works with the new architecture

export function renderAudioWorker(
    this: WorkerSynthesizerCore,
    sampleRate: number,
    options: WorkerRenderAudioOptions
): RenderedAudioWorkerChunks {
    // Stop the audio loop while rendering
    this.stopAudioLoop();

    // Initialize synthesizer
    const reverbCapture = this.convolverMode ? new ReverbCapture() : undefined;
    const rendererSynth = new SpessaSynthProcessor(sampleRate, {
        eventsEnabled: false,
        reverbProcessor: reverbCapture
    });
    // Copy sound banks
    for (const entry of this.synthesizer.soundBankManager.soundBankList)
        rendererSynth.soundBankManager.addSoundBank(
            entry.soundBank,
            entry.id,
            entry.bankOffset
        );
    rendererSynth.soundBankManager.priorityOrder =
        this.synthesizer.soundBankManager.priorityOrder;

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

    // Initialize sequencer
    const rendererSeq = new SpessaSynthSequencer(rendererSynth);
    rendererSeq.loopCount = options.loopCount;
    if (options.preserveSynthParams) {
        // Apply snapshot if needed
        rendererSeq.playbackRate = seq.playbackRate;
        const snapshot = this.synthesizer.getSnapshot();
        rendererSynth.applySnapshot(snapshot);
    }

    // Apply no voice cap (applying snapshot resets system parameters)
    rendererSynth.setSystemParameter("autoAllocateVoices", true);

    // Begin playing
    rendererSeq.loadNewSongList([parsedMid]);
    rendererSeq.play();

    // Allocate memory
    // Output
    const outL = new Float32Array(sampleDuration);
    const outR = new Float32Array(sampleDuration);
    const output: StereoAudioChunk = [outL, outR];
    // Final output
    const returnedChunks: RenderedAudioWorkerChunks = {
        output,
        visual: []
    };
    let convolver: StereoAudioChunk | undefined = undefined;
    if (reverbCapture) {
        convolver = [
            new Float32Array(sampleDuration),
            new Float32Array(sampleDuration)
        ];
        returnedChunks.convolver = convolver;
    }
    // Dry output pairs: one per MIDI channel if separated, otherwise a single mix
    const outputCount = options.separateChannels ? 16 : 1;
    for (let i = 0; i < outputCount; i++) {
        const d: StereoAudioChunk = [
            new Float32Array(sampleDuration),
            new Float32Array(sampleDuration)
        ];
        returnedChunks.visual.push(d);
    }

    // Render the audio here
    let index = 0;
    while (true) {
        for (let i = 0; i < RENDER_BLOCKS_PER_PROGRESS; i++) {
            rendererSeq.processTick();
            // 128 samples for the middle blocks, the remainder for the last one
            const sampleCount =
                Math.min(index + BLOCK_SIZE, sampleDuration) - index;
            rendererSynth.process(
                outL,
                outR,
                index,
                sampleCount,
                // Automatically wraps the channels for us!
                returnedChunks.visual
            );
            if (convolver) {
                const tail = reverbCapture!.capturedData.subarray(
                    0,
                    sampleCount
                );
                convolver[0].set(tail, index);
                convolver[1].set(tail, index);
            }
            index += sampleCount;
            if (index >= sampleDuration) {
                // Restart the audio loop and return
                this.startAudioLoop();
                return returnedChunks;
            }
        }
        this.postProgress("renderAudio", index / sampleDuration);
    }
}
