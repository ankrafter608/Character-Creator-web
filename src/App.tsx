import { useState, useEffect } from 'react';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { CharacterEditor } from './components/CharacterEditor';
import { AutonomousMode } from './components/AutonomousMode';
import { LorebookEditor } from './components/LorebookEditor';
import { LoreCleaner } from './components/LoreCleaner';
import { FileManager } from './components/FileManager';
import { WikiScraper, getApiUrl, searchWiki, type QueueItem } from './components/WikiScraper';
import { CharacterLibrary } from './components/CharacterLibrary';
import { LorebookLibrary } from './components/LorebookLibrary';
import { Settings } from './components/Settings';
import { ChatSidebar } from './components/ChatSidebar';
import { HistoryViewer } from './components/HistoryViewer';
import { ArtsManager } from './components/ArtsManager';
import { saveState, loadState } from './utils/storage';
import { generateCompletion } from './services/api';
import type { PageId, CharacterData, LorebookData, ChatMessage, APISettings, KBFile, ChatSession, PresetProfile, ConnectionProfile, CharacterHistoryEntry, LorebookHistoryEntry, ArtPrompt } from './types';

const defaultCharacter: CharacterData = {
  name: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  creator_notes: '',
  alternate_greetings: [],
};

const defaultLorebook: LorebookData = {
  name: 'New Lorebook',
  description: '',
  scan_depth: 4,
  token_budget: 2048,
  recursive_scanning: false,
  entries: [],
};

const defaultSettings: APISettings = {
  serverUrl: 'http://localhost:5000/v1',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  provider: 'openai',
};



