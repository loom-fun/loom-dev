"""summarize_info.summarize on real cards: loom-card/2 (published loom-fun repos) and loom-card/3 (loom-fun-staging).

Each tests/fixtures/<name>/ holds a card's info.json, model.json, model.json.lock and expected.json.
v2-*: expected.json is what the loom-card/2-only summarize_info.py wrote, minus the retired needle gates, so a /2
card's summary has not changed otherwise. v3-*: the summary of a loom-card/3 card (reviewed by hand).

    python -m unittest discover -s tests
"""
import copy
import glob
import json
import os
import sys
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
try:
    import huggingface_hub  # noqa: F401
except ImportError:   # summarize() needs no network; the module only imports the client at the top
    stub = types.ModuleType("huggingface_hub")
    stub.HfApi = stub.hf_hub_download = None
    sys.modules["huggingface_hub"] = stub
import summarize_info as S  # noqa: E402


def load(name):
    d = os.path.join(HERE, "fixtures", name)
    out = []
    for f in ("info.json", "model.json", "model.json.lock", "expected.json"):
        with open(os.path.join(d, f), encoding="utf-8") as fh:
            out.append(json.load(fh))
    return out


NAMES = sorted(os.path.basename(p) for p in glob.glob(os.path.join(HERE, "fixtures", "*")))


