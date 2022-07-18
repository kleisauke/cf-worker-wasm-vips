# cf-worker-wasm-vips

An experiment with running [wasm-vips](https://github.com/kleisauke/wasm-vips)
on [Cloudflare Workers](https://workers.cloudflare.com/).

> **Warning**: Currently fails with:
>
> ```
> worker.js onmessage() captured an uncaught exception: RuntimeError: memory access out of bounds
> RuntimeError: memory access out of bounds
>    at g_thread_proxy (wasm://wasm/0281634a:wasm-function[6132]:0x3c2b79)
>    at h.invokeEntryPoint (polyfill.js:1816:23)
>    at onmessage (polyfill.js:4353:35)
>    at callFun (polyfill.js:4404:9)
>    at Worker2.runPostMessage (polyfill.js:4410:7)
> ```
>
> Since the `WebAssembly.Memory` in [the Web Worker polyfill](
> lib/polyfill.ts) is not shared with the worker that instantiated
> wasm-vips. See this `FIXME`:
> https://github.com/kleisauke/cf-worker-wasm-vips/blob/5a267a7ca753e38975ddbc2c68431e920c490534/lib/polyfill.ts#L64
>
> Cloudflare only allows to pass a string or binary data via
> [WebSocket connections](
> https://github.com/cloudflare/workers-types/blob/38b7e0fba83f01654a00b0d805cd01211a419f3d/index.d.ts#L1884),
> which won't work for [Emscripten's pthread](
> https://emscripten.org/docs/porting/pthreads.html) integration.
> It requires an API that allows sharing Wasm memory between workers.
