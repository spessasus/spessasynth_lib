// This code is called in the worker

import {
    type BasicSynthesizerMessage,
    type SynthCoreConfig,
    WorkerSynthesizerCore
} from "../../src";

let workerSynthCore: WorkerSynthesizerCore;
onmessage = (event) => {
    if (event.ports[0]) {
        workerSynthCore = new WorkerSynthesizerCore(
            event.data as SynthCoreConfig,
            event.ports[0],
            postMessage.bind(
                globalThis
            ) as unknown as typeof Worker.prototype.postMessage
        );
    } else {
        void workerSynthCore.handleMessage(
            event.data as BasicSynthesizerMessage
        );
    }
};
