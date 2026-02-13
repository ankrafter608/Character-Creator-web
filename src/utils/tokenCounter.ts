/**
 * Token counting utility for estimation.
 * Uses heuristic approximations for different tokenizers.
 * Ideally, we would use 'tiktoken' or 'gpt-tokenizer', but for client-side without heavy deps,
 * we use character-per-token ratios.
 */

export type TokenizerType = 'gemma' | 'openai' | 'claude';

export const countTokens = (text: string, tokenizer: TokenizerType = 'openai'): number => {
    if (!text) return 0;

    switch (tokenizer) {
        case 'gemma':
            // Google's models (Gemma/Gemini) have a very large vocabulary (256k).
            // This results in significantly fewer tokens per character.
            // Observed ratio: 4500 chars / 900 tokens ≈ 5.0 chars/token
            return Math.ceil(text.length / 5);
        case 'claude':
            // Anthropic models (Claude 3) also have large vocabularies.
            // Ratio approx: ~4.5 chars/token
            return Math.ceil(text.length / 4.5);
        case 'openai':
        default:
            // Standard approximation for GPT-4/3.5 (cl100k_base): ~4 chars/token
            return Math.ceil(text.length / 4);
    }
};
