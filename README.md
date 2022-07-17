# cf-worker-wasm-vips

An experiment with running [wasm-vips](https://github.com/kleisauke/wasm-vips)
on [Cloudflare Workers](https://workers.cloudflare.com/).

Current fails with:

```
✘ [ERROR] script exceeded time limit

✘ [ERROR] Uncaught (in response) Error: Worker exceeded CPU time limit.
```

When triggering a simple pixel loop (calculating the image average
on a 100x100 black image).
