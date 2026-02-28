import { getEncoding, type Tiktoken } from 'js-tiktoken';
import { SentencePieceProcessor } from '@agnai/sentencepiece-js';
import { useState, useEffect } from 'react';

/**
 * Supported tokenizers in the application.
 */
export type TokenizerType = 'gemma' | 'openai' | 'claude';

/**
 * Singleton manager for tokenizers to avoid redundant loading
 * and parse multiple requests smoothly.
 */
class TokenizerManager {
    private static instance: TokenizerManager;
    private gemmaProcessor: SentencePieceProcessor | null = null;
    private gemmaLoadingPromise: Promise<void> | null = null;
    private openaiEncoding: Tiktoken | null = null;

    private constructor() {}

    static getInstance() {
        if (!TokenizerManager.instance) {
            TokenizerManager.instance = new TokenizerManager();
        }
        return TokenizerManager.instance;
    }

    async getOpenAITokenizer(): Promise<Tiktoken> {
        if (!this.openaiEncoding) {
            // cl100k_base is used by GPT-3.5, GPT-4, and GPT-4o.
            // Loading js-tiktoken is synchronous and fast.
            this.openaiEncoding = getEncoding('cl100k_base');
        }
        return this.openaiEncoding;
    }

    async getGemmaTokenizer(): Promise<SentencePieceProcessor> {
        if (this.gemmaProcessor) return this.gemmaProcessor;
        
        if (!this.gemmaLoadingPromise) {
            this.gemmaLoadingPromise = (async () => {
                // Pre-fetch the model file so our fs-mock can read it synchronously
                const modelUrl = `${import.meta.env.BASE_URL}tokenizers/gemma.model`.replace('//', '/');
                const response = await fetch(modelUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch gemma.model: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                (globalThis as any).__gemmaModelCache = new Uint8Array(arrayBuffer);

                const spp = new SentencePieceProcessor();
                // Assumes the model is hosted at the root of the public directory or considers base URL
                // spp.load will call our fs-mock which reads from __gemmaModelCache
                await spp.load(modelUrl); // .load is for .model files, .loadVocabulary is for .vocab
                this.gemmaProcessor = spp;
            })();
        }
        
        await this.gemmaLoadingPromise;
        return this.gemmaProcessor!;
    }
}

/**
 * Fast synchronous heuristic fallback.
 * Used instantly while the real tokenizer is loading in the background
 * to prevent UI layout shifts or freezes.
 */
export const countTokensHeuristic = (text: string, tokenizer: TokenizerType = 'openai'): number => {
    if (!text) return 0;
    switch (tokenizer) {
        case 'gemma': return Math.ceil(text.length / 5);
        case 'claude': return Math.ceil(text.length / 4.5);
        case 'openai':
        default: return Math.ceil(text.length / 4);
    }
};

/**
 * Asynchronous precise token counting.
 */
export const countTokensAsync = async (text: string, tokenizer: TokenizerType = 'openai'): Promise<number> => {
    if (!text) return 0;

    try {
        const manager = TokenizerManager.getInstance();
        
        if (tokenizer === 'gemma') {
            const spp = await manager.getGemmaTokenizer();
            return spp.encodeIds(text).length;
        } else if (tokenizer === 'openai') {
            const enc = await manager.getOpenAITokenizer();
            return enc.encode(text).length;
        }
        
        // Fallback to heuristic for unsupported tokenizers (e.g., claude, until implemented)
        return countTokensHeuristic(text, tokenizer);
    } catch (error) {
        console.error(`[TokenCounter] Failed to count tokens with ${tokenizer}:`, error);
        return countTokensHeuristic(text, tokenizer);
    }
};

/**
 * Custom React Hook for UI components to display accurate token counts seamlessly.
 * Immediately returns a heuristic estimate, then silently updates with the exact count.
 */
export const useTokenCount = (text: string, tokenizer: TokenizerType = 'openai'): number => {
    const [count, setCount] = useState<number>(() => countTokensHeuristic(text, tokenizer));

    useEffect(() => {
        let isMounted = true;
        
        // Instant update using the heuristic (makes typing feel instantaneous)
        setCount(countTokensHeuristic(text, tokenizer));

        const fetchExactCount = async () => {
            const exactCount = await countTokensAsync(text, tokenizer);
            if (isMounted) {
                setCount(exactCount);
            }
        };

        // Debounce exact count to prevent blocking the main thread during rapid typing
        const timer = setTimeout(() => {
            fetchExactCount();
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [text, tokenizer]);

    return count;
};

// Expose synchronous method for backwards compatibility where refactoring is impossible.
// Ideally, use `useTokenCount` hook or `countTokensAsync`.
export const countTokens = (text: string, tokenizer: TokenizerType = 'openai'): number => {
    return countTokensHeuristic(text, tokenizer);
};