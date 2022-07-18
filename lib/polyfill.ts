// Cloudflare WebWorker polyfill based on https://github.com/nolanlawson/pseudo-worker
// License:
//==============================================================================
// Copyright 2016 Nolan Lawson.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//==============================================================================
// Adaptions:
// - Remove `addEventListener`, `removeEventListener`, 'postError'; not needed by Emscripten.
// - Remove `transfer` argument in `postMessage`; not needed by Emscripten when building without OffscreenCanvas support.

// @ts-expect-error non standard module
import module from '../wasm-vips/lib/vips.wasm';
import * as workerSelf from '../wasm-vips/lib/vips.worker.js';

class Worker {
    terminated = false;
    webSocket: WebSocket | undefined;

    constructor() {
        // @ts-expect-error ignore
        globalThis.performance = {}
        // @ts-expect-error ignore
        globalThis.performance.now = () => Date.now();
        // @ts-expect-error ignore
        globalThis.postMessage = msg => this.workerPostMessage(msg);
        // @ts-expect-error ignore
        globalThis.close = () => this.terminate();
    }

    private runPostMessage(msg: any): void {
        const callFun = (listener: (ev: MessageEvent) => any) => {
            try {
                listener({ data: msg } as MessageEvent);
            } catch (err) {
                console.error(err);
            }
        }
        if (typeof workerSelf.onmessage === 'function') {
            callFun(workerSelf.onmessage);
        }
    }

    postMessage(msg: any): void {
        if (typeof msg === 'undefined') {
            throw new Error('postMessage() requires an argument');
        }
        if (this.terminated) {
            return;
        }

        // Emscripten fix
        if (msg.cmd === 'load') {
            // FIXME(kleisauke): Need to share the memory with the worker that instantiated wasm-vips.
            // @ts-expect-error ignore
            msg.wasmMemory = new WebAssembly.Memory({
                initial: 1024,
                maximum: 1024,
                shared: true,
            });
            msg.wasmModule = module;
        }
        // End of Emscripten fix

        this.runPostMessage(msg);
    }

    terminate(): void {
        this.terminated = true;
        this.webSocket?.close();
    }

    workerPostMessage(msg: any): void {
        if (this.terminated) {
            return;
        }
        msg = JSON.stringify(msg);
        // console.log('server: outgoing message', msg);
        this.webSocket?.send(msg);
    }

    async handleRequest(request: Request): Promise<Response> {
        // To accept the WebSocket request, we create a WebSocketPair (which is like a socketpair,
        // i.e. two WebSockets that talk to each other), we return one end of the pair in the
        // response, and we operate on the other end. Note that this API is not part of the
        // Fetch API standard; unfortunately, the Fetch API / Service Workers specs do not define
        // any way to act as a WebSocket server today.
        let pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // We're going to take pair[1] as our end, and return pair[0] to the client.
        await this.handleSession(server);

        // Now we return the other end of the pair to the client.
        return new Response(null, { status: 101, webSocket: client });
    }

    async handleSession(webSocket: WebSocket) {
        // Accept our end of the WebSocket.
        webSocket.accept();

        this.webSocket = webSocket;

        webSocket.addEventListener('message', (e: MessageEvent) => {
            const message =
                typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
            // console.log('server: incoming message', message);

            this.postMessage(JSON.parse(message));
        });

        // On "close" and "error" events, unset the WebSocket.
        let closeOrErrorHandler = () => {
            this.webSocket = undefined;
        };
        webSocket.addEventListener('close', closeOrErrorHandler);
        webSocket.addEventListener('error', closeOrErrorHandler);
    }
}

const worker: ExportedHandler = {
    fetch: (request: Request) => new Worker().handleRequest(request)
};
export default worker;
