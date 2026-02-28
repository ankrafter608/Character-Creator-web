// The "Brain" of the autonomous agent
import { ToolManager } from './ToolManager';
import { generateCompletion } from '../api';
import { cleanJson } from '../../utils/jsonCleaner';
import { fillTemplate, getDefaultPrompts } from '../../utils/systemPrompts';
import type { AgentMessage, AgentThought, ToolCall, AgentStatus } from './types';
import type { ChatMessage, APISettings } from '../../types';

export class AgentLoop {
  private toolManager: ToolManager;
  private settings: APISettings;
  private context: any; // Contains helper functions (addKbFile, updateCharacter, etc.)
  private statusCallback: (status: AgentStatus) => void;
  private messageCallback: (msg: AgentMessage) => void;
  private abortController: AbortController | null = null;

  constructor(
    settings: APISettings,
    context: any,
    statusCallback: (status: AgentStatus) => void,
    messageCallback: (msg: AgentMessage) => void
  ) {
    this.toolManager = new ToolManager();
    this.settings = settings;
    this.context = context;
    this.statusCallback = statusCallback;
    this.messageCallback = messageCallback;
  }

  updateContext(newContext: any) {
      this.context = { ...this.context, ...newContext };
      if (newContext.settings) {
          this.settings = newContext.settings;
      }
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // The main thinking loop
  async start(messages: ChatMessage[]) {
    this.stop(); // Ensure any previous run is stopped
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.statusCallback('thinking');
    
    // Inject preset prompts
    let presetPrompts = '';
    if (this.settings.active_preset?.prompts) {
        presetPrompts = this.settings.active_preset.prompts
            .filter(p => p.enabled)
            .map(p => p.content)
            .join('\n\n');
    }

    // Convert chat history to API format
    const apiMessages = [...messages];

    // Pre-process messages to inject previous tool outputs
    // We create a new array to avoid mutating the original messages prop deeply if it's reused
    const processedApiMessages = [...apiMessages];
    
    try {
        for (let i = 0; i < processedApiMessages.length; i++) {
            const msg = processedApiMessages[i];
            if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                 const nextMsg = processedApiMessages[i + 1];
                 const hasOutput = nextMsg && nextMsg.role === 'system' && nextMsg.content.includes('Tool Output');
                 
                 if (!hasOutput) {
                     const outputs = msg.toolCalls.map((tc: any) => {
                         if (tc.result) {
                             return `Tool Output (${tc.name}):\n${tc.result}`;
                         }
                         return null;
                     }).filter(Boolean);
    
                     if (outputs.length > 0) {
                         const sysMsg: ChatMessage = {
                             id: `sys_output_${msg.id || i}`,
                             role: 'system',
                             content: outputs.join('\n\n'),
                             timestamp: (msg.timestamp || Date.now()) + 1
                         };
                         // Safe splice
                         processedApiMessages.splice(i + 1, 0, sysMsg);
                         i++; 
                     }
                 }
            }
        }
    } catch (e) {
        console.error('[AgentLoop] Error preprocessing messages:', e);
    }

    // Accumulators for the entire session
    let sessionThoughts: AgentThought[] = [];
    let sessionToolCalls: ToolCall[] = [];

    // Limit loop iterations to prevent infinite loops
    const MAX_STEPS = 5;
    let step = 0;

    while (step < MAX_STEPS) {
      if (signal.aborted) break;
      step++;
      
      const isPlanMode = this.context.agentMode === 'plan';
      const templateId = isPlanMode ? 'agent_plan' : 'agent_build';

      // Fallback to default if somehow missing
      let templateBody = this.context.customPrompts?.[templateId];
      if (!templateBody) {
          templateBody = getDefaultPrompts()[templateId] || '';
      }

      const vars = {
          characterState: JSON.stringify(this.context.character || {}, null, 2),
          lorebookCount: String((this.context.lorebook?.entries || []).length),
          lorebookState: JSON.stringify((this.context.lorebook?.entries || []).map((e: any) => ({ keys: e.keys, comment: e.comment })), null, 2),
          wikiUrl: this.context.wikiUrl || 'Not configured. Provide a valid wikiUrl to research tools if needed.',
          presetPrompts: presetPrompts,
          toolDescriptions: this.toolManager.getSystemPromptPart(this.context.agentMode || 'build')
      };

      const systemPrompt = fillTemplate(templateBody, vars);

      console.log(`[AgentLoop] Step ${step} started`);
      
      // 1. Generate response from AI
      let accumulatedNativeThought = '';
      
      try {
        const response = await generateCompletion(
            this.settings, 
            processedApiMessages, 
            systemPrompt, 
            (partialContent) => {
                if (signal.aborted) return;
                // Update UI with partial content
                const { thoughts: parsedThoughts, commands, text } = this.parseResponse(partialContent);
                
                // Combine session history with current step data
                const currentThoughts = accumulatedNativeThought 
                    ? [{
                        type: 'thought' as const,
                        content: accumulatedNativeThought,
                        timestamp: Date.now()
                    }, ...parsedThoughts] 
                    : parsedThoughts;

                // Append current step commands to session commands
                const currentStepCommands = commands.map(c => ({ ...c, id: `step_${step}_${c.id}` }));
                
                const agentMsg: AgentMessage = {
                  role: 'assistant',
                  content: text,
                  thoughts: [...sessionThoughts, ...currentThoughts],
                  toolCalls: [...sessionToolCalls, ...currentStepCommands]
                };
                this.messageCallback(agentMsg);
            },
            (thoughtPart) => {
                if (signal.aborted) return;
                // Handle Native Thinking (Gemini 2.0)
                accumulatedNativeThought = thoughtPart;
                
                const agentMsg: AgentMessage = {
                    role: 'assistant',
                    content: '', 
                    thoughts: [...sessionThoughts, {
                        type: 'thought' as const,
                        content: accumulatedNativeThought,
                        timestamp: Date.now()
                    }],
                    toolCalls: [...sessionToolCalls]
                };
                this.messageCallback(agentMsg);
            },
            {},
            signal
        );

        if (signal.aborted) break;

        const content = response.content;

        if (!content) {
            if (response.error === 'Generation aborted') break;
            console.error('[AgentLoop] No content received from API');
            this.statusCallback('error');
            return;
        }

        // 2. Parse the response for thoughts and commands
        const { thoughts: finalParsedThoughts, commands, text } = this.parseResponse(content);
        
        let currentStepThoughts = finalParsedThoughts;
        if (accumulatedNativeThought) {
            currentStepThoughts = [{
                type: 'thought',
                content: accumulatedNativeThought,
                timestamp: Date.now()
            }, ...finalParsedThoughts];
        }

        // Update session accumulators PERMANENTLY for this step
        sessionThoughts = [...sessionThoughts, ...currentStepThoughts];
        
        const uniqueCommands = commands.map(cmd => ({
            ...cmd,
            id: `step_${step}_${cmd.id}`
        }));
        sessionToolCalls = [...sessionToolCalls, ...uniqueCommands];

        // Final update for this step
        const agentMsg: AgentMessage = {
            role: 'assistant',
            content: text,
            thoughts: sessionThoughts,
            toolCalls: sessionToolCalls
        };
        
        this.messageCallback(agentMsg);

        // 3. Execute commands if any
        if (uniqueCommands.length > 0) {
            this.statusCallback('executing');
            console.log(`[AgentLoop] Step ${step}: Executing ${uniqueCommands.length} commands`);

            for (const cmd of uniqueCommands) {
            if (signal.aborted) break;
            console.log(`[AgentLoop] Executing command: ${cmd.name}`, cmd.arguments);
            const result = await this.toolManager.execute(cmd.name, cmd.arguments, this.context);
            
            // Update the specific command in the SESSION array with its result
            const cmdInSession = sessionToolCalls.find(c => c.id === cmd.id);
            if (cmdInSession) {
                cmdInSession.result = result;
            }
            
            // Send update to UI
            const updatedAgentMsg: AgentMessage = {
                role: 'assistant',
                content: text,
                thoughts: sessionThoughts,
                toolCalls: [...sessionToolCalls]
            };
            this.messageCallback(updatedAgentMsg);
            
            // Feed result back
            processedApiMessages.push({
                id: `step_${step}_cmd_${cmd.id}_req`,
                timestamp: Date.now(),
                role: 'assistant',
                content: `<command name="${cmd.name}">...</command>` 
            });
            
            processedApiMessages.push({
                id: `step_${step}_cmd_${cmd.id}_res`,
                timestamp: Date.now(),
                role: 'system',
                content: `Tool Output (${cmd.name}):\n${result}`
            });
            }

            if (signal.aborted) break;
            this.statusCallback('observing');
            continue; 
        } else {
            this.statusCallback('idle');
            break;
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message === 'Generation aborted') {
          console.log('[AgentLoop] Aborted');
          break;
        }
        throw err;
      }
    }
    
    this.statusCallback('idle');
    this.abortController = null;
  }

