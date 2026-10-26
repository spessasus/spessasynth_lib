import { SpessaSynthProcessor, SpessaSynthSequencer } from "spessasynth_core";
import { ReverbCapture } from "../basic/reverb_passthrough";
import type { WorkerSynthesizerCore } from "./worker_synthesizer_core";

/**
 * Options for rendering audio in a {@link WorkerSynthesizer}.
 * The public methods accept {@link RenderAudioOptions}, which omits `separateChannels`.
 *
 * @group Synthesizer.Worker
 */
export interface WorkerRenderAudioOptions {
    /**
     * Extra fade-out time after the song finishes, in seconds.
     */
    extraTime: number;
    /**
     * If channels should be rendered separately.
     * This is set automatically by {@link WorkerSynthesizer.renderAudio} and {@link WorkerSynthesizer.renderAudioSplit}.
     */
    separateChannels: boolean;

    /**
     * The number of times to loop the song.
     */
    loopCount: number;

    /**
     * The function that tracks the rendering progress.
     * @param progress The progress, from 0 to 1.
     * @param stage Always 0, as the output and visuals are rendered in a single pass.
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
     * The complete output from spessasynth_core, with effects mixed in.
     */
    output: StereoAudioChunk;
    /**
     * The dry channel outputs for visualization only.
     */
    visual: StereoAudioChunk[];
    /**
     * The convolver dry output for rendering in the main thread (optional).
     */
    convolver?: StereoAudioChunk;
}

export function renderAudioWorker(
    this: WorkerSynthesizerCore,
    sampleRate: number,
    options: WorkerRenderAudioOptions
): RenderedAudioWorkerChunks {
    // Initialize synthesizer
    const reverbCapture = this.convolverMode
        ? new ReverbCapture(sampleRate)
        : undefined;
    const rendererSynth = new SpessaSynthProcessor(sampleRate, {
        eventsEnabled: false,
        gsReverbProcessor: reverbCapture?.gsReverb,
        xgReverbBlock: reverbCapture?.xgReverb
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
    const parsedMid = seq?.midiData;
    if (!parsedMid) {
        throw new Error("No MIDI is loaded!");
    }
    // The renderer only inherits the playback rate when preserving the parameters
    const playbackRate = options.preserveSynthParams ? seq.playbackRate : 1;
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
    const sampleDuration = Math.ceil(sampleRate * duration);

    // Initialize sequencer
    const rendererSeq = new SpessaSynthSequencer(rendererSynth);
    rendererSeq.loopCount = options.loopCount;
    rendererSeq.playbackRate = playbackRate;
    if (options.preserveSynthParams) {
        // Apply snapshot if needed
        const snapshot = this.synthesizer.getSnapshot();
        rendererSynth.applySnapshot(snapshot);
    }

    // Apply no voice cap (applying snapshot resets system parameters)
    rendererSynth.setSystemParameter("autoAllocateVoices", true);
    // The main output always has the effects mixed in, so disable them if requested
    rendererSynth.setSystemParameter("effectsEnabled", options.enableEffects);

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
                reverbCapture!.moveCapturedData(
                    convolver[0],
                    convolver[1],
                    index,
                    sampleCount
                );
            }
            index += sampleCount;
            if (index >= sampleDuration) {
                return returnedChunks;
            }
        }
        this.postProgress("renderAudio", index / sampleDuration);
    }
}
