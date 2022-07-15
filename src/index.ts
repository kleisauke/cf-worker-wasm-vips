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
    globalThis.performance = {}
    // @ts-expect-error ignore
    globalThis.performance.now = () => Date.now();

    // @ts-expect-error ignore
    globalThis.Worker = new Proxy(DurableWorker, {
        construct(_target, _args) {
            let webSocket: WebSocket;

            let onmessage: (ev: MessageEvent) => any;
            let onerror: (ev: ErrorEvent) => any;
            let customProps: any = {};

            return new Proxy(WORKER.get(WORKER.newUniqueId()), {
                set: function (stubTarget, prop, value, _receiver) {
                    switch (prop) {
                        case 'onmessage':
                            onmessage = (e) => value(e);
                            return true;
                        case 'onerror':
                            onerror = (e) => value(e);
                            return true;
                        default:
                            customProps[prop] = value;
                            return true;
                    }
                },
                get: function (stubTarget, prop, _receiver) {
                    if (customProps.hasOwnProperty(prop)) {
                        // console.log(`Get value of ${String(prop)}: `, customProps[prop]);
                        return customProps[prop];
                    }
                    if (prop !== 'postMessage') {
                        return false;
                    }

                    return new Proxy(async function () {
                        const res = await stubTarget.fetch('https://fake-host/', {
                            headers: { Upgrade: 'websocket' },
                        });

                        let webSocket = res.webSocket!!;
                        webSocket.accept();
                        webSocket.addEventListener('message', onmessage);
                        webSocket.addEventListener('error', onerror);
                        return webSocket;
                    }, {
                        async apply(initFunc, _thisArg, args) {
                            if (!webSocket) {
                                webSocket = await initFunc();
                            }

                            const message = JSON.stringify(args[0]);
                            webSocket.send(message);
                        }
                    });
                }
            })
        }
    });

    const vips = await Vips({
        instantiateWasm: (imports, successCallback) => {
            // @ts-expect-error ignore
            let instance = new WebAssembly.Instance(module, imports);
            successCallback(instance, module);
            return instance.exports;
        },
        locateFile: (path, scriptDirectory) => path,
    });
    const im = vips.Image.black(100, 100);
    const json = JSON.stringify({
        width: im.width,
        height: im.height,
        space: im.interpretation,
        channels: im.bands,
        depth: im.format
    });
    im.delete();

    // Create a new response with the JSON string.
    let response = new Response(json);
    response.headers.set('Content-Type', 'application/json');
    return response;
}

const worker: ExportedHandler<Env> = { fetch: handleRequest };

// Ensure we export the DurableWorker class.
export { DurableWorker };
export default worker;
