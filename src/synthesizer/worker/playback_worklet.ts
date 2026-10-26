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
    /** 
     * @type {Float32Array[]}
     */
    data = [];
    
    /**
     * Played buffers, returned to the worker with the next request to be reused.
     * @type {Float32Array[]}
     */
    free = [];
    
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
                    if (e.data === null)
                    {
                        // the worker synthesizer is dead
                        this.alive = false;
                        return;
                    }
                    this.data.push(e.data);
                    this.updateRequested = false;
                    // if we need more, request immediately
                    if (this.data.length < MAX_QUEUED)
                    {
                        this.requestData();
                    }
                };
                
            }
        };
    }
    
    /**
     * Requests a new chunk from the worker, returning a played buffer if there is one.
     */
    requestData()
    {
        const buffer = this.free.pop();
        if (buffer)
        {
            this.sentPort.postMessage(buffer, [buffer.buffer]);
        }
        else
        {
            this.sentPort.postMessage(null);
        }
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
        const channels = Math.min(outputs.length, stereoPairs);

        // copy without subarray() to avoid allocating on the audio thread
        let offset = 0;
        for (let i = 0; i < channels; i++)
        {
            const left = outputs[i][0];
            const right = outputs[i][1];
            for (let j = 0; j < BLOCK_SIZE; j++)
            {
                left[j] = data[offset + j];
                right[j] = data[offset + BLOCK_SIZE + j];
            }
            offset += BLOCK_SIZE * 2;
        }
        this.free.push(data);
        
        // if it has already been requested, we need to wait
        if (!this.updateRequested)
        {
            this.requestData();
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
