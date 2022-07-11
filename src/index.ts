import { PseudoWorker } from './worker-polyfill';
import Vips from '../wasm-vips/lib/vips.js';

// @ts-expect-error non standard module
import module from '../wasm-vips/lib/vips.wasm';

export interface Env {
    // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
    // MY_KV_NAMESPACE: KVNamespace;
    //
    // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
    // MY_DURABLE_OBJECT: DurableObjectNamespace;
    //
    // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
    // MY_BUCKET: R2Bucket;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        // @ts-expect-error ignore
        globalThis.Worker = PseudoWorker;

        const vips = await Vips({
            instantiateWasm: (imports, successCallback) => {
                let instance = new WebAssembly.Instance(module, imports);
                successCallback(instance, module);
                return instance.exports;
            },
            locateFile: (path, scriptDirectory) => path,
        });
        const im = vips.Image.black(100, 100);
        const buffer = im.jpegsaveBuffer();
        im.delete();

        // Create a new response with the image bytes
        let response = new Response(buffer);
        response.headers.set("Content-Type", "image/jpeg");
        return response;
    },
};
