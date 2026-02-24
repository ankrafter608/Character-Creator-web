// Registry of tools for the autonomous agent
import type { ToolDefinition } from './types';
import { getApiUrl, searchWiki, fetchPageContent } from '../../components/WikiScraper';
import { generateCompletion } from '../../services/api';

const CLEAN_PROMPTS = {
    strip: `You are a text cleaner. Remove formatting garbage (markdown, HTML, JSON, code fences) but keep ALL text content intact. Output ONLY the plain text.`,
    summary: `You are a text summarizer. Remove formatting garbage and summarize the content to be concise while keeping all key facts, names, and details. Output ONLY the result.`
};

export class ToolManager {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  // Register a new tool
  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolManager] Overwriting tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  // Get a tool by name
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  // Execute a tool
  async execute(name: string, args: any, context: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found.`);
    }
    try {
      console.log(`[ToolManager] Executing: ${name}`, args);
      return await tool.execute(args, context);
    } catch (error: any) {
      console.error(`[ToolManager] Execution failed: ${name}`, error);
      return `Error executing tool '${name}': ${error.message}`;
    }
  }

  // Generate system prompt section describing available tools
  getSystemPromptPart(): string {
    const toolsDesc = Array.from(this.tools.values())
      .map(t => `- ${t.name}: ${t.description}\n  Params: ${JSON.stringify(t.parameters)}`)
      .join('\n\n');

    return `
You have access to the following tools:

${toolsDesc}

To use a tool, output a command block strictly in this format:
<command name="tool_name">
{
  "param1": "value1"
}
</command>

To think or plan before acting, use a thought block:
<thought>
I need to check the wiki first.
</thought>
`;
  }

  // Register the built-in tools
  private registerBuiltInTools() {
    // 1. Wikipedia Search Tool
    this.register({
      name: 'wiki_search',
      description: 'Search for articles on a wiki (Fandom/Wikipedia). Provide the base URL of the wiki (e.g. "https://highschooldxd.fandom.com") if it differs from the current one.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query (e.g., "Gilgamesh")' },
          wikiUrl: { type: 'string', description: 'REQUIRED if current wiki URL is not configured or if you need to search a different fandom. Example: "https://highschooldxd.fandom.com"' }
        },
        required: ['query']
      },
      execute: async ({ query, wikiUrl: explicitUrl }, context) => {
        let urlToUse = explicitUrl || context.wikiUrl;
        
        // Auto-fix domain if the AI provides a clean domain instead of full URL
        if (urlToUse && !urlToUse.startsWith('http')) {
            urlToUse = `https://${urlToUse}`;
        }

        if (!urlToUse || urlToUse.trim() === '') {
            return 'Error: No Wiki URL configured or provided. You MUST provide the "wikiUrl" parameter (e.g., "https://highschooldxd.fandom.com") to use this tool.';
        }
        
        try {
            const scraperApiUrl = getApiUrl(urlToUse);
            const results = await searchWiki(scraperApiUrl, query);
            
            if (results.length === 0) return `No results found for "${query}" on ${urlToUse}.`;
            
            return JSON.stringify(results.map(r => ({ title: r.title, pageid: r.pageid })), null, 2);
        } catch (e: any) {
            return `Failed to search wiki: ${e.message}`;
        }
      }
    });

    // 2. Read Wiki Page Tool
    this.register({
      name: 'read_page',
      description: 'Download and read the content of a wiki page. This adds the content to the project files (Knowledge Base).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Exact title of the page to read (from search results)' },
          wikiUrl: { type: 'string', description: 'REQUIRED if current wiki URL is not configured or if you need to read from a different fandom.' }
        },
        required: ['title']
      },
      execute: async ({ title, wikiUrl: explicitUrl }, context) => {
        let urlToUse = explicitUrl || context.wikiUrl;
        
        // Auto-fix domain if the AI provides a clean domain instead of full URL
        if (urlToUse && !urlToUse.startsWith('http')) {
            urlToUse = `https://${urlToUse}`;
        }

        const { addKbFile } = context;
        
        if (!urlToUse || urlToUse.trim() === '') {
            return 'Error: No Wiki URL configured or provided. You MUST provide the "wikiUrl" parameter (e.g., "https://highschooldxd.fandom.com") to use this tool.';
        }
        
        try {
            const apiUrl = getApiUrl(urlToUse);
            
            // Search first to get the ID.
            const results = await searchWiki(apiUrl, title);
            const exactMatch = results.find(r => r.title.toLowerCase() === title.toLowerCase()) || results[0];

            if (!exactMatch) return `Error: Page "${title}" not found on ${urlToUse}.`;

            const content = await fetchPageContent(apiUrl, exactMatch.pageid);
            
            // Add to Knowledge Base via callback
            if (addKbFile) {
                console.log('[ToolManager] Adding file to KB:', exactMatch.title);
                addKbFile({
                    id: `wiki_${exactMatch.pageid}_${Date.now()}`,
                    name: `${exactMatch.title}.txt`,
                    content: content,
                    enabled: true,
                    type: 'text',
                    tokens: Math.floor(content.length / 4) // Estimate tokens immediately
                });
            } else {
                console.error('[ToolManager] addKbFile context missing!');
            }

            return `Successfully read page "${exactMatch.title}". Content added to Knowledge Base. First 500 chars:\n${content.substring(0, 500)}...`;
        } catch (e: any) {
            return `Failed to read page: ${e.message}`;
        }
      }
    });

    // 3. Update Character Tool
    this.register({
      name: 'update_character',
      description: 'Update the character sheet fields. Use this to save your progress or refine the character based on research.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          personality: { type: 'string' },
          scenario: { type: 'string' },
          first_mes: { type: 'string' },
          mes_example: { type: 'string' },
          creator_notes: { type: 'string' },
          alternate_greetings: { type: 'array', items: { type: 'string' } }
        }
      },
      execute: async (fields, context) => {
        const { updateCharacter } = context;
        console.log('[ToolManager] update_character called with:', fields);
        if (updateCharacter) {
            updateCharacter(fields);
            return `Character updated successfully with fields: ${Object.keys(fields).join(', ')}`;
        }
        return 'Error: Character update context missing.';
      }
    });

    // 4. Update Lorebook Tool
    this.register({
        name: 'add_lorebook_entry',
        description: 'Add a new entry to the Lorebook based on research.',
        parameters: {
            type: 'object',
            properties: {
                keys: { type: 'array', items: { type: 'string' } },
                content: { type: 'string' },
                comment: { type: 'string', description: 'Title or comment for the entry' }
            },
            required: ['keys', 'content']
        },
        execute: async (entry, context) => {
            if (!entry || !entry.keys || !Array.isArray(entry.keys) || !entry.content) {
                return 'Error executing tool \'add_lorebook_entry\': missing required fields "keys" (must be array) and "content".';
            }
            const { addLorebookEntry } = context;
            if (addLorebookEntry) {
                addLorebookEntry(entry);
                return `Lorebook entry "${entry.comment || entry.keys[0]}" added.`;
            }
            return 'Error: Lorebook update context missing.';
        }
    });

    // 5. List Files Tool
    this.register({
        name: 'list_files',
        description: 'List all files in the Knowledge Base. Use this to check for large files (>10k tokens) that should be summarized.',
        parameters: { type: 'object', properties: {} },
        execute: async (_, context) => {
            const { kbFiles } = context;
            if (!kbFiles || kbFiles.length === 0) return "No files found.";
            return kbFiles.map((f: any) => 
                `- Name: "${f.name}", Tokens: ${f.tokens || 0}`
            ).join('\n');
        }
    });

    // 6. Clean File Tool
    this.register({
        name: 'clean_file',
        description: 'Clean or summarize a file to reduce token usage. REQUIRED if a file is over 20k tokens.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Exact name of the file to clean' },
                mode: { type: 'string', enum: ['strip', 'summary'], description: 'Use "summary" to compress large text.' }
            },
            required: ['name', 'mode']
        },
        execute: async ({ name, mode }, context) => {
            if (!name || !mode) return 'Error: "name" and "mode" are required parameters.';
            const { kbFiles, updateKbFile, settings } = context;
            if (!kbFiles) return "Error: No files available.";
            
            const file = kbFiles.find((f: any) => f.name === name);
            if (!file) return `Error: File "${name}" not found.`;

            if (!settings) return "Error: Settings missing.";

            const prompt = CLEAN_PROMPTS[mode as keyof typeof CLEAN_PROMPTS] || CLEAN_PROMPTS.strip;
            
            try {
                // Determine model for cleaning - use "gpt-3.5-turbo" or equivalent fast model if possible?
                // For now use active settings.
                
                const response = await generateCompletion(settings, [{
                    role: 'user',
                    content: file.content,
                    id: Date.now().toString(), 
                    timestamp: Date.now()
                }], prompt);

                if (response.content) {
                    const newContent = response.content;
                    const newTokens = Math.floor(newContent.length / 4);
                    
                    if (updateKbFile) {
                        updateKbFile({
                            ...file,
                            content: newContent,
                            tokens: newTokens,
                            cleanMode: mode
                        });
                    }
                    return `File "${name}" cleaned. Tokens: ${file.tokens} -> ${newTokens}.`;
                } else {
                    return "Error: AI returned empty response.";
                }
            } catch (e: any) {
                return `Error cleaning file: ${e.message}`;
            }
        }
    });
  }
}
