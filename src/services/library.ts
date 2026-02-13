
import type { CharacterData, LorebookData } from '../types';

const STORAGE_KEYS = {
    CHARACTERS: 'cc_library_characters',
    LOREBOOKS: 'cc_library_lorebooks'
};

export interface LibraryItem<T> {
    id: string;
    name: string;
    timestamp: number;
    data: T;
}

export const LibraryService = {
    // Characters
    saveCharacter: (character: CharacterData): void => {
        const library = LibraryService.getCharacters();
        // Use name as ID for simplicity in this version, or generate UUID if needed. 
        // For now, let's assume name is unique enough or overwrite based on name.
        const id = character.name || 'New Character';

        const newItem: LibraryItem<CharacterData> = {
            id,
            name: character.name || 'Unnamed',
            timestamp: Date.now(),
            data: character
        };

        // Update existing or add new
        const index = library.findIndex(item => item.id === id);
        if (index >= 0) {
            library[index] = newItem;
        } else {
            library.push(newItem);
        }

        localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(library));
    },

    getCharacters: (): LibraryItem<CharacterData>[] => {
        const stored = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
        return stored ? JSON.parse(stored) : [];
    },

    deleteCharacter: (id: string): void => {
        const library = LibraryService.getCharacters().filter(item => item.id !== id);
        localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(library));
    },

    // Lorebooks
    saveLorebook: (lorebook: LorebookData): void => {
        const library = LibraryService.getLorebooks();
        const id = lorebook.name || 'New Lorebook';

        const newItem: LibraryItem<LorebookData> = {
            id,
            name: lorebook.name || 'Unnamed',
            timestamp: Date.now(),
            data: lorebook
        };

        const index = library.findIndex(item => item.id === id);
        if (index >= 0) {
            library[index] = newItem;
        } else {
            library.push(newItem);
        }

        localStorage.setItem(STORAGE_KEYS.LOREBOOKS, JSON.stringify(library));
    },

    getLorebooks: (): LibraryItem<LorebookData>[] => {
        const stored = localStorage.getItem(STORAGE_KEYS.LOREBOOKS);
        return stored ? JSON.parse(stored) : [];
    },

    deleteLorebook: (id: string): void => {
        const library = LibraryService.getLorebooks().filter(item => item.id !== id);
        localStorage.setItem(STORAGE_KEYS.LOREBOOKS, JSON.stringify(library));
    }
};
