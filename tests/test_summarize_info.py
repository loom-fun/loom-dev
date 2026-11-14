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
            self.assertFalse({"needle", "needle_full"} & set(gates), name)
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
        # a card whose Strix section also holds results: the top level is Strix Halo's, R9700 is listed under devices
        r9700, model, lock, _ = load("v3-ggml-org-Qwen3.6-35B-A3B")
        strix_card, _, _, _ = load("v2-unsloth-gemma-4-12B-it")
        card = copy.deepcopy(r9700)
        strix = {k: strix_card[k] for k in ("gates", "performance", "roofline")}
        card["sources"].update(strix_card["sources"])
        card["devices"]["strix-halo"] = strix
        out = S.summarize(card, model, lock, "rev", "lic")
        self.assertEqual(out["primary_device"], "strix-halo")
        r = out["devices"]["radeon-r9700"]
        self.assertIsNone(r["state"])
        self.assertIsNotNone(r["performance"]["devlab"]["metrics"]["decode"]["loom"])
        self.assertEqual(sum(r["gates"]["summary"].values()), len(r["gates"]["status"]))
        # the top level equals what the /2 card alone gives
        alone = S.summarize({**strix_card, "card": card["card"]}, model, lock, "rev", "lic")
        for k in ("performance", "gates"):
            self.assertEqual(out[k], alone[k])

    def test_unknown_schema_is_unusable(self):
        self.assertNotIn("loom-card/9", S.CARD_SCHEMAS)
        self.assertEqual(S.CARD_SCHEMAS, ("loom-card/2", "loom-card/3"))


if __name__ == "__main__":
    unittest.main()
