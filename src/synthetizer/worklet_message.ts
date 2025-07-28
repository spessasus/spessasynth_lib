/**
 * // NOTE: Every message needs a "channelNumber" property (if not relevant or all, set to -1)
 * @property midiMessage                - 0  -> [messageData<Uint8Array>, channelOffset<number>, force<boolean>, options<SynthMethodOptions>]
 * @property ccReset                    - 7  -> (no data) note: if channel is -1 then reset all channels
 * @property setChannelVibrato          - 8  -> {frequencyHz: number, depthCents: number, delaySeconds: number} note: if channel is -1 then stop all channels note 2: if rate is -1, it means locking
 * @property soundFontManager           - 9  -> [messageType<WorkletSoundfontManagerMessageType> messageData<any>] note: refer to sfman_message.js
 * @property stopAll                    - 10  -> force<number> (0 false, 1 true) note: if channel is -1 then stop all channels
 * @property killNotes                  - 11  -> amount<number>
 * @property muteChannel                - 12 -> isMuted<boolean>
 * @property addNewChannel              - 13 -> (no data)
 * @property customCcChange             - 14 -> [ccNumber<number>, ccValue<number>]
 * @property setMasterParameter         - 17 -> [parameter<masterParameterType>, value<number>]
 * @property setDrums                   - 18 -> isDrums<boolean>
 * @property lockController             - 21 -> [controllerNumber<number>, isLocked<boolean>]
 * @property sequencerSpecific          - 22 -> [messageType<SpessaSynthSequencerMessageType> messageData<any>] note: refer to sequencer_message.js
 * @property requestSynthesizerSnapshot - 23 -> (no data)
 * @property setLogLevel                - 24 -> [enableInfo<boolean>, enableWarning<boolean>, enableGroup<boolean>, enableTable<boolean>]
 * @property keyModifierManager         - 25 -> [messageType<workletKeyModifierMessageType> messageData<any>]
 * @property destroyWorklet             - 27 -> (no data)
 */
export const workletMessageType = {
    midiMessage: 0,
    // free 6 slots here, use when needed instead of adding new ones
    ccReset: 7,
    setChannelVibrato: 8,
    soundFontManager: 9,
    stopAll: 10,
    killNotes: 11,
    muteChannel: 12,
    addNewChannel: 13,
    customCcChange: 14,
    // 2 free slots here
    setMasterParameter: 17,
    setDrums: 18,
    lockController: 21,
    sequencerSpecific: 22,
    requestSynthesizerSnapshot: 23,
    setLogLevel: 24,
    keyModifierManager: 25,
    destroyWorklet: 27
};

/**
 *
 * 0 - channel property change      -> [channel<number>, property<ChannelProperty>] see message_sending.js line 29
 * 1 - event call                   -> {eventName<string>, eventData:<the event's data>}
 * 2 - master parameter change      -> [parameter<masterParameterType>, value<string|number>]
 * 3 - sequencer specific           -> [messageType<SpessaSynthSequencerReturnMessageType> messageData<any>] note: refer to sequencer_message.js
 * 4 - synthesizer snapshot         -> snapshot<SynthesizerSnapshot> note: refer to synthesizer_snapshot.js
 * 5 - isFullyInitialized           -> (no data)
 * 6 - soundfontError               -> errorMessage<string>
 */

/**
 * @enum {number}
 */
export const returnMessageType = {
    channelPropertyChange: 0,
    eventCall: 1,
    masterParameterChange: 2,
    sequencerSpecific: 3,
    synthesizerSnapshot: 4,
    isFullyInitialized: 5,
    soundfontError: 6
};
