# cf-worker-wasm-vips

An experiment with running [wasm-vips](https://github.com/kleisauke/wasm-vips)
on [Cloudflare Workers](https://workers.cloudflare.com/).

> **Warning**: wasm-vips in its current form can never run on Cloudflare workers.  
> See https://github.com/kleisauke/wasm-vips/issues/2#issuecomment-1187416552
> for details.

## Status

This experiment currently fails with:

```
worker.js onmessage() captured an uncaught exception: RuntimeError: memory access out of bounds
RuntimeError: memory access out of bounds
   at g_thread_proxy (wasm://wasm/0281634a:wasm-function[6132]:0x3c2b79)
   at h.invokeEntryPoint (polyfill.js:1816:23)
   at onmessage (polyfill.js:4353:35)
   at callFun (polyfill.js:4404:9)
   at Worker2.runPostMessage (polyfill.js:4410:7)
```

Since the `WebAssembly.Memory` in [the Web Worker polyfill](
lib/polyfill.ts) is not shared with the worker that instantiated
wasm-vips. See this `FIXME`:
https://github.com/kleisauke/cf-worker-wasm-vips/blob/9f0c4c837a7ca85b54ddeb26d97325c70bebda1b/lib/polyfill.ts#L60

Cloudflare only allows to pass a string or binary data via
[WebSocket connections](
https://github.com/cloudflare/workerd/blob/88863c169cecbd042e908c4af91669ff35b9529d/src/workerd/api/web-socket.h#L55),
which won't work for [Emscripten's pthread](
https://emscripten.org/docs/porting/pthreads.html) integration.
It requires an API that allows sharing Wasm memory between workers.
