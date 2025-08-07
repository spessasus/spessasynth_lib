// this code is called in the worker

import { WorkerSynthesizerCore } from "../../src/index.js";

/**
 * @type {WorkerSynthesizerCore}
 */
let workerSynthCore;
onmessage = (e) => {
    if (e.ports[0]) {
        workerSynthCore = new WorkerSynthesizerCore(
            {
                sampleRate: e.data.data.sampleRate,
                initialTime: e.data.data.currentTime
            },
            e.ports[0],
            postMessage.bind(this)
        );
    } else {
        void workerSynthCore.handleMessage(e.data);
    }
};
