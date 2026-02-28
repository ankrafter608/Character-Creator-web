import type { APISettings, ChatMessage } from '../types';

interface GenerationResponse {
    content: string;
    error?: string;
}

// Add interface for overrides
export interface GenerationOverrides {
    thinking_mode?: 'off' | 'auto' | 'minimal' | 'low' | 'medium' | 'high' | 'max';
    thinking_budget?: number;
    temperature?: number;
}

export async function generateCompletion(
    settings: APISettings,
    messages: ChatMessage[],
    systemPrompt?: string,
    onUpdate?: (content: string) => void,
    onThought?: (thought: string) => void,
    overrides?: GenerationOverrides,
    signal?: AbortSignal
): Promise<GenerationResponse> {
    const { active_preset } = settings;

    console.log('[API] generateCompletion called. Provider:', settings.provider, 'Stream:', settings.stream, 'Overrides:', overrides);

    if (!active_preset) {
        return { content: '', error: 'No active preset found' };
    }

    try {
        if (settings.provider === 'gemini') {
            return await generateGemini(settings, messages, systemPrompt, onUpdate, onThought, overrides, signal);
        } else {
            return await generateOpenAI(settings, messages, systemPrompt, onUpdate, signal);
        }
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return { content: '', error: 'Generation aborted' };
        }
        console.error('API Error:', err);
        return { content: '', error: err.message || 'Unknown API error' };
    }
}

export async function testConnection(settings: APISettings): Promise<{ success: boolean; message: string }> {
    try {
        const testMsg: ChatMessage = { role: 'user', content: 'Hi', id: 'test', timestamp: Date.now() };
        const effectiveSettings = { ...settings };
        if (!effectiveSettings.active_preset) {
            effectiveSettings.active_preset = {
                temperature: 0.7,
                frequency_penalty: 0,
                presence_penalty: 0,
                top_p: 0.9,
                top_k: 0,
                top_a: 0,
                min_p: 0,
                repetition_penalty: 1,
                max_context_unlocked: false,
                openai_max_context: 4096,
                openai_max_tokens: 10,
                impersonation_prompt: "",
                new_chat_prompt: "",
                new_group_chat_prompt: "",
                new_example_chat_prompt: "",
                continue_nudge_prompt: "",
                wi_format: "",
                scenario_format: "",
                personality_format: "",
                group_nudge_prompt: "",
                prompts: []
            };
        }

        const response = await generateCompletion(effectiveSettings, [testMsg]);
        if (response.error) {
            return { success: false, message: response.error };
        }
        return { success: true, message: `Success! Response: "${response.content.substring(0, 50)}..."` };
    } catch (err: any) {
        return { success: false, message: err.message || 'Connection failed' };
    }
}

