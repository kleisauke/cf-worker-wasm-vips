# cf-worker-wasm-vips

An experiment with running [wasm-vips](https://github.com/kleisauke/wasm-vips)
on [Cloudflare Workers](https://workers.cloudflare.com/).

Current fails with:

```
worker.js onmessage() captured an uncaught exception: RuntimeError: memory access out of bounds
RuntimeError: memory access out of bounds
    at null.<anonymous> (wasm://wasm/01339be6:1:809138)
    at null.<anonymous> (wasm://wasm/01339be6:1:32441)
    at null.<anonymous> (wasm://wasm/01339be6:1:1158167)
    at null.<anonymous> (wasm://wasm/01339be6:1:120457)
    at null.<anonymous> (wasm://wasm/01339be6:1:2604204)
    at Object.k.invokeEntryPoint (/home/kleisauke/cf-worker-wasm-vips/wasm-vips/lib/vips.js:81:326)
    at onmessage (/home/kleisauke/cf-worker-wasm-vips/wasm-vips/lib/vips.worker.js:1:1585)
    at callFun (/home/kleisauke/cf-worker-wasm-vips/src/worker-polyfill.ts:47:17)
    at DurableWorker.runPostMessage (/home/kleisauke/cf-worker-wasm-vips/src/worker-polyfill.ts:53:13)
    at DurableWorker.postMessage (/home/kleisauke/cf-worker-wasm-vips/src/worker-polyfill.ts:82:14)
```

Since the `WebAssembly.Memory` in `DurableWorker` is not shared with the main thread.
