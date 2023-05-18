import Vips from '../wasm-vips/lib/vips.js';

// @ts-expect-error non standard module
import module from '../wasm-vips/lib/vips.wasm';

export interface Env {
    WORKER: Fetcher;
}

export async function handleRequest(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const { WORKER } = env;

    // @ts-expect-error ignore
    globalThis.Worker = new Proxy(class { }, {
        construct(_target, _args) {
            let webSocket: WebSocket;

            let onmessage: (ev: MessageEvent) => any;
            let onerror: (ev: ErrorEvent) => any;
            let customProps: any = {};

            return new Proxy(WORKER, {
                set: (_fetchTarget: Fetcher, prop: string | symbol, value, _receiver) => {
                    switch (prop) {
                        case 'onmessage':
                            onmessage = (e: MessageEvent) => {
                                const message =
                                    typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
                                // console.log('client: incoming message', message);
                                value({ data: JSON.parse(message) });
                            };
                            return true;
                        case 'onerror':
                            onerror = (e: ErrorEvent) => value(e);
                            return true;
                        default:
                            customProps[prop] = value;
                            return true;
                    }
                },
                get: (fetchTarget: Fetcher, prop: string | symbol, _receiver) => {
                    if (customProps.hasOwnProperty(prop)) {
                        // console.log(`Get value of ${String(prop)}: `, customProps[prop]);
                        return customProps[prop];
                    }
                    if (prop !== 'postMessage' && prop !== 'terminate') {
                        return false;
                    }

                    return new Proxy((value: any) => {
                        if (!value) {
                            return webSocket.close();
                        }

                        value = JSON.stringify(value);
                        // console.log('client: outgoing message', value);
                        return webSocket.send(value);
                    }, {
                        apply: async (sendFunc, _thisArg, args: any[]) => {
                            if (!webSocket) {
                                const res = await fetchTarget.fetch(new Request('https://fake-host/', {
                                    cf: request.cf, // https://github.com/remix-run/remix/issues/3640
                                    headers: { Upgrade: 'websocket' },
                                }));

                                webSocket = res.webSocket!!;
                                webSocket.accept();
                                webSocket.addEventListener('message', onmessage);
                                webSocket.addEventListener('error', onerror);
                            }

                            sendFunc(args[0]);
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
    /*const buffer = im.jpegsaveBuffer();*/
    const json = JSON.stringify({
        width: im.width,
        height: im.height,
        space: im.interpretation,
        channels: im.bands,
        depth: im.format,
        // FIXME(kleisauke): Fails with: `Worker exceeded CPU time limit.`
        // average: im.avg()
    });
    im.delete();
    vips.shutdown();

    // Create a new response with the image bytes
    /*let response = new Response(buffer);
    response.headers.set('Content-Type', 'image/jpeg');*/

    // Create a new response with the JSON string.
    let response = new Response(json);
    response.headers.set('Content-Type', 'application/json');
    return response;
}

const worker: ExportedHandler<Env> = { fetch: handleRequest };
export default worker;
