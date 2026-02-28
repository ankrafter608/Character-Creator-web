# Multi-Step Wiki Fetching Strategy (Keyword / Map-Reduce)

## The Problem
When dealing with massive wikis (e.g., Type-Moon with 5000+ pages), providing the AI with the entire list of titles causes Attention Drift and Chain-of-Thought (CoT) loops. The AI crashes or spams repeating messages. Standard MediaWiki search (`list=search`) is often inaccurate or misses crucial pages.

## The Solution: Two-Step "Smart" Fetching
Instead of dumping all data or relying on basic search, we split the process:

### 1. Keyword Extraction & Local Filtering
- **AI Action:** The AI decides what it needs and uses a new tool: `<wiki_extract_keywords keywords="Saber, Excalibur, Avalon" />`.
- **System Action:**
  1. The system fetches *all* page titles from the wiki using `list=allpages` (up to a limit, e.g., 5000) and caches them.
  2. The system filters this massive list locally using the AI's keywords.
  3. The system returns the highly filtered, relevant list (e.g., 20-50 pages) to the AI.
- **AI Behavior:** The AI *must* stop and wait to read this filtered list.

### 2. Selection & Download
- **AI Action:** After reviewing the filtered list, the AI uses `<wiki_download_pages pages="Artoria Pendragon, Excalibur" />`.
- **System Action:** The system fetches the exact content of those selected pages, cleans the HTML, and adds them to the Knowledge Base (KB).
- **AI Behavior:** The AI reads the summaries of the downloaded pages and proceeds with the character creation.

## Agent Yielding (Pausing)
The AI is instructed to stop its generation after issuing a tool command. This is crucial:
- It allows the user to see what the AI is doing (e.g., "Ah, it's searching for these keywords").
- It breaks the CoT loop by forcing a new context window frame for the results.

## UI Integration
A settings gear (⚙️) is added to the Autonomous Mode UI, allowing the user to toggle between:
- **Smart Strategy (Keywords):** The new multi-step approach.
- **Legacy Strategy (Search):** The old `wiki_search` approach.

## Update: Handling Filename Hallucinations
**Problem:** The AI often attempts to read or clean files by guessing their names after downloading, e.g., guessing `Fate_stay_night_summary.txt` instead of the actual downloaded file `Fate/stay night.txt`.
**Solution:**
1. Added a `findFileFuzzy` helper in `ToolManager.ts` that automatically resolves underscores, lowercase mismatches, and hallucinatory suffixes like `_summary`.
2. Updated the `clean_file` and `read_file` tool descriptions with explicit warnings: `WARNING: File names DO NOT change after cleaning. Do NOT add "_summary" to the name.`
