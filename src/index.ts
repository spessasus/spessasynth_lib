// Import modules

import { Synthetizer } from "./synthetizer/synthetizer.js";
import { Sequencer } from "./sequencer/sequencer.js";
import { getReverbProcessor } from "./synthetizer/audio_effects/reverb.js";
import { FancyChorus } from "./synthetizer/audio_effects/fancy_chorus.js";
import { audioBufferToWav } from "./utils/buffer_to_wav.js";
import { MIDIDeviceHandler } from "./external_midi/midi_handler.js";
import { WebMIDILinkHandler } from "./external_midi/web_midi_link.js";
import { DEFAULT_SYNTH_CONFIG } from "./synthetizer/audio_effects/effects_config.js";
import { WORKLET_URL_ABSOLUTE } from "./synthetizer/worklet_url.js";

// Export modules
export {
    // Synthesizer and Sequencer
    Sequencer,
    Synthetizer,
    DEFAULT_SYNTH_CONFIG,

    // Effects
    getReverbProcessor,
    FancyChorus,

    // Utilities
    audioBufferToWav,
    MIDIDeviceHandler,
    WebMIDILinkHandler,
    WORKLET_URL_ABSOLUTE
};
