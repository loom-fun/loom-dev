## Quick start

Open your GPU and copy its commands.

<details>
<summary>AMD Ryzen AI Max+ 395 "Strix Halo" (gfx1151)</summary>

```bash
pipx install "hrx-loom[hf]==0.2.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3-0.6B-loom:chat --materialize=copy --output=Qwen3-0.6B
loom-serve --model=Qwen3-0.6B '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed --parameter_mode=preload
```

</details>

<details>
<summary>AMD Radeon AI PRO R9700 (gfx1201, 32 GB)</summary>

```bash
pipx install "hrx-loom[hf]==0.2.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3-0.6B-loom:chat-r9700 --materialize=copy --output=Qwen3-0.6B
loom-serve --model=Qwen3-0.6B '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed --parameter_mode=preload
```

</details>

<details>
<summary>Radeon gfx1201, 16 GB (RX 9070 XT, RX 9070)</summary>

```bash
pipx install "hrx-loom[hf]==0.2.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3-0.6B-loom:chat-16gb --materialize=copy --output=Qwen3-0.6B
loom-serve --model=Qwen3-0.6B '--device=amdgpu://?completion_spin_ns=4294967295' --memory_bytes=15000000000 --state_slab_bytes=4mib --weight_slab_bytes=64mib --parameter_mode=preload
```

</details>

`--parameter_mode=preload` only changes how the weights are loaded on the host, so the performance rows were measured without it unless their job served with it.

The server listens on `127.0.0.1:8080` and answers OpenAI-style `/v1/chat/completions` requests.
