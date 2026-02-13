import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { CharacterData } from '../types';
import { LibraryService } from '../services/library';

interface CharacterLibraryProps {
    currentCharacter: CharacterData;
    onLoad: (character: CharacterData) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const CharacterLibrary: FC<CharacterLibraryProps> = ({ currentCharacter, onLoad, isOpen, onClose }) => {
    const [savedCharacters, setSavedCharacters] = useState(LibraryService.getCharacters());
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSavedCharacters(LibraryService.getCharacters());
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!currentCharacter.name) {
            alert("Character needs a name to be saved!");
            return;
        }
        LibraryService.saveCharacter(currentCharacter);
        setSavedCharacters(LibraryService.getCharacters());
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this character?")) {
            LibraryService.deleteCharacter(id);
            setSavedCharacters(LibraryService.getCharacters());
        }
    };

    const handleLoad = (char: CharacterData) => {
        if (confirm("Load this character? Unsaved changes to current character will be lost.")) {
            // Create a deep copy to ensure state updates correctly
            // Simple JSON parse/stringify is enough for this data structure
            onLoad(JSON.parse(JSON.stringify(char)));
            onClose();
        }
    };

    const filtered = savedCharacters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="bg-surface border border-subtle rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="p-4 border-b border-subtle flex justify-between items-center" style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="text-xl font-bold" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Character Library</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
                </div>

                <div className="p-4" style={{ padding: 'var(--space-lg)' }}>
                    <div className="flex gap-2 mb-4" style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Search characters..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleSave}>
                            Save Current
                        </button>
                    </div>

                    <div className="overflow-y-auto" style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}>
                        {filtered.length === 0 ? (
                            <div className="empty-state">No saved characters found.</div>
                        ) : (
                            <div className="grid gap-2" style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                                {filtered.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleLoad(item.data)}
                                        className="p-3 border border-subtle rounded hover:bg-hover cursor-pointer flex justify-between items-center"
                                        style={{ padding: 'var(--space-md)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)' }}
                                    >
                                        <div>
                                            <div className="font-bold">{item.name}</div>
                                            <div className="text-xs text-muted" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Last saved: {new Date(item.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(item.id, e)}
                                            className="btn btn-danger btn-sm btn-icon"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
