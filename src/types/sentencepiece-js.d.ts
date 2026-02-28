declare module '@agnai/sentencepiece-js' {
    export class SentencePieceProcessor {
        constructor();
        load(urlOrPath: string): Promise<void>;
        loadVocabulary(urlOrPath: string): Promise<void>;
        encodeIds(text: string): number[];
        decodeIds(ids: number[]): string;
    }
}
