"""Write one summary per loom-fun model, named after its checkpoint: summaries/<checkpoint file stem>.json.

Reads each repo's info.json (schema loom-card/1, loom-skills/skills/loom-benchmark/scripts/card/info_schema.json)
and writes the same keys for every model. A value that isn't known is null, never left out.

    python summarize_info.py [--org loom-fun] [--out summaries]
"""
import argparse
import json
import os
import sys

from huggingface_hub import HfApi, hf_hub_download

SCHEMA = "loom-summary/1"
CARD_SCHEMA = "loom-card/1"
METRICS = ["decode", "decode_2k", "decode_32k", "prefill_1k", "prefill_2k", "prefill_8k", "prefill_16k",
           "prefill_32k", "streams4"]


def stem(file):
    name = file.replace("\\", "/").rsplit("/", 1)[-1]
    return name[:-len(".gguf")] if name.lower().endswith(".gguf") else name


def source(s, full=False):
    if s is None:
        return None
    out = {"repo": s["repo"], "file": s["file"], "quant": s["quant"]}
    if full:
        out.update(revision=s["revision"], sha256=s["sha256"], size=s["size"])
    return out


def evidence(e):
    return None if e is None else {"kind": e["kind"], "run": e["run"], "url": e["url"]}


def summarize(card, revision):
    perf, ctx = card["performance"], card["context"]
    metrics = {}
    order = METRICS + sorted(set(perf["metrics"]) - set(METRICS))
    for m in (m for m in order if m in perf["metrics"]):
        v = perf["metrics"][m]
        loom, base = v["loom"], v["llamacpp"]
        metrics[m] = {
            "loom": loom,
            "llamacpp": base,
            "speedup": round(loom / base, 2) if loom is not None and base else None,
        }
    gates = {g["name"]: g["status"] for g in card["gates"]}
    counts = {s: sum(1 for v in gates.values() if v == s) for s in ("pass", "fail", "unknown", "n/a")}
    return {
        "schema": SCHEMA,
        "checkpoint": stem(card["checkpoint"]["file"]),
        "name": card["name"],
        "repo": card["repo"],
        "revision": revision,
        "license": card["license"],
        "service": {"kind": card["service"]["kind"], "endpoint": card["service"]["endpoint"]},
        "weights": {
            "checkpoint": source(card["checkpoint"], full=True),
            "drafter": source(card["drafter"]),
            "projector": source(card["projector"]),
        },
        "serve": {
            "device": card["serve"]["device"],
            "memory_bytes": card["serve"]["memory_bytes"],
            "context_tokens": ctx["tokens"],
            "rows": ctx["rows"],
            "max_tokens": ctx["max_tokens"],
        },
        "features": {k: v["status"] for k, v in sorted(card["features"].items())},
        "performance": {
            "date": perf["date"],
            "llamacpp_build": perf["llamacpp_build"],
            "drafting": {"loom": perf["drafting"]["loom"], "llamacpp": perf["drafting"]["llamacpp"]},
            "source": evidence(perf["source"]),
            "metrics": metrics,
            "not_applicable": list(perf["not_applicable"]),
        },
        "gates": {"summary": counts, "status": gates},
    }


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--org", default="loom-fun")
    p.add_argument("--out", default="summaries")
    a = p.parse_args()

    api = HfApi()
    os.makedirs(a.out, exist_ok=True)
    written = {}
    for model in sorted(api.list_models(author=a.org), key=lambda m: m.id.lower()):
        info = api.model_info(model.id, files_metadata=False)
        if "info.json" not in {s.rfilename for s in info.siblings}:
            print(f"skip {model.id}: no info.json", file=sys.stderr)
            continue
        with open(hf_hub_download(model.id, "info.json", revision=info.sha), encoding="utf-8") as f:
            card = json.load(f)
        if card.get("schema") != CARD_SCHEMA:
            sys.exit(f"{model.id}: info.json schema is {card.get('schema')!r}, expected {CARD_SCHEMA!r}")
        summary = summarize(card, info.sha)
        name = summary["checkpoint"] + ".json"
        if name.lower() in written:
            sys.exit(f"{model.id} and {written[name.lower()]} have the same checkpoint {summary['checkpoint']}")
        written[name.lower()] = model.id
        with open(os.path.join(a.out, name), "w", encoding="utf-8", newline="\n") as f:
            json.dump(summary, f, indent=2)
            f.write("\n")
        print(f"{model.id} -> {os.path.join(a.out, name)}")


if __name__ == "__main__":
    main()