function App() {
  // Load saved state on mount
  const savedState = loadState();

  const [currentPage, setCurrentPage] = useState<PageId>(savedState?.currentPage || 'character');
  const [character, setCharacter] = useState<CharacterData>(savedState?.character || defaultCharacter);
  const [lorebook, setLorebook] = useState<LorebookData>(savedState?.lorebook || defaultLorebook);
  const [settings, setSettings] = useState<APISettings>(defaultSettings);
  const [chatMessages] = useState<ChatMessage[]>([]);
  const [kbFiles, setKbFiles] = useState<KBFile[]>(savedState?.kbFiles || []);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(savedState?.chatSessions || []);
  const [activeChatId, setActiveChatId] = useState<string | null>(savedState?.activeChatId || null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGeneratingArts, setIsGeneratingArts] = useState(false);
  const [artsCharacter, setArtsCharacter] = useState<CharacterData | null>(null);
  const [artPrompts, setArtPrompts] = useState<ArtPrompt[]>([]);
  const [isCharacterLibraryOpen, setIsCharacterLibraryOpen] = useState(false);
  const [isLorebookLibraryOpen, setIsLorebookLibraryOpen] = useState(false);

  const [wikiUrl, setWikiUrl] = useState(savedState?.wikiUrl || 'https://typemoon.fandom.com');
  const [wikiQueue, setWikiQueue] = useState<QueueItem[]>([]);

  // Profile state
  const [presetProfiles, setPresetProfiles] = useState<PresetProfile[]>(savedState?.presetProfiles || []);
  const [activePresetId, setActivePresetId] = useState<string | null>(savedState?.activePresetId || null);
  const [connectionProfiles, setConnectionProfiles] = useState<ConnectionProfile[]>(savedState?.connectionProfiles || []);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(savedState?.activeConnectionId || null);
  const [characterHistory, setCharacterHistory] = useState<CharacterHistoryEntry[]>(savedState?.characterHistory || []);
  const [lorebookHistory, setLorebookHistory] = useState<LorebookHistoryEntry[]>(savedState?.lorebookHistory || []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState({
      character,
      lorebook,
      kbFiles,
      chatSessions,
      activeChatId,
      currentPage,
      presetProfiles,
      activePresetId,
      connectionProfiles,
      activeConnectionId,
      characterHistory,
      lorebookHistory,
    });
  }, [character, lorebook, kbFiles, chatSessions, activeChatId, currentPage, presetProfiles, activePresetId, connectionProfiles, activeConnectionId, characterHistory, lorebookHistory]);


  // Character History Management
  const commitCharacterHistory = (source: 'user' | 'ai', summary: string) => {
    const newEntry: CharacterHistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      source,
      summary,
      snapshot: JSON.parse(JSON.stringify(character)), // Deep copy
    };
    setCharacterHistory(prev => [...prev, newEntry]);
  };

  const handleCharacterHistoryRestore = (entry: CharacterHistoryEntry) => {
    setCharacter(entry.snapshot);
  };

  // Lorebook History Management
  const commitLorebookHistory = (source: 'user' | 'ai', summary: string) => {
    const newEntry: LorebookHistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      source,
      summary,
      snapshot: JSON.parse(JSON.stringify(lorebook)), // Deep copy
    };
    setLorebookHistory(prev => [...prev, newEntry]);
  };

  const handleLorebookHistoryRestore = (entry: LorebookHistoryEntry) => {
    setLorebook(entry.snapshot);
  };

  // Restore settings from saved profile IDs on mount
  useEffect(() => {
    let newSettings = { ...settings };
    let needsUpdate = false;

    // Restore connection profile settings
    if (activeConnectionId && connectionProfiles.length > 0) {
      const savedConnection = connectionProfiles.find(p => p.id === activeConnectionId);
      if (savedConnection) {
        newSettings = {
          ...newSettings,
          serverUrl: savedConnection.serverUrl,
          apiKey: savedConnection.apiKey,
          model: savedConnection.model,
          provider: savedConnection.provider || 'openai'
        };
        needsUpdate = true;
      }
    }

    // Restore preset profile settings
    if (activePresetId && presetProfiles.length > 0) {
      const savedPreset = presetProfiles.find(p => p.id === activePresetId);
      if (savedPreset) {
        newSettings = {
          ...newSettings,
          active_preset: savedPreset.preset
        };
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setSettings(newSettings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Auto-select first profile if none is active (fallback for new users)
  useEffect(() => {
    // Auto-select first connection profile if none selected
    if (!activeConnectionId && connectionProfiles.length > 0) {
      const firstProfile = connectionProfiles[0];
      setActiveConnectionId(firstProfile.id);
      // Also update settings to match the profile
      setSettings(prev => ({
        ...prev,
        serverUrl: firstProfile.serverUrl,
        apiKey: firstProfile.apiKey,
        model: firstProfile.model,
        provider: firstProfile.provider || 'openai'
      }));
    }

    // Auto-select first preset profile if none selected
    if (!activePresetId && presetProfiles.length > 0) {
      const firstProfile = presetProfiles[0];
      setActivePresetId(firstProfile.id);
      setSettings(prev => ({
        ...prev,
        active_preset: firstProfile.preset
      }));
    }
  }, [connectionProfiles.length, presetProfiles.length]); // Only run when profile counts change


  // Filter sessions for current page
  const currentPageSessions = chatSessions.filter(s => (s.pageId || 'character') === currentPage);

  // Auto-switch active chat when changing pages
  useEffect(() => {
    // If active chat is not in current page's sessions, switch to the last one or null
    const isActiveValid = activeChatId && currentPageSessions.find(s => s.id === activeChatId);

    if (!isActiveValid) {
      if (currentPageSessions.length > 0) {
        // Select the most recent one (last in array usually)
        setActiveChatId(currentPageSessions[currentPageSessions.length - 1].id);
      } else {
        setActiveChatId(null);
      }
    }
  }, [currentPage, chatSessions, activeChatId]); // re-run when page changes or sessions list updates

  // Chat handlers
  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: `Chat ${currentPageSessions.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      pageId: currentPage // Tag with current page
    };
    setChatSessions([...chatSessions, newSession]);
    setActiveChatId(newSession.id);
    if (!isChatOpen) setIsChatOpen(true);
  };

  const handleSendMessage = (sessionId: string, content: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    };

    const updatedSession = {
      ...session,
      messages: [...session.messages, userMsg]
    };

    // Optimistic update
    setChatSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));

    // Prepare system prompt for Character Generation
    let systemPrompt = '';

    // Collect enabled file contents to inject into AI context
    const enabledFiles = kbFiles.filter(f => f.enabled && f.content);
    const filesContext = enabledFiles.length > 0
      ? '\n\nAttached Reference Files:\n' + enabledFiles.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')
      : '';

    if (currentPage === 'character') {
      let userPromptContent = '';

      // Check for user-defined prompts in active preset
      if (settings.active_preset && settings.active_preset.prompts && settings.active_preset.prompts.length > 0) {
        // Filter enabled prompts and join them
        userPromptContent = settings.active_preset.prompts
          .filter(p => p.enabled)
          .map(p => p.content)
          .join('\n\n');
      }

      if (userPromptContent.trim()) {
        systemPrompt = `${userPromptContent}

Task: Generate or update the character "${character.name || 'New Character'}" based on the chat context.

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
4. Do NOT output internal thoughts, verification steps, or reasoning headers like "Constructing...", "[Verification]=[Passed]", "Refining...". Output ONLY the JSON and a brief conversational response.
`;
      } else {
        systemPrompt = `You are an expert character creator for roleplay.
Task: Generate or update the character "${character.name || 'New Character'}" based on the chat context.

Output Format: 
1. The Character JSON object, strictly wrapped in \`\`\`json code blocks.
2. A conversational response.

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
4. Do NOT output internal thoughts, verification steps, or reasoning headers like "Constructing...", "[Verification]=[Passed]", "Refining...". Output ONLY the JSON and a brief conversational response.
`;
      }
    } else if (currentPage === 'lorebook') {
      // Serialize current lorebook entries for the AI to see
      const currentEntriesJson = lorebook.entries.map(e => ({
        keys: e.keys,
        secondary_keys: e.secondary_keys,
        content: e.content,
        comment: e.comment,
        constant: e.constant,
        selective: e.selective,
        insertion_order: e.insertion_order,
        position: e.position,
      }));

      // Inject preset prompts (user's custom rules)
      let presetContent = '';
      if (settings.active_preset && settings.active_preset.prompts && settings.active_preset.prompts.length > 0) {
        presetContent = settings.active_preset.prompts
          .filter(p => p.enabled)
          .map(p => p.content)
          .join('\n\n');
      }

      systemPrompt = `${presetContent ? presetContent + '\n\n' : ''}You are a Lorebook entry creator.

Current Lorebook: "${lorebook.name}"
Existing Entries (${lorebook.entries.length}):
${JSON.stringify(currentEntriesJson, null, 2)}

When creating entries, return them as a JSON array wrapped in \`\`\`json code blocks with this structure:
[{ "keys": ["keyword1"], "secondary_keys": [], "content": "lore text", "comment": "Entry Title", "constant": false, "selective": false, "insertion_order": 100, "position": "before_char" }]

Strict Rules:
1. ALWAYS start with the JSON block.
2. Follow it with a brief summary of the entries you created.
3. Do not duplicate existing entries. Do not include IDs.`;
    } else if (currentPage === 'scraper') {
      const scraperApiUrl = getApiUrl(wikiUrl);
      systemPrompt = `You are a wiki research assistant. The user wants to find relevant wiki pages to download for their lorebook/character project.

Current wiki: ${wikiUrl}
API endpoint: ${scraperApiUrl}

Your job:
1. Understand what the user needs (characters, lore, world-building, etc.)
2. Suggest specific page titles to search for on the wiki
3. Output your suggestions as a JSON block so the app can auto-search them

JSON format (wrap in \`\`\`json code block):
{"pages": ["Page Title 1", "Page Title 2", "Page Title 3"]}

Rules:
1. ALWAYS include the JSON block with page title suggestions.
2. After the JSON, briefly explain what you suggested and why.
3. Use exact page titles as they would appear on the wiki (e.g. "Emiya Shirou" not "shirou emiya").
4. Suggest 5-15 pages depending on scope.
5. Think about what's most useful for a lorebook — characters, locations, abilities, factions, key events.`;
    } else {
      systemPrompt = `You are a helpful assistant for the ${currentPage} page.`;
    }

    // Append any enabled file contents to the system prompt
    systemPrompt += filesContext;

    generateCompletion(settings, updatedSession.messages, systemPrompt)
      .then(response => {
        setChatSessions(prev => {
          const currentSession = prev.find(s => s.id === sessionId);
          if (!currentSession) return prev;

          const aiMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: response.content || (response.error ? `Error: ${response.error}` : "No response"),
            timestamp: Date.now(),
            error: !!response.error
          };

          return prev.map(s => s.id === sessionId ? {
            ...s,
            messages: [...s.messages, aiMsg]
          } : s);
        });

        // Auto-update character fields
        if (currentPage === 'character' && response.content) {
          import('./utils/characterParser').then(({ parseCharacterResponse }) => {
            const parsed = parseCharacterResponse(response.content);
            if (Object.keys(parsed).length > 0) {
              console.log("Auto-updating character from AI response:", parsed);
              setCharacter(prev => ({ ...prev, ...parsed }));
            }
          });
        }

        // Auto-update lorebook entries
        if (currentPage === 'lorebook' && response.content) {
          import('./utils/characterParser').then(({ parseLorebookResponse }) => {
            const newEntries = parseLorebookResponse(response.content);
            if (newEntries.length > 0) {
              console.log("Auto-adding lorebook entries from AI response:", newEntries);
              setLorebook(prev => ({
                ...prev,
                entries: [...prev.entries, ...newEntries]
              }));
            }
          });
        }

        // Auto-fetch wiki pages from scraper AI response
        if (currentPage === 'scraper' && response.content) {
          const jsonMatch = response.content.match(/```json\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              const pages: string[] = parsed.pages || [];
              if (pages.length > 0) {
                const scraperApiUrl = getApiUrl(wikiUrl);
                (async () => {
                  for (const pageTitle of pages) {
                    try {
                      // Check if already in queue or files to avoid duplicates
                      // Note: We can only check queue easily here. Files check is harder without full list scan but valid.

                      const results = await searchWiki(scraperApiUrl, pageTitle);
                      const exactMatch = results.find(r => r.title.toLowerCase() === pageTitle.toLowerCase()) || results[0];

                      if (exactMatch) {
                        setWikiQueue(prev => {
                          if (prev.find(q => q.pageid === exactMatch.pageid)) return prev;
                          return [...prev, {
                            pageid: exactMatch.pageid,
                            title: exactMatch.title,
                            status: 'pending'
                          }];
                        });
                      }
                    } catch (e) {
                      console.error(`Failed to search wiki page: ${pageTitle}`, e);
                    }
                  }
                })();
              }
            } catch (e) {
              console.error('Failed to parse scraper AI response JSON:', e);
            }
          }
        }
      })
      .catch(err => {
        console.error("Generation failed", err);
        setChatSessions(prev => {
          const currentSession = prev.find(s => s.id === sessionId);
          if (!currentSession) return prev;
          const aiMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${err.message}`,
            timestamp: Date.now(),
            error: true
          };
          return prev.map(s => s.id === sessionId ? {
            ...s,
            messages: [...s.messages, aiMsg]
          } : s);
        });
      });
  };

  const handleDeleteChat = (id: string) => {
    const newSessions = chatSessions.filter(s => s.id !== id);
    setChatSessions(newSessions);
    // Active chat update handled by useEffect
  };

  const handleDeleteMessage = (sessionId: string, msgId: string) => {
    setChatSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.filter(m => m.id !== msgId)
      };
    }));
  };

  const handleRegenerate = (sessionId: string) => {
    // Find session
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session || session.messages.length === 0) return;

    // Remove last assistant message if exists, or just trigger generation based on last user message
    const lastMsg = session.messages[session.messages.length - 1];
    let newMessages = [...session.messages];

    if (lastMsg.role === 'assistant') {
      newMessages.pop();
    }

    // Update session to remove last AI msg
    const sessionAfterDelete = { ...session, messages: newMessages };
    setChatSessions(prev => prev.map(s => s.id === sessionId ? sessionAfterDelete : s));

    // Prepare system prompt for Character Generation
    let systemPrompt = '';

    // Collect enabled file contents to inject into AI context
    const enabledFiles = kbFiles.filter(f => f.enabled && f.content);
    const filesContext = enabledFiles.length > 0
      ? '\n\nAttached Reference Files:\n' + enabledFiles.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')
      : '';

    if (currentPage === 'character') {
      // Inject preset prompts (user's custom rules)
      let userPromptContent = '';
      if (settings.active_preset && settings.active_preset.prompts && settings.active_preset.prompts.length > 0) {
        userPromptContent = settings.active_preset.prompts
          .filter(p => p.enabled)
          .map(p => p.content)
          .join('\n\n');
      }

      systemPrompt = `${userPromptContent ? userPromptContent + '\n\n' : ''}You are an expert character creator for roleplay.
Task: Generate or update the character "${character.name || 'New Character'}" based on the chat context.

Output Format: 
1. The Character JSON object, strictly wrapped in \`\`\`json code blocks.
2. A conversational response.

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
4. Do NOT output internal thoughts, verification steps, or reasoning headers like "Constructing...", "[Verification]=[Passed]", "Refining...". Output ONLY the JSON and a brief conversational response.
`;
    } else if (currentPage === 'lorebook') {
      const currentEntriesJson = lorebook.entries.map(e => ({
        keys: e.keys, secondary_keys: e.secondary_keys, content: e.content,
        comment: e.comment, constant: e.constant, selective: e.selective,
        insertion_order: e.insertion_order, position: e.position,
      }));

      // Inject preset prompts (user's custom rules)
      let presetContent = '';
      if (settings.active_preset && settings.active_preset.prompts && settings.active_preset.prompts.length > 0) {
        presetContent = settings.active_preset.prompts
          .filter(p => p.enabled)
          .map(p => p.content)
          .join('\n\n');
      }

      systemPrompt = `${presetContent ? presetContent + '\n\n' : ''}You are a Lorebook entry creator.

Current Lorebook: "${lorebook.name}"
Existing Entries (${lorebook.entries.length}):
${JSON.stringify(currentEntriesJson, null, 2)}

When creating entries, return them as a JSON array wrapped in \`\`\`json code blocks with this structure:
[{ "keys": ["keyword1"], "secondary_keys": [], "content": "lore text", "comment": "Entry Title", "constant": false, "selective": false, "insertion_order": 100, "position": "before_char" }]

Strict Rules:
1. ALWAYS start with the JSON block.
2. Follow it with a brief summary of the entries you created.
3. Do not duplicate existing entries. Do not include IDs.`;
    } else if (currentPage === 'scraper') {
      const scraperApiUrl = getApiUrl(wikiUrl);
      systemPrompt = `You are a wiki research assistant. The user wants to find relevant wiki pages to download for their lorebook/character project.

Current wiki: ${wikiUrl}
API endpoint: ${scraperApiUrl}

Your job:
1. Understand what the user needs (characters, lore, world-building, etc.)
2. Suggest specific page titles to search for on the wiki
3. Output your suggestions as a JSON block so the app can auto-search them

JSON format (wrap in \`\`\`json code block):
{"pages": ["Page Title 1", "Page Title 2", "Page Title 3"]}

Rules:
1. ALWAYS include the JSON block with page title suggestions.
2. After the JSON, briefly explain what you suggested and why.
3. Use exact page titles as they would appear on the wiki (e.g. "Emiya Shirou" not "shirou emiya").
4. Suggest 5-15 pages depending on scope.
5. Think about what's most useful for a lorebook — characters, locations, abilities, factions, key events.`;
    } else {
      systemPrompt = `You are a helpful assistant for the ${currentPage} page.`;
    }

    // Append any enabled file contents to the system prompt
    systemPrompt += filesContext;

    generateCompletion(settings, sessionAfterDelete.messages, systemPrompt)
      .then(response => {
        setChatSessions(prev => {
          const currentSession = prev.find(s => s.id === sessionId);
          if (!currentSession) return prev;

          const aiMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: response.content || (response.error ? `Error: ${response.error}` : "No response"),
            timestamp: Date.now(),
            error: !!response.error
          };

          return prev.map(s => s.id === sessionId ? {
            ...s,
            messages: [...s.messages, aiMsg]
          } : s);
        });

        // Auto-update character fields if response contains structured data
        if (currentPage === 'character' && response.content) {
          import('./utils/characterParser').then(({ parseCharacterResponse }) => {
            const parsed = parseCharacterResponse(response.content);
            if (Object.keys(parsed).length > 0) {
              console.log("Auto-updating character from AI response:", parsed);
              setCharacter(prev => ({ ...prev, ...parsed }));
            }
          });
        }

        // Auto-update lorebook entries
        if (currentPage === 'lorebook' && response.content) {
          import('./utils/characterParser').then(({ parseLorebookResponse }) => {
            const newEntries = parseLorebookResponse(response.content);
            if (newEntries.length > 0) {
              console.log("Auto-adding lorebook entries from AI response (regen):", newEntries);
              setLorebook(prev => ({
                ...prev,
                entries: [...prev.entries, ...newEntries]
              }));
            }
          });
        }

        // Auto-fetch wiki pages from scraper AI response (regen)
        if (currentPage === 'scraper' && response.content) {
          const jsonMatch = response.content.match(/```json\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              const pages: string[] = parsed.pages || [];
              if (pages.length > 0) {
                const scraperApiUrl = getApiUrl(wikiUrl);
                (async () => {
                  for (const pageTitle of pages) {
                    try {
                      const results = await searchWiki(scraperApiUrl, pageTitle);
                      const exactMatch = results.find(r => r.title.toLowerCase() === pageTitle.toLowerCase()) || results[0];

                      if (exactMatch) {
                        setWikiQueue(prev => {
                          if (prev.find(q => q.pageid === exactMatch.pageid)) return prev;
                          return [...prev, {
                            pageid: exactMatch.pageid,
                            title: exactMatch.title,
                            status: 'pending'
                          }];
                        });
                      }
                    } catch (e) {
                      console.error(`Failed to search wiki page: ${pageTitle}`, e);
                    }
                  }
                })();
              }
            } catch (e) {
              console.error('Failed to parse scraper AI response JSON:', e);
            }
          }
        }
      })
      .catch(err => {
        console.error("Regeneration failed", err);
        setChatSessions(prev => {
          const currentSession = prev.find(s => s.id === sessionId);
          if (!currentSession) return prev;
          const aiMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${err.message}`,
            timestamp: Date.now(),
            error: true
          };
          return prev.map(s => s.id === sessionId ? {
            ...s,
            messages: [...s.messages, aiMsg]
          } : s);
        });
      });
  };

  const handleGenerateArts = async (aspectRatio: string) => {
    setIsGeneratingArts(true);
    try {
      const targetChar = artsCharacter || character;
      // Construct system prompt with preset injection if available
      let systemPrompt = "You are an expert AI Art Prompt Engineer.";

      // Inject preset prompts if available to respect jailbreaks/style
      if (settings.active_preset && settings.active_preset.prompts) {
        const presetInstructions = settings.active_preset.prompts
          .filter(p => p.enabled)
          .map(p => p.content)
          .join('\n\n');
        if (presetInstructions) {
          systemPrompt += "\n\n" + presetInstructions;
        }
      }

      const greetings = [targetChar.first_mes, ...(targetChar.alternate_greetings || [])].filter(Boolean);
      let greetingInstructions = "";
      greetings.forEach((greeting, index) => {
        // Truncate greeting for prompt context to avoid token limits
        const snippet = greeting.length > 300 ? greeting.substring(0, 300) + "..." : greeting;
        const label = index === 0 ? "Greeting 1 (First Mes)" : `Greeting ${index + 1}`;
        greetingInstructions += `\n${index + 2}. ${label}: Visualize the scene described in this dialogue: "${snippet}"`;
      });

      const prompt = `${systemPrompt}

Role: Analyze the character "${targetChar.name}" and generate a structured set of image prompts for ComfyUI / Stable Diffusion.

Character Description:
${targetChar.description}

Target Resolution/Aspect Ratio: ${aspectRatio}

Requests:
1. General: A high-quality portrait or full-body shot capturing the character's essence.
${greetingInstructions}

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
- Return ONLY the JSON array wrapped in \`\`\`json code blocks.`;

      const response = await generateCompletion(settings, [{ role: 'user', content: prompt, id: Date.now().toString(), timestamp: Date.now() }], prompt);

      if (response.content) {
        const { parseArtPromptsResponse } = await import('./utils/characterParser');
        const newPrompts = parseArtPromptsResponse(response.content);
        if (newPrompts.length > 0) {
          setArtPrompts(prev => [...prev, ...newPrompts]);
        }
      }
    } catch (error) {
      console.error('Failed to generate arts:', error);
    } finally {
      setIsGeneratingArts(false);
    }
  };

  const handleContinue = (sessionId: string) => {
    // Mock continue
    setTimeout(() => {
      setChatSessions(prev => {
        const currentSession = prev.find(s => s.id === sessionId);
        if (!currentSession) return prev;

        const lastMsg = currentSession.messages[currentSession.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          const updatedMsg = { ...lastMsg, content: lastMsg.content + " ...and here is more text from the continuation." };
          return prev.map(s => s.id === sessionId ? {
            ...s,
            messages: s.messages.map(m => m.id === lastMsg.id ? updatedMsg : m)
          } : s);
        }
        return prev;
      });
    }, 1000);
  };

  // Removed renderPage function as per new structure

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="main-content">
        {currentPage === 'character' && (
          <CharacterEditor
            character={character}
            settings={settings}
            onChange={setCharacter}
            onOpenLibrary={() => {
              commitCharacterHistory('user', 'Manual Save (Character)');
              setIsCharacterLibraryOpen(true);
            }}
            onNew={() => {
              commitCharacterHistory('user', 'Before New Character');
              setCharacter(defaultCharacter);
            }}
          />
        )}
        {currentPage === 'history' && (
          <HistoryViewer
            characterHistory={characterHistory}
            lorebookHistory={lorebookHistory}
            onRestoreCharacter={handleCharacterHistoryRestore}
            onRestoreLorebook={handleLorebookHistoryRestore}
          />
        )}
        {currentPage === 'arts' && (
          <ArtsManager
            character={artsCharacter || character}
            prompts={artPrompts}
            onUpdatePrompts={setArtPrompts}
            onSelectCharacter={setArtsCharacter}
            onGenerate={handleGenerateArts}
            isGenerating={isGeneratingArts}
          />
        )}
        {currentPage === 'autonomous' && (
          <AutonomousMode
            messages={chatMessages}
            onSendMessage={() => { }}
            isGenerating={false}
          />
        )}
        {currentPage === 'lorebook' && (
          <LorebookEditor
            lorebook={lorebook}
            onChange={setLorebook}
            onOpenLibrary={() => {
              commitLorebookHistory('user', 'Manual Save (Lorebook)');
              setIsLorebookLibraryOpen(true);
            }}
          />
        )}
        {currentPage === 'file_manager' && (
          <FileManager
            files={kbFiles}
            onFilesChange={setKbFiles}
          />
        )}
        {currentPage === 'cleaner' && (
          <LoreCleaner
            files={kbFiles}
            onFilesChange={setKbFiles}
            settings={settings}
          />
        )}
        {currentPage === 'scraper' && (
          <WikiScraper
            onFilesAdd={(newFiles) => setKbFiles(prev => [...prev, ...newFiles])}
            wikiUrl={wikiUrl}
            onWikiUrlChange={setWikiUrl}
            queue={wikiQueue}
            onQueueChange={setWikiQueue}
          />
        )}
        {currentPage === 'settings' && (
          <Settings
            settings={settings}
            onChange={setSettings}
            presetProfiles={presetProfiles}
            activePresetId={activePresetId}
            onPresetProfilesChange={setPresetProfiles}
            onActivePresetChange={setActivePresetId}
            connectionProfiles={connectionProfiles}
            activeConnectionId={activeConnectionId}
            onConnectionProfilesChange={setConnectionProfiles}
            onActiveConnectionChange={setActiveConnectionId}
          />
        )}
      </main>
      <ChatSidebar
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        sessions={currentPageSessions}
        activeSessionId={activeChatId}
        onNewSession={handleNewChat}
        onSelectSession={setActiveChatId}
        onDeleteSession={handleDeleteChat}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        onRegenerate={handleRegenerate}
        onContinue={handleContinue}
      />

      {/* Libraries */}
      <CharacterLibrary
        isOpen={isCharacterLibraryOpen}
        onClose={() => setIsCharacterLibraryOpen(false)}
        currentCharacter={character}
        onLoad={setCharacter}
      />
      <LorebookLibrary
        isOpen={isLorebookLibraryOpen}
        onClose={() => setIsLorebookLibraryOpen(false)}
        currentLorebook={lorebook}
        onLoad={setLorebook}
      />
    </div>
  );
}

export default App;
