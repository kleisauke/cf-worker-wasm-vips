// CloudFlare WebWorker polyfill based on https://github.com/nolanlawson/pseudo-worker
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
// - Remove `addEventListener`, `removeEventListener`; not needed by Emscripten.
// - Remove `transfer` argument in `postMessage`; not needed by Emscripten when building without OffscreenCanvas support.

export class DurableWorker implements DurableObject {
    onmessage: ((ev: MessageEvent) => any) | undefined;
    onerror: ((ev: ErrorEvent) => any) | undefined;

    script;
    initialized = false;
    terminated = false;

    workerSelf: any = {
        onmessage: undefined,
        onerror: undefined // unused by Emscripten
    };

    constructor(_path: string) {
        globalThis.postMessage = (msg) => this.workerPostMessage(msg);
        globalThis.close = () => this.close();
        // @ts-expect-error ignore
        globalThis.performance = {}
        globalThis.performance.now = () => Date.now();
        this.script = import('../wasm-vips/lib/vips.worker.js');
    }

    private postError(err: any): void {
        const callFun = (listener: (ev: ErrorEvent) => any) => {
            listener({
                type: 'error',
                error: err,
                message: err.message
            } as ErrorEvent);
        };
        if (typeof this.onerror === 'function') {
            callFun(this.onerror);
        }
        if (typeof this.workerSelf.onerror === 'function') {
            callFun(this.workerSelf.onerror);
        }
    }

    private runPostMessage(msg: any): void {
        const callFun = (listener: (ev: MessageEvent) => any) => {
            try {
                listener({ data: msg } as MessageEvent);
            } catch (err) {
                this.postError(err);
            }
        }
        if (typeof this.workerSelf.onmessage === 'function') {
            callFun(this.workerSelf.onmessage);
        }
    }

    async postMessage(msg: any): Promise<void> {
        if (typeof msg === 'undefined') {
            throw new Error('postMessage() requires an argument');
        }
        if (this.terminated) {
            return;
        }
        if (!this.initialized) {
            this.workerSelf.onmessage = (await this.script).onmessage;
            this.initialized = true;
        }
        this.runPostMessage(msg);
    }

    close(): void {
        this.terminated = true;
    }

    workerPostMessage(msg: any): void {
        if (this.terminated) {
            return;
        }
        const callFun = (listener: (ev: MessageEvent) => any) => {
            try {
                listener({ data: msg } as MessageEvent);
            } catch (err) {
                this.postError(err);
            }
        }
        if (typeof this.onmessage === 'function') {
            callFun(this.onmessage);
        }
    }

    async fetch(request: Request): Promise<Response> {
        let url = new URL(request.url);
        let path = url.pathname.slice(1).split('/');

        switch (path[0]) {
            case 'postMessage':
                await this.postMessage(await request.json());
                return new Response('Done!');
            default:
                return new Response('Not found', { status: 404 });
        }
    }

    async alarm(): Promise<void> {
    }
}
