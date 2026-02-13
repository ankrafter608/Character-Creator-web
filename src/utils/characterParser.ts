import type { CharacterData, ArtPrompt, LorebookEntry } from '../types';

export function parseCharacterResponse(text: string): Partial<CharacterData> {
    try {
        let jsonString = '';

        // 1. Try to find a JSON block enclosed in ```json ... ```
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            jsonString = jsonBlockMatch[1];
        } else {
            // 2. Try to find the first '{' and the last '}'
            const startIndex = text.indexOf('{');
            const endIndex = text.lastIndexOf('}');
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                jsonString = text.substring(startIndex, endIndex + 1);
            }
        }

        if (jsonString) {
            const parsed = JSON.parse(jsonString);

            // Validate and sanitize known fields
            const data: Partial<CharacterData> = {};

            if (typeof parsed.name === 'string') data.name = parsed.name;
            if (typeof parsed.description === 'string') data.description = parsed.description;
            if (typeof parsed.personality === 'string') data.personality = parsed.personality;
            if (typeof parsed.scenario === 'string') data.scenario = parsed.scenario;
            if (typeof parsed.first_mes === 'string') data.first_mes = parsed.first_mes;
            if (typeof parsed.mes_example === 'string') data.mes_example = parsed.mes_example;

            if (Array.isArray(parsed.alternate_greetings)) {
                data.alternate_greetings = parsed.alternate_greetings.filter((g: any) => typeof g === 'string');
            }

            return data;
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
        let jsonString = '';
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            jsonString = jsonBlockMatch[1];
        } else {
            // Try array first
            const arrStart = text.indexOf('[');
            const arrEnd = text.lastIndexOf(']');
            if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
                jsonString = text.substring(arrStart, arrEnd + 1);
            } else {
                // Try object (single entry or ST-style map)
                const objStart = text.indexOf('{');
                const objEnd = text.lastIndexOf('}');
                if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
                    jsonString = text.substring(objStart, objEnd + 1);
                }
            }
        }

        if (!jsonString) return [];

        const parsed = JSON.parse(jsonString);

        // Normalize: could be an array, a single entry object, or an ST-style object map
        let rawEntries: any[] = [];
        if (Array.isArray(parsed)) {
            rawEntries = parsed;
        } else if (parsed && typeof parsed === 'object') {
            // Check if it looks like a single entry (has 'keys' or 'key' or 'content')
            if (parsed.keys || parsed.key || parsed.content) {
                rawEntries = [parsed];
            } else {
                // Assume ST-style object map { "0": {...}, "1": {...} }
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
    } catch (e) {
        console.error("Failed to parse lorebook entries from AI response", e);
        return [];
    }
}
