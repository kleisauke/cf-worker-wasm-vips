# cf-worker-wasm-vips

An experiment with running [wasm-vips](https://github.com/kleisauke/wasm-vips)
on [Cloudflare Workers](https://workers.cloudflare.com/).

Current fails with:

```
Uncaught (in promise) ReferenceError: Worker is not defined
```

Since the Web Workers API is currently unavailable on Cloudflare Workers. See:
https://workers.js.org/#browser-apis
