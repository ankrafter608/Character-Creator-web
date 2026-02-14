export interface CharacterData {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    alternate_greetings: string[];
}

export interface ArtPrompt {
    id: string;
    label: string; // e.g. "Portrait Main", "Greeting 1"
    prompt: string;
    negative_prompt?: string;
    model?: string; // Optional: "anime", "realistic", etc.
}

export interface LorebookEntry {
    id: string;
    keys: string[];
    secondary_keys: string[];
    content: string;
    comment: string;
    enabled: boolean;
    constant: boolean;
    selective: boolean;
    insertion_order: number;
    position: 'before_char' | 'after_char';
}

export interface LorebookData {
    name: string;
    description: string;
    scan_depth: number;
    token_budget: number;
    recursive_scanning: boolean;
    entries: LorebookEntry[];
}

export interface KBFile {
    id: string;
    name: string;
    content: string;
    enabled: boolean;
    tokens?: number;
    originalContent?: string;
    cleanMode?: 'strip' | 'summary' | 'heavy_summary' | 'rejected';
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    error?: boolean; // To mark failed generations
}

export interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: number;
    pageId?: PageId; // Optional for backward compatibility, defaults to 'character' or global
}

export interface PromptItem {
    name: string;
    identifier: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    system_prompt: boolean;
    injection_position: number;
    injection_depth: number;
    injection_order: number;
    enabled: boolean;
    marker?: boolean;
}

export interface Preset {
    // Generation Params
    temperature: number;
    frequency_penalty: number;
    presence_penalty: number;
    top_p: number;
    top_k: number;
    top_a: number;
    min_p: number;
    repetition_penalty: number;
    max_context_unlocked: boolean;
    openai_max_context: number;
    openai_max_tokens: number;

    // Gemini Thinking
    thinking_mode?: 'off' | 'auto' | 'max';
    thinking_budget?: number;

    // Formatting Strings
    impersonation_prompt: string;
    new_chat_prompt: string;
    new_group_chat_prompt: string;
    new_example_chat_prompt: string;
    continue_nudge_prompt: string;
    wi_format: string;
    scenario_format: string;
    personality_format: string;
    group_nudge_prompt: string;

    // Prompts
    prompts: PromptItem[];
    prompt_order?: {
        character_id: number;
        order: { identifier: string; enabled: boolean }[];
    }[];
}

export interface APISettings {
    serverUrl: string; // e.g. http://localhost:5000/v1
    apiKey: string;
    model: string; // e.g. gpt-4, claude-3, etc.
    active_preset?: Preset; // Currently active preset
    provider: 'openai' | 'gemini';
    tokenizer?: 'gemma' | 'openai' | 'claude';
}

export type PageId = 'character' | 'autonomous' | 'lorebook' | 'cleaner' | 'settings' | 'file_manager' | 'history' | 'arts' | 'scraper';

// ... (existing profiles)

export interface CharacterHistoryEntry {
    id: string;
    timestamp: number;
    source: 'user' | 'ai';
    summary: string;
    snapshot: CharacterData;
}

export interface LorebookHistoryEntry {
    id: string;
    timestamp: number;
    source: 'user' | 'ai';
    summary: string;
    snapshot: LorebookData;
}

// Legacy type for backward compatibility during migration
export interface HistoryEntry {
    id: string;
    timestamp: number;
    source: 'user' | 'ai';
    summary: string;
    snapshot: {
        character: CharacterData;
        lorebook: LorebookData;
    };
}

// Profile Types
export interface PresetProfile {
    id: string;
    name: string;
    preset: Preset;
}

export interface ConnectionProfile {
    id: string;
    name: string;
    serverUrl: string;
    apiKey: string;
    model: string;
    provider: 'openai' | 'gemini';
}

export interface AppState {
    character: CharacterData;
    lorebook: LorebookData;
    kbFiles: KBFile[];
    chatSessions: ChatSession[];
    activeChatId: string | null;
    currentPage: PageId;
    presetProfiles: PresetProfile[];
    activePresetId: string | null;
    connectionProfiles: ConnectionProfile[];
    activeConnectionId: string | null;
    characterHistory: CharacterHistoryEntry[];
    lorebookHistory: LorebookHistoryEntry[];
    history?: HistoryEntry[]; // Legacy, for backward compatibility
    wikiUrl?: string; // Persisted wiki URL
}
