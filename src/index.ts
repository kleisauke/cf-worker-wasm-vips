import { DurableWorker } from './worker-polyfill';
import Vips from '../wasm-vips/lib/vips.js';

// @ts-expect-error non standard module
import module from '../wasm-vips/lib/vips.wasm';

export interface Env {
    WORKER: DurableObjectNamespace;
}

export async function handleRequest(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const { WORKER } = env;

    // @ts-expect-error ignore
    globalThis.Worker = new Proxy(DurableWorker, {
        construct(_target, _args) {
            return new Proxy(WORKER.get(WORKER.newUniqueId()), {
                get(stubTarget, propKey, _receiver) {
                    if (propKey !== 'postMessage') {
                        return false;
                    }

                    return new Proxy(function () {}, {
                        apply(_dummyFunc, _thisArg, args) {
                            const body = JSON.stringify(args[0], (_k, v) => {
                                // FIXME(kleisauke): Pass the whole Webassembly memory (64MB) to fetch?
                                if (v instanceof WebAssembly.Memory) {
                                    console.error('Webassembly memory length: ' + v.buffer.byteLength);
                                    v = new TextDecoder().decode(v.buffer);
                                }
                                // FIXME(kleisauke): How should we (de)serialize this?
                                if (v instanceof WebAssembly.Module) {
                                    console.error('Webassembly exports: ');
                                    console.error(WebAssembly.Module.exports(v));
                                }
                                return v;
                            });

                            return stubTarget.fetch('https://fake-host/postMessage', {
                                method: "POST",
                                body
                            });
                        }
                    });
                }
            })
        }
    });

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
}

const worker: ExportedHandler<Env> = { fetch: handleRequest };

// Ensure we export the DurableWorker class
export { DurableWorker };
export default worker;
