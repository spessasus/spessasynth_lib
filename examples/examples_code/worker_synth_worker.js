// This code is called in the worker

import { WorkerSynthesizerCore } from "../../src/index.js";

/**
 * @type {WorkerSynthesizerCore}
 */
let workerSynthCore;
onmessage = (event) => {
    if (event.ports[0]) {
        workerSynthCore = new WorkerSynthesizerCore(
            event.data,
            event.ports[0],
            postMessage.bind(this)
        );
    } else {
        void workerSynthCore.handleMessage(event.data);
    }
};
