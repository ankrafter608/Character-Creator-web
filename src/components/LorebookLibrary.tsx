import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { LorebookData } from '../types';
import { LibraryService } from '../services/library';

interface LorebookLibraryProps {
    currentLorebook: LorebookData;
    onLoad: (lorebook: LorebookData) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const LorebookLibrary: FC<LorebookLibraryProps> = ({ currentLorebook, onLoad, isOpen, onClose }) => {
    const [savedLorebooks, setSavedLorebooks] = useState(LibraryService.getLorebooks());
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSavedLorebooks(LibraryService.getLorebooks());
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!currentLorebook.name) {
            alert("Lorebook needs a name to be saved!");
            return;
        }
        LibraryService.saveLorebook(currentLorebook);
        setSavedLorebooks(LibraryService.getLorebooks());
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this lorebook?")) {
            LibraryService.deleteLorebook(id);
            setSavedLorebooks(LibraryService.getLorebooks());
        }
    };

    const handleLoad = (book: LorebookData) => {
        if (confirm("Load this lorebook? Unsaved changes to current lorebook will be lost.")) {
            onLoad(JSON.parse(JSON.stringify(book)));
            onClose();
        }
    };

    const filtered = savedLorebooks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="bg-surface border border-subtle rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="p-4 border-b border-subtle flex justify-between items-center" style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="text-xl font-bold" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Lorebook Library</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
                </div>

                <div className="p-4" style={{ padding: 'var(--space-lg)' }}>
                    <div className="flex gap-2 mb-4" style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Search lorebooks..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleSave}>
                            Save Current
                        </button>
                    </div>

                    <div className="overflow-y-auto" style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}>
                        {filtered.length === 0 ? (
                            <div className="empty-state">No saved lorebooks found.</div>
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
