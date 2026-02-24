export function cleanJson(input: string): any {
    try {
        return JSON.parse(input);
    } catch (e) {
        // Try to find a JSON block in markdown
        const jsonMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (e2) {
                // Ignore
            }
        }
        
        // Try to find anything that looks like JSON { ... }
        const braceMatch = input.match(/{[\s\S]*}/);
        if (braceMatch) {
            try {
                return JSON.parse(braceMatch[0]);
            } catch (e3) {
                // Ignore
            }
        }
        
        // Last resort: simple string cleanup if it's just quotes
        const trimmed = input.trim();
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
             try {
                 // It might be a JSON string that needs parsing
                 return JSON.parse(trimmed);
             } catch (e4) {
                 return trimmed.slice(1, -1);
             }
        }

        return {};
    }
}
