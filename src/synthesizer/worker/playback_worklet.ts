export const PLAYBACK_WORKLET_PROCESSOR_NAME = `spessasynth-playback-worklet-processor`;

export function getPlaybackWorkletURL(maxQueuedChunks: number) {
    // Thanks to the wonderful Audio Worklet API, we have this: code in strings!
    const PLAYBACK_WORKLET_CODE = `
const BLOCK_SIZE = 128;

const MAX_QUEUED = ${maxQueuedChunks};

/**
 * An AudioWorkletProcessor that plays back dynamic streams of stereo audio.
 */
class PlaybackProcessor extends AudioWorkletProcessor
{
    /** @type {Float32Array[]} */
    data = [];
    
    updateRequested = false;
    
    alive = true;
    
    /**
     * @type {MessagePort}
     */
    sentPort;
    
    constructor()
    {
        super();
        
        /**
         * @param e {MessageEvent}
         */
        this.port.onmessage = (e) =>
        {
            if (e.ports.length)
            {
                const sentPort = e.ports[0];
                this.sentPort = sentPort;
                sentPort.onmessage = (e) =>
                {
                    if(e.data === null)
                    {
                        // the worklet is dead
                        this.alive = false;
                    }
                    this.data.push(e.data);
                    this.updateRequested = false;
                    // if we need more, request immediately
                    if (this.data.length < MAX_QUEUED)
                    {
                        this.sentPort.postMessage(null);
                    }
                };
                
            }
        };
    }
    
    // noinspection JSUnusedGlobalSymbols
    /**
     * @param _inputs {[Float32Array, Float32Array][]}
     * @param outputs {[Float32Array, Float32Array][]}
     * @returns {boolean}
     */
    process(_inputs, outputs)
    {
        const data = this.data.shift();
        if (!data)
        {
            return this.alive;
        }

        const stereoPairs = Math.floor(data.length / (BLOCK_SIZE * 2));
        // In one output mode, there's a single multi-channel output that
        // holds all the stereo pairs. In regular mode, each stereo pair
        // is written to its own output.
        const oneOutputMode = outputs.length === 1 && outputs[0].length >= stereoPairs * 2;
        const channels = oneOutputMode ? stereoPairs : Math.min(outputs.length, stereoPairs);

        let offset = 0;
        for (let i = 0; i < channels; i++)
        {
            const output = oneOutputMode ? outputs[0] : outputs[i];
            const channel = oneOutputMode ? i * 2 : 0;
            output[channel].set(data.subarray(offset, offset + BLOCK_SIZE));
            offset += BLOCK_SIZE;
            output[channel + 1].set(data.subarray(offset, offset + BLOCK_SIZE));
            offset += BLOCK_SIZE;
        }
        
        // if it has already been requested, we need to wait
        if (!this.updateRequested)
        {
            this.sentPort.postMessage(null);
            this.updateRequested = true;
        }
        
        // keep it online
        return this.alive;
    }
}
registerProcessor("${PLAYBACK_WORKLET_PROCESSOR_NAME}", PlaybackProcessor);
    `;
    const blob = new Blob([PLAYBACK_WORKLET_CODE], {
        type: "application/javascript"
    });
    return URL.createObjectURL(blob);
}
