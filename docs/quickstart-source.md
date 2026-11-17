# Source card quick starts

The hourly summary workflow reads each README at the same commit as the rest of its model summary. `summarize_info.quickstart` extracts the `## Quick start` section, keeping fenced commands and surrounding notes in order. Per-GPU `<details>` blocks identify their GPUs; a single fenced layout belongs only to the card's primary measured GPU. Shared notes and request examples remain available on each GPU.

The homepage and model drawers render these source blocks. The homepage's three short commands are exact lines from the same blocks; its expanded instructions include all startup notes and request examples. Text is escaped before rendering, including source Markdown and HTML. Every quick start links to its pinned source README.

There is no SDK, output path, request body, flag, preset or memory-budget fallback. Missing or incomplete extraction shows an unavailable message and source link. Old summaries with only preset/argument fragments also fail visibly until regenerated. Changing a published card flows through the scheduled summary/data refresh without editing frontend code.

`tests/quickstart_cards/` contains Quick start excerpts read from the public loom-fun cards on 2026-11-17: Qwen3-0.6B (GPU details), Ornith-1.5-122B and Flash-Next (single GPU with stock-host notes), and Quark AWQ MXFP4 (single GPU with legacy SDK and explicit model.json path). Tests cover preserved notes, GPU isolation, incomplete extraction, escaped output, and card SDK/path/flag/request changes flowing into rendered output.

Run `python3 -m unittest discover -s tests` and `node --test tests/test_baselines.js`.

A README-only refresh can update instructions while keeping measured model data frozen. `refresh_quickstart(summary, readme, source_revision)` changes only `quickstart`; each GPU block carries its own `source_revision`, and its source link uses that README pin. The summary's top-level `revision` continues to identify its unchanged model and measurement inputs. A normal whole-summary refresh pins both sources to the same commit. Existing blocks without a separate README pin use the summary revision.
