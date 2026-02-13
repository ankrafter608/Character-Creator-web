import type { AppState } from '../types';

const STORAGE_KEY = 'character-creator-state';

export function saveState(state: AppState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save state to localStorage:', e);
    }
}

export function loadState(): AppState | null {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Failed to load state from localStorage:', e);
        return null;
    }
}

export function clearState(): void {
    localStorage.removeItem(STORAGE_KEY);
}
