// Import modules

import { Synthetizer } from "./src/synthetizer/synthetizer.js";
import { Sequencer } from "./src/sequencer/sequencer.js";
import { getReverbProcessor } from "./src/synthetizer/audio_effects/reverb.js";
import { FancyChorus } from "./src/synthetizer/audio_effects/fancy_chorus.js";
import { audioBufferToWav } from "./src/utils/buffer_to_wav.js";
import { MIDIDeviceHandler } from "./src/external_midi/midi_handler.js";
import { WebMIDILinkHandler } from "./src/external_midi/web_midi_link.js";
import { DEFAULT_SYNTH_CONFIG } from "./src/synthetizer/audio_effects/effects_config.js";
import { WORKLET_URL_ABSOLUTE } from "./src/synthetizer/worklet_url.js";

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