async function generateOpenAI(
    settings: APISettings,
    messages: ChatMessage[],
    systemPrompt?: string,
    onUpdate?: (content: string) => void,
    signal?: AbortSignal
): Promise<GenerationResponse> {
    console.log('[API] generateOpenAI called');
    const { serverUrl, apiKey, model, active_preset } = settings;

    const apiMessages = [];

    if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt });
    }

    const shouldStream = !!onUpdate && (settings.stream ?? true);

    messages.forEach(msg => {
        apiMessages.push({
            role: msg.role,
            content: msg.content
        });
    });

    const body = {
        model: model,
        messages: apiMessages,
        temperature: active_preset?.temperature ?? 0.7,
        presence_penalty: active_preset?.presence_penalty ?? 0,
        frequency_penalty: active_preset?.frequency_penalty ?? 0,
        top_p: active_preset?.top_p ?? 0.9,
        max_tokens: active_preset?.openai_max_tokens ?? 256,
        stream: shouldStream
    };

    const url = serverUrl.endsWith('/') ? `${serverUrl}chat/completions` : `${serverUrl}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    if (shouldStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let accumulatedContent = '';

        while (!done) {
            if (signal?.aborted) {
                reader.cancel();
                throw new Error('Generation aborted');
            }
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const contentDelta = data.choices?.[0]?.delta?.content || '';
                            if (contentDelta) {
                                accumulatedContent += contentDelta;
                                onUpdate(accumulatedContent);
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            }
        }
        return { content: accumulatedContent };
    } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        return { content };
    }
}


async function generateGemini(
    settings: APISettings,
    messages: ChatMessage[],
    systemPrompt?: string,
    onUpdate?: (content: string) => void,
    onThought?: (thought: string) => void,
    overrides?: GenerationOverrides,
    signal?: AbortSignal
): Promise<GenerationResponse> {
    const { serverUrl, apiKey, model, active_preset } = settings;

    let baseUrl = serverUrl.replace(/\/+$/, '');
    
    let endpointUrl = baseUrl;
    if (!baseUrl.includes('/models/')) {
        endpointUrl = `${baseUrl}/models/${model}`;
    }

    const action = onUpdate ? 'streamGenerateContent' : 'generateContent';
    
    let url = `${endpointUrl}:${action}?key=${apiKey}`;

    if (onUpdate) {
        url += '&alt=sse';
    }

    const contents: any[] = [];
    let systemInstruction = undefined;
    if (systemPrompt) {
        systemInstruction = {
            parts: [{ text: systemPrompt }]
        };
    }

    messages.forEach(msg => {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        });
    });

    const body: any = {
        contents: contents,
        system_instruction: systemInstruction,
        generationConfig: {
            temperature: overrides?.temperature ?? active_preset?.temperature ?? 0.7,
            topP: active_preset?.top_p ?? 0.95,
            maxOutputTokens: active_preset?.openai_max_tokens ?? 256,
            presencePenalty: active_preset?.presence_penalty ?? 0,
            frequencyPenalty: active_preset?.frequency_penalty ?? 0,
        }
    };

    // Thinking Config Logic
    // Use override if present, otherwise default to preset
    const thinkingMode = overrides?.thinking_mode ?? active_preset?.thinking_mode ?? 'auto';
    
    if (thinkingMode !== 'off') {
        const thinkingConfig: any = {
            includeThoughts: true
        };

        if (thinkingMode === 'max') {
             // For 'max', we use the max_tokens as the budget, or a high default if not set
            const maxTokens = active_preset?.openai_max_tokens ?? 8192;
            thinkingConfig.thinkingBudget = active_preset?.thinking_budget || maxTokens;
        } else if (thinkingMode !== 'auto') {
             // Budget mapping for minimal, low, medium, high
             const budgetMap: Record<string, number> = {
                'minimal': 128,
                'low': 1024,
                'medium': 4096,
                'high': 16384
            };
            const budget = budgetMap[thinkingMode];
            if (budget) {
                thinkingConfig.thinkingBudget = budget;
            }
        }
        
        // If overrides has specific budget
        if (overrides?.thinking_budget) {
            thinkingConfig.thinkingBudget = overrides.thinking_budget;
        }

        // @ts-ignore
        body.generationConfig.thinkingConfig = thinkingConfig;
    }
    
    console.log('[Gemini API] Request URL:', url);
    // console.log('[Gemini API] Request Body:', JSON.stringify(body, null, 2));

    if (onUpdate) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body for streaming');
        
        const decoder = new TextDecoder("utf-8");
        let accumulatedContent = '';
        let accumulatedThought = '';
        let buffer = '';

        try {
            while (true) {
                if (signal?.aborted) {
                    reader.cancel();
                    throw new Error('Generation aborted');
                }
                const { value, done: readerDone } = await reader.read();
                if (readerDone) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.startsWith('data:')) {
                        const dataStr = trimmedLine.slice(5).trim();
                        if (!dataStr || dataStr === '[DONE]') continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            const candidate = data.candidates?.[0];
                            if (candidate?.content?.parts) {
                                candidate.content.parts.forEach((part: any) => {
                                    // Check for Explicit Thought Part (Google Native)
                                    if (part.thought === true && part.text) {
                                        accumulatedThought += part.text;
                                        if (onThought) onThought(accumulatedThought);
                                        // Do NOT add to content
                                    } 
                                    // Check for "thinking" or "reasoning_content" (Proxy variants)
                                    else if (!part.thought && (part.reasoning_content || part.thinking)) {
                                         // Treat as thought, but might need text extraction logic depending on format
                                         // For now, assume it's just a field we shouldn't show in content
                                         const thoughtText = part.reasoning_content || part.thinking;
                                         if (typeof thoughtText === 'string') {
                                             accumulatedThought += thoughtText;
                                             if (onThought) onThought(accumulatedThought);
                                         }
                                     }
                                     // Normal Text Part
                                     else if (part.text) {
                                         accumulatedContent += part.text;
                                         onUpdate(accumulatedContent);
                                     }
                                });
                            }
                        } catch (e) {
                            // console.warn("Failed to parse Gemini SSE chunk", dataStr);
                        }
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') throw err;
            console.error('[Gemini API] Stream reading error:', err);
            if (accumulatedContent) return { content: accumulatedContent };
            throw err;
        } finally {
             reader.releaseLock();
        }
        return { content: accumulatedContent };

    } else {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        // Parse non-streaming response
        let content = '';
        const parts = data.candidates?.[0]?.content?.parts || [];
        
        // Filter out thoughts for non-streaming too if needed (though usually we just dump text)
        // But for consistency, let's filter.
        parts.forEach((p: any) => {
             if (!p.thought && p.text) {
                 content += p.text;
             }
        });
        
        return { content: content || parts.map((p: any) => p.text).join('') };
    }
}
