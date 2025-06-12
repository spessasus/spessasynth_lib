/**
 * @typedef {Object} WaveMetadata
 * @property {string|undefined} title - the song's title
 * @property {string|undefined} artist - the song's artist
 * @property {string|undefined} album - the song's album
 * @property {string|undefined} genre - the song's genre
 */

import { audioToWav } from "spessasynth_core";

// noinspection JSUnusedGlobalSymbols
/**
 * Converts an audio buffer into a wave file
 * @param audioBuffer {AudioBuffer} variable channels
 * @param normalizeAudio {boolean} find the max sample point and set it to 1, and scale others with it
 * @param channelOffset {number} channel offset and channel offset + 1 get saved
 * @param metadata {WaveMetadata}
 * @param loop {{start: number, end: number}} loop start and end points in seconds. Undefined if no loop
 * @returns {Blob}
 */
export function audioBufferToWav(audioBuffer, normalizeAudio = true, channelOffset = 0, metadata = {}, loop = undefined)
{
    /**
     * @type {Float32Array[]}
     */
    const channels = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++)
    {
        channels.push(audioBuffer.getChannelData(channelOffset + i));
    }
    return new Blob(
        [audioToWav(channels, audioBuffer.sampleRate, normalizeAudio, metadata, loop)],
        { type: "audio/wav" }
    );
}
