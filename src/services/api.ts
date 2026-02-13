import type { APISettings, ChatMessage } from '../types';

interface GenerationResponse {
    content: string;
    error?: string;
}

export async function generateCompletion(
    settings: APISettings,
    messages: ChatMessage[],
    systemPrompt?: string
): Promise<GenerationResponse> {
    const { active_preset } = settings;

    if (!active_preset) {
        return { content: '', error: 'No active preset found' };
    }

    try {
        if (settings.provider === 'gemini') {
            return await generateGemini(settings, messages, systemPrompt);
        } else {
            return await generateOpenAI(settings, messages, systemPrompt);
        }
    } catch (err: any) {
        console.error('API Error:', err);
        return { content: '', error: err.message || 'Unknown API error' };
    }
}

export async function testConnection(settings: APISettings): Promise<{ success: boolean; message: string }> {
    try {
        const testMsg: ChatMessage = { role: 'user', content: 'Hi', id: 'test', timestamp: Date.now() };
        // We use a temporary preset if none is active, or just rely on the active one. 
        // If no active preset, we create a dummy one for the test.
        const effectiveSettings = { ...settings };
        if (!effectiveSettings.active_preset) {
            // Minimal dummy preset for testing
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
    systemPrompt?: string
): Promise<GenerationResponse> {
    const { serverUrl, apiKey, model, active_preset } = settings;

    // Construct messages including system prompt
    const apiMessages = [];

    if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add preset prompts if any (simple injection for now, usually managed by caller but we can add here)
    // For now assuming 'messages' contains history and 'systemPrompt' contains the character definition + scenario

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
        stream: false
    };

    // Ensure URL ends with /chat/completions if not present (unless it's just the base URL)
    // Common convention: serverUrl is "http://localhost:5000/v1"
    const url = serverUrl.endsWith('/') ? `${serverUrl}chat/completions` : `${serverUrl}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { content };
}

async function generateGemini(
    settings: APISettings,
    messages: ChatMessage[],
    systemPrompt?: string
): Promise<GenerationResponse> {
    const { serverUrl, apiKey, model, active_preset } = settings;

    // Gemini API format: https://ai.google.dev/api/rest/v1/models/generateContent
    // Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}

    // If serverUrl is the standard Gemini one, we construct the full URL
    // If it's a proxy, we use it as is? 
    // User instructions said "change url" is possible, so we blindly trust serverUrl if it looks like a full endpoint, 
    // or we append /models/{model}:generateContent if it looks like a base.

    let baseUrl = serverUrl;

    // Remove trailing slash
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    let url = "";

    // Check if URL already contains the path components
    if (baseUrl.endsWith(`/${model}:generateContent`)) {
        // User provided full strict URL
        url = baseUrl;
    } else if (baseUrl.endsWith('/models')) {
        url = `${baseUrl}/${model}:generateContent`;
    } else if (baseUrl.includes('/v1beta/models')) {
        url = `${baseUrl}/${model}:generateContent`;
    } else if (baseUrl.includes('/v1beta')) {
        url = `${baseUrl}/models/${model}:generateContent`;
    } else {
        // Assume base URL (e.g. http://localhost:8888 or https://generativelanguage.googleapis.com)
        url = `${baseUrl}/v1beta/models/${model}:generateContent`;
    }

    // Append API key if not present
    if (!url.includes('key=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}key=${apiKey}`;
    }

    const contents: any[] = [];

    // System prompt in Gemini is usually passed as 'system_instruction' or just a first user message?
    // v1beta supports system_instruction

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

    const body = {
        contents: contents,
        system_instruction: systemInstruction,
        generationConfig: {
            temperature: active_preset?.temperature ?? 0.7,
            topP: active_preset?.top_p ?? 0.95,
            maxOutputTokens: active_preset?.openai_max_tokens ?? 256,
            presencePenalty: active_preset?.presence_penalty ?? 0,
            frequencyPenalty: active_preset?.frequency_penalty ?? 0,
        }
    };

    // Thinking Config (Gemini)
    if (active_preset?.thinking_mode === 'auto' || active_preset?.thinking_mode === 'max') {
        const thinkingConfig: any = {
            includeThoughts: true
        };

        if (active_preset.thinking_mode === 'max') {
            // For 'max', we use the max_tokens as the budget, or a high default if not set
            // If a specific budget is set in preset (optional feature), use it.
            const maxTokens = active_preset.openai_max_tokens ?? 8192;
            thinkingConfig.thinkingBudget = active_preset.thinking_budget || maxTokens;
        }

        // @ts-ignore
        body.generationConfig.thinkingConfig = thinkingConfig;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    // Parse response
    // Parse response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const content = parts.map((p: any) => p.text).filter((t: any) => t).join('\n\n');
    return { content };
}
