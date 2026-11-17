## Quick start

```bash
pipx install "hrx-loom[hf]==0.1.0"
loom-fetch https://huggingface.co/loom-fun/amd-Qwen3.8-27B-Quark-AWQ-MXFP4-loom/resolve/main/model.json --preset=chat-r9700 --materialize=copy --output=qwen3.8-27b-mxfp4
loom-serve --model=qwen3.8-27b-mxfp4/model.json '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed
```

The server listens on `127.0.0.1:8080` and answers OpenAI-style `/v1/chat/completions` requests.

On the AMD Radeon AI PRO R9700, the package's preset sizes the memory pool (`--pool_backing=fixed` commits it up front): this package serves up to 110,592 tokens per request there (its native context is 262,144); the package files are the same on every GPU.

On the AMD Radeon AI PRO R9700, the Quick start fetches the `chat-r9700` preset of `model.json`: the default preset with `context_capacity` 110,592, `pool_capacity` 110,592 for its 32 GB. The programs, weights and tokenizer are the same.

AMD Ryzen AI Max+ 395 "Strix Halo" (gfx1151): not a target of this package, not measured: the fast path is FP8 WMMA (gfx12); gfx11 (Strix Halo) has none, and the GGUF Q4_K_M card serves it. Owner decision 2026-11-15: MXFP4 safetensors cards have no Strix rows.