  // Parse XML-like tags from the AI response
  private parseResponse(content: string) {
    const thoughts: AgentThought[] = [];
    const commands: ToolCall[] = [];
    let text = content;

    // 1. Extract Thoughts: <thought>...</thought>
    const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/g;
    let match;
    while ((match = thoughtRegex.exec(content)) !== null) {
      thoughts.push({
        type: 'thought',
        content: match[1].trim(),
        timestamp: Date.now()
      });
      // Remove thought from display text
      text = text.replace(match[0], ''); 
    }

    // 1.5 Handle Pending Thought (Streaming)
    // Check for an unclosed <thought> tag at the end
    const pendingThoughtMatch = text.match(/<thought>([\s\S]*)$/);
    if (pendingThoughtMatch) {
        thoughts.push({
            type: 'thought',
            content: pendingThoughtMatch[1].trim(),
            timestamp: Date.now()
        });
        // Remove pending thought from display text so it doesn't show as raw HTML
        text = text.replace(pendingThoughtMatch[0], '');
    }

    // 2. Extract Commands: <command name="...">...</command>
    // More robust regex to handle variations like single quotes or missing quotes
    const commandRegex = /<command\s+name=["']?([^"'>]+)["']?>([\s\S]*?)<\/command>/g;
    while ((match = commandRegex.exec(content)) !== null) {
      const toolName = match[1];
      const argsString = match[2].trim();
      let args = {};
      
      console.log(`[AgentLoop] Found command: ${toolName}. Raw args:`, argsString);

      // Use robust JSON cleaner
      const cleaned = cleanJson(argsString);
      if (cleaned && typeof cleaned === 'object') {
          args = cleaned;
          console.log(`[AgentLoop] Parsed args for ${toolName}:`, args);
      } else {
          console.warn(`[AgentLoop] Failed to parse args for ${toolName}. Raw:`, argsString);
      }

      commands.push({
        id: `cmd_${match.index}`,
        name: toolName,
        arguments: args
      });
      // Remove command from display text
      text = text.replace(match[0], '');
    }

    // 2.5 Handle Pending Command (Streaming)
    // Check for unclosed command tag
    const pendingCommandMatch = text.match(/<command\s+name="([^"]+)">([\s\S]*)$/);
    if (pendingCommandMatch) {
        const toolName = pendingCommandMatch[1];
        const partialArgs = pendingCommandMatch[2].trim();
        commands.push({
            id: `pending_cmd_${Date.now()}`,
            name: toolName,
            arguments: { _raw: partialArgs, _status: 'pending' }
        });
        // Remove pending command from display text
        text = text.replace(pendingCommandMatch[0], '');
    }

    return { thoughts, commands, text: text.trim() };
  }
}
