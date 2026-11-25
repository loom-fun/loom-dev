## Quick start

Open your GPU and copy its commands.

<details>
<summary>AMD Ryzen AI Max+ 395 "Strix Halo" (gfx1151)</summary>

```bash
pipx install "hrx-loom[hf]==0.3.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3-0.6B-loom:chat --output=Qwen3-0.6B
loom-serve --model=Qwen3-0.6B '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed
```

- `completion_spin_ns=4294967295` enables active waiting for GPU completions (uses CPU while GPU work is in flight); the card's performance measurements use this setting.
- `--pool_backing=fixed` commits the preset's memory pool up front instead of growing elastic backing.

</details>

<details>
<summary>AMD Radeon AI PRO R9700 (gfx1201, 32 GB)</summary>

```bash
pipx install "hrx-loom[hf]==0.3.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3-0.6B-loom:chat-r9700 --output=Qwen3-0.6B
loom-serve --model=Qwen3-0.6B '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed
```

- `completion_spin_ns=4294967295` enables active waiting for GPU completions (uses CPU while GPU work is in flight); the card's performance measurements use this setting.
- `--pool_backing=fixed` commits the preset's memory pool up front instead of growing elastic backing.

</details>

<details>
<summary>Radeon gfx1201, 16 GB (RX 9070 XT, RX 9070)</summary>

```bash
pipx install "hrx-loom[hf]==0.3.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3-0.6B-loom:chat-16gb --output=Qwen3-0.6B
loom-serve --model=Qwen3-0.6B '--device=amdgpu://?completion_spin_ns=4294967295' --memory_bytes=15000000000 --state_slab_bytes=4mib --weight_slab_bytes=64mib
```

- `completion_spin_ns=4294967295` enables active waiting for GPU completions (uses CPU while GPU work is in flight); the card's performance measurements use this setting.
- `--memory_bytes` sets the serving memory budget for this GPU.
- `--state_slab_bytes` sets the allocation slab size for state memory.
- `--weight_slab_bytes` sets the allocation slab size for weight memory.

</details>
