---
description: Important project conventions and rules to remember
---

# Important Notes

## Preset System — DO NOT write prompts in App.tsx

The user manages ALL AI behavior rules, quality guidelines, and style instructions through their **preset system** (`combined_style_prompt.txt` and similar files).

**The App.tsx system prompts must ONLY contain:**
- Structural/functional information (e.g., serialized current data so AI sees it)
- JSON output format (so auto-parsing works)
- Minimal functional rules (e.g., "do not duplicate", "do not include IDs")

**NEVER put quality rules, style rules, tag naming rules, token budget rules, or any creative instructions into App.tsx system prompts.** Those belong in the user's preset system.