class Summaries(unittest.TestCase):
    def test_golden(self):
        for name in NAMES:
            with self.subTest(name):
                card, model, lock, expected = load(name)
                self.assertEqual(S.summarize(card, model, lock, "rev", "lic"), expected)

    def test_retired_gates_gone(self):
        for name in NAMES:
            card, model, lock, _ = load(name)
            gates = S.summarize(card, model, lock, "rev", "lic")["gates"]["status"]
            self.assertFalse({"needle", "needle_full", "gufo"} & set(gates), name)
        self.assertNotIn("needle", S.GATES)

    def test_v2_has_no_device_keys(self):
        for name in (n for n in NAMES if n.startswith("v2-")):
            card, model, lock, _ = load(name)
            out = S.summarize(card, model, lock, "rev", "lic")
            self.assertNotIn("devices", out)
            self.assertNotIn("primary_device", out)

    def test_v3_strix_only_card_lists_r9700_state(self):
        card, model, lock, _ = load("v3-bartowski-Ornith-1.5-122B")
        out = S.summarize(card, model, lock, "rev", "lic")
        self.assertEqual(out["primary_device"], "strix-halo")
        self.assertEqual(out["devices"]["radeon-r9700"]["state"], "unsupported")

    def test_v3_both_gpus_with_results(self):
        # a current staging card holds results on both GPUs: the top level is Strix Halo's, R9700 is listed under devices
        card, model, lock, _ = load("v3-ggml-org-Qwen3.6-35B-A3B")
        out = S.summarize(card, model, lock, "rev", "lic")
        self.assertEqual(out["primary_device"], "strix-halo")
        r = out["devices"]["radeon-r9700"]
        self.assertIsNone(r["state"])
        self.assertIsNotNone(r["performance"]["devlab"]["metrics"]["decode"]["loom"])
        self.assertEqual(sum(r["gates"]["summary"].values()), len(r["gates"]["status"]))
        # the top level is the gpu_view of the Strix section, read like a /2 card
        alone = S.summarize(S.gpu_view(S.normalize(card), "strix-halo") | {"schema": "loom-card/2"}, model, lock, "rev", "lic")
        self.assertEqual(out["performance"], alone["performance"])

    def test_quickstart_and_shared_devices(self):
        # SDK 0.2 card with the RX 9070 XT (shares the R9700's section, no table of its own) and Strix Point
        card, model, lock, _ = load("v3-unsloth-Qwen3-8B")
        card = copy.deepcopy(card)
        card["devices"]["radeon-rx9070xt"] = {"state": "not_measured", "memory_bytes": 15000000000, "served_context": 18432,
                                              "shares_section_with": "radeon-r9700",
                                              "serve_args": ["--memory_bytes=15000000000", "--state_slab_bytes=4mib"]}
        card["devices"]["gfx1150"] = {"state": "not_measured", "serve_args": [], "served_context": 16384}
        readme = ("<details>\n<summary>AMD Radeon RX 9070 XT (gfx1201, 16 GB)</summary>\n\n```bash\n"
                  "loom-fetch huggingface:loom-fun/x-loom:chat-9070xt --materialize=copy --output=X\n"
                  "loom-serve --model=X '--device=amdgpu://?completion_spin_ns=4294967295' --memory_bytes=15000000000 --state_slab_bytes=4mib\n"
                  "```\n</details>\n<details>\n<summary>AMD Radeon 890M (gfx1150)</summary>\n```bash\n"
                  "loom-fetch huggingface:loom-fun/x-loom --materialize=copy --output=X\n"
                  "loom-serve --model=X '--device=amdgpu://?completion_spin_ns=4294967295'\n```\n</details>")
        out = S.summarize(card, model, lock, "rev", "lic", readme)
        x = out["devices"]["radeon-rx9070xt"]
        self.assertEqual((x["fits"], x["shares_section_with"], x["context_tokens"]), (True, "radeon-r9700", 18432))
        self.assertEqual(out["quickstart"]["radeon-rx9070xt"],
                         {"preset": "chat-9070xt", "serve_args": ["--memory_bytes=15000000000", "--state_slab_bytes=4mib"]})
        self.assertEqual(out["quickstart"]["gfx1150"], {"preset": None, "serve_args": []})
        self.assertTrue(out["devices"]["gfx1150"]["fits"])
        self.assertNotIn("quickstart", S.summarize(card, model, lock, "rev", "lic"))

    def test_gufo_gate_is_dropped(self):
        card, model, lock, _ = load("v3-unsloth-Qwen3-8B")
        card = copy.deepcopy(card)
        gate = dict(card["devices"]["strix-halo"]["gates"]["logits"])
        card["devices"]["strix-halo"]["gates"]["gufo"] = gate
        self.assertNotIn("gufo", S.summarize(card, model, lock, "rev", "lic")["gates"]["status"])

    def test_logits_gate(self):
        # judged where the card has it; n/a for a package with no llm.logits (Flash-Next); a /2 card never gets the key
        card, model, lock, _ = load("v3-unsloth-Qwen3-8B")
        self.assertEqual(S.summarize(card, model, lock, "rev", "lic")["gates"]["status"]["logits"], "pass")
        card, model, lock, _ = load("v3-unsloth-Qwen3.8-Flash-Next")
        out = S.summarize(card, model, lock, "rev", "lic")
        self.assertEqual(out["gates"]["status"]["logits"], "n/a")
        self.assertNotIn("logits", S.summarize(*load("v2-unsloth-gemma-4-12B-it")[:3], "rev", "lic")["gates"]["status"])
        # a package that declares the capability but has no evidence yet is unknown
        card, model, lock, _ = load("v3-bartowski-Ornith-1.5-9B")
        card = copy.deepcopy(card)
        for d in card["devices"].values():
            d["gates"].pop("logits", None)
        self.assertEqual(S.summarize(card, model, lock, "rev", "lic")["gates"]["status"]["logits"], "unknown")

    def test_remeasure(self):
        card, model, lock, _ = load("v3-unsloth-Qwen3-8B")
        out = S.summarize(card, model, lock, "rev", "lic")
        self.assertEqual(out["remeasure"]["result"], "identical")
        self.assertTrue(out["remeasure"]["carried_programs"])
        self.assertEqual(out["devices"]["radeon-r9700"]["remeasure"]["result"], "identical")
        # no remeasure block (Flash-Next on Strix Halo): null, never left out
        card, model, lock, _ = load("v3-unsloth-Qwen3.8-Flash-Next")
        self.assertIsNone(S.summarize(card, model, lock, "rev", "lic")["remeasure"])

    def test_remeasure_improved_and_previous(self):
        card, model, lock, _ = load("v3-unsloth-Qwen3-8B")
        card = copy.deepcopy(card)
        d = card["devices"]["strix-halo"]
        d["remeasure"] = {**d["remeasure"], "result": "improved", "improved": {"decode": {"published": 1, "loom": 2, "runs": [2, 2]}},
                          "previous": dict(d["remeasure"])}
        rm = S.summarize(card, model, lock, "rev", "lic")["remeasure"]
        self.assertEqual(rm["improved"], ["decode"])
        self.assertEqual(rm["previous"]["result"], "identical")

    def test_v2_has_no_remeasure_key(self):
        for name in (n for n in NAMES if n.startswith("v2-")):
            self.assertNotIn("remeasure", S.summarize(*load(name)[:3], "rev", "lic"))

    def test_unknown_schema_is_unusable(self):
        self.assertNotIn("loom-card/9", S.CARD_SCHEMAS)
        self.assertEqual(S.CARD_SCHEMAS, ("loom-card/2", "loom-card/3"))


if __name__ == "__main__":
    unittest.main()
