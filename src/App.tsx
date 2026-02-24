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
import { countTokens } from './utils/tokenCounter';
import { getDefaultPrompts, fillTemplate } from './utils/systemPrompts';
import type { PageId, CharacterData, LorebookData, ChatMessage, APISettings, KBFile, ChatSession, PresetProfile, ConnectionProfile, CharacterHistoryEntry, LorebookHistoryEntry, ArtPrompt } from './types';
import type { CustomPrompts } from './utils/systemPrompts';

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
  stream: true,
};



function App() {
  // Load saved state on mount
  const savedState = loadState();

  const [currentPage, setCurrentPage] = useState<PageId>(savedState?.currentPage || 'character');
  const [character, setCharacter] = useState<CharacterData>(savedState?.character || defaultCharacter);
  const [lorebook, setLorebook] = useState<LorebookData>(savedState?.lorebook || defaultLorebook);
  const [settings, setSettings] = useState<APISettings>(defaultSettings);
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
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>(() => ({
    ...getDefaultPrompts(),
    ...(savedState?.customPrompts || {})
  }));

  // Fix missing IDs in lorebook entries (migration for existing bad data)
  useEffect(() => {
      const hasMissingIds = lorebook.entries.some(e => !e.id);
      if (hasMissingIds) {
          console.log("Fixing missing lorebook IDs...");
          setLorebook(prev => ({
              ...prev,
              entries: prev.entries.map(e => e.id ? e : {
                  ...e,
                  id: `fixed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              })
          }));
      }
  }, [lorebook.entries]); // Dependency on entries array ensures we catch new bad additions too

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
      customPrompts,
    });
  }, [character, lorebook, kbFiles, chatSessions, activeChatId, currentPage, presetProfiles, activePresetId, connectionProfiles, activeConnectionId, characterHistory, lorebookHistory, customPrompts]);


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
          provider: savedConnection.provider || 'openai',
          tokenizer: savedConnection.tokenizer || 'openai'
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
          active_preset: savedPreset.preset,
          // Tokenizer is now part of connection profile, but we keep this as fallback/override if present in preset legacy
          // tokenizer: savedPreset.preset.tokenizer || newSettings.tokenizer 
        };
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setSettings(newSettings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Reactive Token Recalculation
  useEffect(() => {
    if (!settings.tokenizer) return;
    
    setKbFiles(prevFiles => {
        const newFiles = prevFiles.map(f => {
            const newTokens = countTokens(f.content, settings.tokenizer as any);
            if (newTokens !== f.tokens) {
                return { ...f, tokens: newTokens };
            }
            return f;
        });
        
        // Return same object if no changes to avoid re-renders
        if (newFiles.every((f, i) => f === prevFiles[i])) {
            return prevFiles;
        }
        return newFiles;
    });
  }, [settings.tokenizer]);

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

      const templateBody = fillTemplate(customPrompts.character || '', {
        characterName: character.name || 'New Character',
      });

      systemPrompt = userPromptContent.trim()
        ? `${userPromptContent}\n\n${templateBody}`
        : templateBody;
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

      const templateBody = fillTemplate(customPrompts.lorebook || '', {
        lorebookName: lorebook.name,
        entryCount: String(lorebook.entries.length),
        entriesJson: JSON.stringify(currentEntriesJson, null, 2),
      });

      systemPrompt = presetContent.trim()
        ? `${presetContent}\n\n${templateBody}`
        : templateBody;
    } else if (currentPage === 'scraper') {
      const scraperApiUrl = getApiUrl(wikiUrl);
      systemPrompt = fillTemplate(customPrompts.scraper || '', {
        wikiUrl,
        scraperApiUrl,
      });
    } else {
      systemPrompt = fillTemplate(customPrompts.generic || '', {
        pageName: currentPage,
      });
    }

    // Append any enabled file contents to the system prompt
    systemPrompt += filesContext;

    const executeCompletion = (currentMessages: ChatMessage[], attempt: number = 0) => {
      generateCompletion(settings, currentMessages, systemPrompt)
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
                const suggestedWikiUrl = parsed.wikiUrl;
                
                let currentWikiUrl = wikiUrl;
                if (suggestedWikiUrl && suggestedWikiUrl !== wikiUrl) {
                    currentWikiUrl = suggestedWikiUrl;
                    setWikiUrl(suggestedWikiUrl); // Update the state so UI reflects the new wiki
                }

                if (parsed.action === 'search') {
                  if (attempt < 3) { // Max depth
                    const scraperApiUrl = getApiUrl(currentWikiUrl);
                    searchWiki(scraperApiUrl, parsed.query || '').then(results => {
                      const titles = results.map(r => r.title);
                      const sysContent = titles.length > 0
                        ? `Search results for "${parsed.query}":\n${titles.map(t => `- ${t}`).join('\n')}\nPlease output a JSON with action="download" and the exact titles you want to download, or use action="search" with a different query.`
                        : `No results found for "${parsed.query}". Please try a different search query.`;
                      
                      const sysMsg: ChatMessage = {
                        id: Date.now().toString(),
                        role: 'system',
                        content: sysContent,
                        timestamp: Date.now()
                      };

                      setChatSessions(prev => prev.map(s => {
                        if (s.id !== sessionId) return s;
                        const newMsgs = [...s.messages, sysMsg];
                        // Trigger next turn
                        setTimeout(() => executeCompletion(newMsgs, attempt + 1), 100);
                        return { ...s, messages: newMsgs };
                      }));
                    });
                  }
                } else {
                  // Fallback or explicit 'download'
                  const pages: string[] = parsed.pages || [];
                  if (pages.length > 0) {
                    const scraperApiUrl = getApiUrl(currentWikiUrl);
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

    executeCompletion(updatedSession.messages);
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

      const templateBody = fillTemplate(customPrompts.character || '', {
        characterName: character.name || 'New Character',
      });

      systemPrompt = userPromptContent.trim()
        ? `${userPromptContent}\n\n${templateBody}`
        : templateBody;
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

      const templateBody = fillTemplate(customPrompts.lorebook || '', {
        lorebookName: lorebook.name,
        entryCount: String(lorebook.entries.length),
        entriesJson: JSON.stringify(currentEntriesJson, null, 2),
      });

      systemPrompt = presetContent.trim()
        ? `${presetContent}\n\n${templateBody}`
        : templateBody;
    } else if (currentPage === 'scraper') {
      const scraperApiUrl = getApiUrl(wikiUrl);
      systemPrompt = fillTemplate(customPrompts.scraper || '', {
        wikiUrl,
        scraperApiUrl,
      });
    } else {
      systemPrompt = fillTemplate(customPrompts.generic || '', {
        pageName: currentPage,
      });
    }

    // Append any enabled file contents to the system prompt
    systemPrompt += filesContext;

    const executeRegenerateCompletion = (currentMessages: ChatMessage[], attempt: number = 0) => {
      generateCompletion(settings, currentMessages, systemPrompt)
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
                const suggestedWikiUrl = parsed.wikiUrl;
                
                let currentWikiUrl = wikiUrl;
                if (suggestedWikiUrl && suggestedWikiUrl !== wikiUrl) {
                    currentWikiUrl = suggestedWikiUrl;
                    setWikiUrl(suggestedWikiUrl); // Update the state so UI reflects the new wiki
                }

                if (parsed.action === 'search') {
                  if (attempt < 3) { // Max depth
                    const scraperApiUrl = getApiUrl(currentWikiUrl);
                    searchWiki(scraperApiUrl, parsed.query || '').then(results => {
                      const titles = results.map(r => r.title);
                      const sysContent = titles.length > 0
                        ? `Search results for "${parsed.query}":\n${titles.map(t => `- ${t}`).join('\n')}\nPlease output a JSON with action="download" and the exact titles you want to download, or use action="search" with a different query.`
                        : `No results found for "${parsed.query}". Please try a different search query.`;
                      
                      const sysMsg: ChatMessage = {
                        id: Date.now().toString(),
                        role: 'system',
                        content: sysContent,
                        timestamp: Date.now()
                      };

                      setChatSessions(prev => prev.map(s => {
                        if (s.id !== sessionId) return s;
                        const newMsgs = [...s.messages, sysMsg];
                        // Trigger next turn
                        setTimeout(() => executeRegenerateCompletion(newMsgs, attempt + 1), 100);
                        return { ...s, messages: newMsgs };
                      }));
                    });
                  }
                } else {
                  // Fallback or explicit 'download'
                  const pages: string[] = parsed.pages || [];
                  if (pages.length > 0) {
                    const scraperApiUrl = getApiUrl(currentWikiUrl);
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

    executeRegenerateCompletion(sessionAfterDelete.messages);
  };

  const handleGenerateArts = async (aspectRatio: string) => {
    setIsGeneratingArts(true);
    try {
      const targetChar = artsCharacter || character;
      // Inject preset prompts if available to respect jailbreaks/style
      let presetInstructions = '';
      if (settings.active_preset && settings.active_preset.prompts) {
        presetInstructions = settings.active_preset.prompts
          .filter(p => p.enabled)
          .map(p => p.content)
          .join('\n\n');
      }

      const greetings = [targetChar.first_mes, ...(targetChar.alternate_greetings || [])].filter(Boolean);
      let greetingInstructions = "";
      greetings.forEach((greeting, index) => {
        // Truncate greeting for prompt context to avoid token limits
        const snippet = greeting.length > 300 ? greeting.substring(0, 300) + "..." : greeting;
        const label = index === 0 ? "Greeting 1 (First Mes)" : `Greeting ${index + 1}`;
        greetingInstructions += `\n${index + 2}. ${label}: Visualize the scene described in this dialogue: "${snippet}"`;
      });

      const templateBody = fillTemplate(customPrompts.art || '', {
        characterName: targetChar.name,
        characterDescription: targetChar.description,
        aspectRatio,
        greetingInstructions,
      });

      const prompt = presetInstructions.trim()
        ? `${presetInstructions}\n\n${templateBody}`
        : templateBody;

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

  const handleUpdateMessages = (newMessages: ChatMessage[]) => {
    if (!activeChatId) {
        // Create new session if none exists (Auto-create for Autonomous Mode)
        const newSession: ChatSession = {
            id: Date.now().toString(),
            name: `Auto Task ${new Date().toLocaleTimeString()}`,
            messages: newMessages,
            createdAt: Date.now(),
            pageId: currentPage
        };
        setChatSessions(prev => [...prev, newSession]);
        setActiveChatId(newSession.id);
        return;
    }
    
    setChatSessions(prev => prev.map(s => {
      if (s.id !== activeChatId) return s;
      return {
        ...s,
        messages: newMessages
      };
    }));
  };

  // Get active session messages for Autonomous Mode
  const activeSession = chatSessions.find(s => s.id === activeChatId);
  const activeMessages = activeSession ? activeSession.messages : [];

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
            messages={activeMessages}
            character={character}
            lorebook={lorebook}
            onSendMessage={() => { }}
            isGenerating={false}
            settings={settings}
            wikiUrl={wikiUrl}
            kbFiles={kbFiles}
            onAddKbFile={(file) => setKbFiles(prev => [...prev, file])}
            onUpdateKbFile={(file) => setKbFiles(prev => prev.map(f => f.id === file.id ? file : f))}
            onUpdateCharacter={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            onAddLorebookEntry={(entry) => {
              console.log("App: Adding lorebook entry", entry);
              setLorebook(prev => ({  
                ...prev, 
                entries: [...prev.entries, {
                  id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  keys: [],
                  secondary_keys: [],
                  content: '',
                  comment: 'New Entry',
                  enabled: true,
                  constant: false,
                  selective: false,
                  insertion_order: 100,
                  position: 'before_char',
                  ...entry
                }] 
              }));
            }}
            onUpdateMessages={handleUpdateMessages}
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
            tokenizer={settings.tokenizer}
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
            customPrompts={customPrompts}
            onCustomPromptsChange={setCustomPrompts}
          />
        )}
      </main>
      {['character', 'lorebook', 'arts', 'scraper'].includes(currentPage) && (
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
      )}

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
