/**
 * fs mock for @agnai/sentencepiece-js
 * It reads from a globally stored ArrayBuffer that we pre-fetched.
 */

export const readFileSync = (path: string): Uint8Array => {
    // Return our globally cached Uint8Array that we fetched asynchronously beforehand
    if ((globalThis as any).__gemmaModelCache) {
        return (globalThis as any).__gemmaModelCache;
    }
    
    console.error('[fs-mock] readFileSync called for', path, 'but no cache is set!');
    return new Uint8Array(0);
};

export default { readFileSync };
