import type { CharacterData, ArtPrompt, LorebookEntry } from '../types';

export function parseCharacterResponse(text: string): Partial<CharacterData> {
    try {
        // Helper to validate and map the parsed object
        const validateAndMap = (parsed: any): Partial<CharacterData> | null => {
            if (!parsed || typeof parsed !== 'object') return null;
            // Check for at least one key field to confirm it's likely a character object
            if (!parsed.name && !parsed.description && !parsed.first_mes) return null;

            const data: Partial<CharacterData> = {};
            if (typeof parsed.name === 'string') data.name = parsed.name;
            if (typeof parsed.description === 'string') data.description = parsed.description;
            if (typeof parsed.personality === 'string') data.personality = parsed.personality;
            if (typeof parsed.scenario === 'string') data.scenario = parsed.scenario;
            if (typeof parsed.first_mes === 'string') data.first_mes = parsed.first_mes;
            if (typeof parsed.mes_example === 'string') data.mes_example = parsed.mes_example;
            if (typeof parsed.creator_notes === 'string') data.creator_notes = parsed.creator_notes;

            if (Array.isArray(parsed.alternate_greetings)) {
                data.alternate_greetings = parsed.alternate_greetings.filter((g: any) => typeof g === 'string');
            }
            return data;
        };

        // 1. Try code blocks (most reliable) - allow optional 'json' or no language
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
        let match;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                const result = validateAndMap(parsed);
                if (result) return result;
            } catch (e) {
                // Continue to next block
            }
        }

        // 2. Fallback: Search for potential JSON objects in the text
        const endIndex = text.lastIndexOf('}');
        if (endIndex === -1) return {};

        // Find all opening braces
        const openBraces: number[] = [];
        for (let i = 0; i < endIndex; i++) {
            if (text[i] === '{') openBraces.push(i);
        }

        // Iterate through all '{' positions and try to parse
        for (const start of openBraces) {
            try {
                const candidate = text.substring(start, endIndex + 1);
                // Quick check: does it contain "name" or "description"?
                if (!candidate.includes('"name"') && !candidate.includes('"description"')) continue;

                const parsed = JSON.parse(candidate);
                const result = validateAndMap(parsed);
                if (result) return result;
            } catch (e) {
                // Ignore parse errors
            }
        }

        return {};
    } catch (e) {
        console.error("Failed to parse character JSON", e);
        return {};
    }
}

export function parseArtPromptsResponse(text: string): ArtPrompt[] {
    try {
        let jsonString = '';
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            jsonString = jsonBlockMatch[1];
        } else {
            const startIndex = text.indexOf('[');
            const endIndex = text.lastIndexOf(']');
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                jsonString = text.substring(startIndex, endIndex + 1);
            }
        }

        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed)) {
                return parsed.map((item: any) => ({
                    id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    label: item.label || 'New Prompt',
                    prompt: item.prompt || '',
                    negative_prompt: item.negative_prompt || '',
                    model: item.model || 'anime'
                }));
            }
        }
        return [];
    } catch (e) {
        console.error("Failed to parse art prompts JSON", e);
        return [];
    }
}

export function parseLorebookResponse(text: string): LorebookEntry[] {
    try {
        const processParsed = (parsed: any): LorebookEntry[] => {
            let rawEntries: any[] = [];
            if (Array.isArray(parsed)) {
                rawEntries = parsed;
            } else if (parsed && typeof parsed === 'object') {
                if (parsed.keys || parsed.key || parsed.content) {
                    rawEntries = [parsed];
                } else {
                    rawEntries = Object.values(parsed);
                }
            }

            return rawEntries
                .filter((entry: any) => entry && typeof entry === 'object' && (entry.content || entry.keys || entry.key))
                .map((entry: any) => ({
                    id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    keys: entry.keys || entry.key || [],
                    secondary_keys: entry.secondary_keys || entry.keysecondary || [],
                    content: entry.content || '',
                    comment: entry.comment || entry.title || entry.name || '',
                    enabled: entry.disable === undefined ? (entry.enabled !== false) : !entry.disable,
                    constant: !!entry.constant,
                    selective: !!entry.selective,
                    insertion_order: entry.insertion_order || entry.order || 100,
                    position: (entry.position === 1 || entry.position === 'after_char') ? 'after_char' as const : 'before_char' as const,
                }));
        };

        // 1. Try code blocks
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
        let match;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                const entries = processParsed(parsed);
                if (entries.length > 0) return entries;
            } catch (e) {
                // Continue
            }
        }

        // 2. Fallback: Search for arrays or objects
        const endArrIndex = text.lastIndexOf(']');
        const endObjIndex = text.lastIndexOf('}');
        const endIndex = Math.max(endArrIndex, endObjIndex);

        if (endIndex === -1) return [];

        const startIndices: number[] = [];
        for (let i = 0; i < endIndex; i++) {
            if (text[i] === '[' || text[i] === '{') startIndices.push(i);
        }

        for (const start of startIndices) {
            try {
                const candidate = text.substring(start, endIndex + 1);
                // Quick check for keywords
                if (!candidate.includes('"keys"') && !candidate.includes('"content"')) continue;

                const parsed = JSON.parse(candidate);
                const entries = processParsed(parsed);
                if (entries.length > 0) return entries;
            } catch (e) {
                // Ignore
            }
        }

        return [];
    } catch (e) {
        console.error("Failed to parse lorebook entries from AI response", e);
        return [];
    }
}
