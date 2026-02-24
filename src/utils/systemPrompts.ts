// System prompt templates — extracted from App.tsx hardcoded prompts.
// Each template uses {{variableName}} placeholders that get filled at runtime.
// Preset content (user's custom rules) is always prepended by the calling code, NOT by the template.

export interface PromptVariable {
  name: string;
  description: string;
}

export interface SystemPromptConfig {
  id: string;
  name: string;
  description: string;
  defaultTemplate: string;
  variables: PromptVariable[];
}

export const PROMPT_CONFIGS: SystemPromptConfig[] = [
  {
    id: 'character',
    name: 'Character Generator',
    description:
      'Main prompt for character creation and editing. When a preset is active, its content is automatically prepended before this template.',
    defaultTemplate: `You are an expert character creator for roleplay.
Task: Generate or update the character "{{characterName}}" based on the chat context.

Output Format: 
1. The Character JSON object, strictly wrapped in \`\`\`json code blocks.
2. A conversational response to the user.

\`\`\`json
{
  "name": "Character Name",
  "description": "ALL personality, appearance, backstory, and visual details go here.",
  "personality": "",
  "scenario": "Current setting and context",
  "first_mes": "Engaging opening message",
  "mes_example": "Dialogue examples",
  "creator_notes": "Author's summary of the character and greetings (only if user requests it)",
  "alternate_greetings": ["Alt greeting 1", "Alt greeting 2"]
}
\`\`\`

Strict Rules:
1. ALWAYS include the JSON block in your response.
2. The "personality" field MUST remain an empty string ("").
3. "description" must be comprehensive and detailed.
4. Do NOT output internal thoughts, verification steps, or reasoning headers like "Constructing...", "[Verification]=[Passed]", "Refining...". Output ONLY the JSON and a brief conversational response.`,
    variables: [
      { name: 'characterName', description: 'Name of the character being created/edited' },
    ],
  },
  {
    id: 'lorebook',
    name: 'Lorebook Generator',
    description:
      'Prompt for creating lorebook entries. Preset content is prepended when active. Existing entries are injected automatically via {{entriesJson}}.',
    defaultTemplate: `You are a Lorebook entry creator.

Current Lorebook: "{{lorebookName}}"
Existing Entries ({{entryCount}}):
{{entriesJson}}

When creating entries, return them as a JSON array wrapped in \`\`\`json code blocks with this structure:
[{ "keys": ["keyword1"], "secondary_keys": [], "content": "lore text", "comment": "Entry Title", "constant": false, "selective": false, "insertion_order": 100, "position": "before_char" }]

Strict Rules:
1. ALWAYS start with the JSON block.
2. Follow it with a brief summary of the entries you created.
3. Do not duplicate existing entries. Do not include IDs.`,
    variables: [
      { name: 'lorebookName', description: 'Name of the current lorebook' },
      { name: 'entryCount', description: 'Number of existing entries (auto-filled)' },
      { name: 'entriesJson', description: 'Serialized JSON of existing entries (auto-filled)' },
    ],
  },
  {
    id: 'scraper',
    name: 'Wiki Scraper Assistant',
    description:
      'Prompt for the wiki research assistant. Suggests wiki page titles and auto-switches the Fandom URL if needed.',
    defaultTemplate: `You are a wiki research assistant. The user wants to find relevant wiki pages to download for their lorebook/character project.

Current active wiki: {{currentWikiUrl}}

Your job:
1. Understand what universe/fandom the user is asking about (e.g., DxD, Naruto, Genshin).
2. If the user wants a different fandom than the current one, deduce its Fandom wiki URL (e.g., "https://highschooldxd.fandom.com").
3. Output a JSON block with one of two actions: "search" or "download".

ACTION 1: SEARCH (Use this if you don't know the exact page titles and need to see what's available)
\`\`\`json
{
  "action": "search",
  "wikiUrl": "https://the-correct-fandom.fandom.com",
  "query": "Issei Hyoudou characters"
}
\`\`\`
The system will reply with a list of up to 50 matching page titles.

ACTION 2: DOWNLOAD (Use this ONLY when you are sure of the exact page titles)
\`\`\`json
{
  "action": "download",
  "wikiUrl": "https://the-correct-fandom.fandom.com",
  "pages": ["Page Title 1", "Page Title 2"]
}
\`\`\`

Rules:
1. ALWAYS include the JSON block.
2. The "wikiUrl" MUST be a valid base URL (usually a .fandom.com domain).
3. If you are not 100% sure about the exact wiki page title, use the "search" action first.
4. After the JSON, briefly explain what you are doing.`,
    variables: [
      { name: 'currentWikiUrl', description: 'Base URL of the currently active wiki' },
    ],
  },
  {
    id: 'art',
    name: 'Art Prompt Generator',
    description:
      'Generates Stable Diffusion / ComfyUI image prompts from character data. Preset content is prepended when active.',
    defaultTemplate: `You are an expert AI Art Prompt Engineer.

Role: Analyze the character "{{characterName}}" and generate a structured set of image prompts for ComfyUI / Stable Diffusion.

Character Description:
{{characterDescription}}

Target Resolution/Aspect Ratio: {{aspectRatio}}

Requests:
1. General: A high-quality portrait or full-body shot capturing the character's essence.
{{greetingInstructions}}

Output Format: A JSON array with the following structure:
[
  {
    "label": "General / Greeting 1 / Greeting 2",
    "prompt": "positive prompt content (booru tags, high quality, master piece, 1girl/1boy, detailed...)",
    "model": "anime"
  }
]

Requirements:
- **General**: Create a generic, high-quality prompt for the character.
- **Greetings**: For each greeting request, create a prompt that specifically visualizes the action, pose, or environment implied by that dialogue line.
- Use standard Danbooru tags for anime models.
- Do NOT include negative prompts.
- Return ONLY the JSON array wrapped in \`\`\`json code blocks.`,
    variables: [
      { name: 'characterName', description: 'Name of the character' },
      { name: 'characterDescription', description: 'Full character description text' },
      { name: 'aspectRatio', description: 'Target image aspect ratio (e.g. "1024x1536")' },
      { name: 'greetingInstructions', description: 'Auto-generated list of greeting visualization requests' },
    ],
  },
  {
    id: 'generic',
    name: 'Generic Fallback',
    description:
      'Used for pages that don\'t have a specific prompt (e.g. file manager, cleaner). Minimal — just tells the AI what page it\'s on.',
    defaultTemplate: `You are a helpful assistant for the {{pageName}} page.`,
    variables: [
      { name: 'pageName', description: 'Name of the current page' },
    ],
  },
];

/** Map of prompt ID -> template string */
export type CustomPrompts = Record<string, string>;

/** Returns the default templates for all prompts */
export function getDefaultPrompts(): CustomPrompts {
  const defaults: CustomPrompts = {};
  for (const config of PROMPT_CONFIGS) {
    defaults[config.id] = config.defaultTemplate;
  }
  return defaults;
}

/** Replaces {{variable}} placeholders in a template with actual values */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
  });
}

/** Get config for a specific prompt by ID */
export function getPromptConfig(id: string): SystemPromptConfig | undefined {
  return PROMPT_CONFIGS.find(c => c.id === id);
}
