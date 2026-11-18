## Quick start

<details>
<summary>AMD Ryzen AI Max+ 395 "Strix Halo" (gfx1151)</summary>

```bash
pipx install "hrx-loom[hf]==0.2.0"
loom-fetch huggingface:loom-fun/example-loom:chat --materialize=copy --output=Example
loom-serve --model=Example/model.json '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed
```

`--pool_backing=fixed` commits the preset memory pool up front.

</details>

<details>
<summary>AMD Radeon AI PRO R9700 (gfx1201, 32 GB)</summary>

```bash
pipx install "hrx-loom[hf]==0.2.0"
loom-fetch huggingface:loom-fun/example-loom:chat-r9700 --materialize=copy --output=Example
loom-serve --model=Example/model.json '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed
```

On this GPU, the preset sizes the pool for the package.

</details>

## Send a request

In another terminal (optional thinking is turned off):

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "exact-selector", "messages": [{"role": "user", "content": "Hello"}], "chat_template_kwargs": {"enable_thinking": false}}'
```

## Benchmarks

DO NOT SHOW
