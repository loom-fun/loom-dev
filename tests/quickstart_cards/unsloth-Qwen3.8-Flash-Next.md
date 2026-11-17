## Quick start

```bash
pipx install "hrx-loom[hf]==0.2.0"
loom-fetch huggingface:loom-fun/unsloth-Qwen3.8-Flash-Next-loom:vision-mtp --materialize=copy --output=Qwen3.8-Flash-Next-loom
loom-serve --model=Qwen3.8-Flash-Next-loom '--device=amdgpu://?completion_spin_ns=4294967295' --pool_backing=fixed
```

On a stock host (8 MiB memlock) start loom-serve as `systemd-run --user --pty --same-dir -p SystemCallFilter=~io_uring_setup -p SystemCallErrorNumber=ENOSYS loom-serve ...` (no root; IREE falls back to its POSIX proactor), or raise `ulimit -l`.

The server listens on `127.0.0.1:8080` and answers OpenAI-style `/v1/chat/completions` requests.

AMD Radeon AI PRO R9700 (gfx1201, 32 GB): this package does not fit its 32 GB (it needs about 118 GB).
