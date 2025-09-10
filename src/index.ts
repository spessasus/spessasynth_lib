// Import modules

import { BasicSynthesizer } from "./synthesizer/basic/basic_synthesizer.ts";
import { WorkletSynthesizer } from "./synthesizer/worklet/worklet_synthesizer.js";
import { WorkerSynthesizer } from "./synthesizer/worker/worker_synthesizer.ts";
import { initializeWorkletProcessor } from "./synthesizer/worklet/worklet_processor.ts";
import { WorkerSynthesizerCore } from "./synthesizer/worker/worker_synthesizer_core.ts";
import { Sequencer } from "./sequencer/sequencer.js";
import { ChorusProcessor } from "./synthesizer/audio_effects/chorus.js";
import { ReverbProcessor } from "./synthesizer/audio_effects/reverb.ts";
import { audioBufferToWav } from "./utils/buffer_to_wav.js";
import { MIDIDeviceHandler } from "./external_midi/midi_handler.js";
import { WebMIDILinkHandler } from "./external_midi/web_midi_link.js";
import { DEFAULT_SYNTH_CONFIG } from "./synthesizer/audio_effects/effects_config.js";

// Export modules
export {
    // Synthesizer and Sequencer
    type BasicSynthesizer,
    Sequencer,
    WorkletSynthesizer,
    initializeWorkletProcessor,
    WorkerSynthesizer,
    WorkerSynthesizerCore,
    DEFAULT_SYNTH_CONFIG,

    // Effects
    ChorusProcessor,
    ReverbProcessor,

    // Utilities
    audioBufferToWav,
    MIDIDeviceHandler,
    WebMIDILinkHandler
};
