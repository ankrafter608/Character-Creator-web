import { useState } from 'react';
import type { FC } from 'react';
import type { LorebookData, LorebookEntry } from '../types';

interface LorebookEditorProps {
    lorebook: LorebookData;
    onChange: (lorebook: LorebookData) => void;
    onOpenLibrary: () => void;
}

const createEmptyEntry = (): LorebookEntry => ({
    id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    keys: [],
    secondary_keys: [],
    content: '',
    comment: '',
    enabled: true,
    constant: false,
    selective: false,
    insertion_order: 0,
    position: 'before_char',
});

export const LorebookEditor: FC<LorebookEditorProps> = ({ lorebook, onChange, onOpenLibrary }) => {
    const [activeEntryId, setActiveEntryId] = useState<string | null>(
        lorebook.entries.length > 0 ? lorebook.entries[0].id : null
    );

    const activeEntry = lorebook.entries.find((e) => e.id === activeEntryId);

    const handleAddEntry = () => {
        const newEntry = createEmptyEntry();
        onChange({
            ...lorebook,
            entries: [...lorebook.entries, newEntry],
        });
        setActiveEntryId(newEntry.id);
    };

    const handleDeleteEntry = (entryId: string) => {
        const newEntries = lorebook.entries.filter((e) => e.id !== entryId);
        onChange({ ...lorebook, entries: newEntries });
        if (activeEntryId === entryId) {
            setActiveEntryId(newEntries.length > 0 ? newEntries[0].id : null);
        }
    };

    const handleEntryChange = (field: keyof LorebookEntry, value: unknown) => {
        if (!activeEntryId) return;
        const newEntries = lorebook.entries.map((entry) =>
            entry.id === activeEntryId ? { ...entry, [field]: value } : entry
        );
        onChange({ ...lorebook, entries: newEntries });
    };

    return (
        <div className="page-content">
            {/* Lorebook Settings */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <div className="card-title">📚 Lorebook Settings</div>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                        <div className="input-group">
                            <label className="input-label">Name</label>
                            <input
                                type="text"
                                className="input"
                                value={lorebook.name}
                                onChange={(e) => onChange({ ...lorebook, name: e.target.value })}
                                placeholder="My Lorebook"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Scan Depth</label>
                            <input
                                type="number"
                                className="input"
                                value={lorebook.scan_depth}
                                onChange={(e) => onChange({ ...lorebook, scan_depth: parseInt(e.target.value) || 0 })}
                                min={0}
                                max={100}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Token Budget</label>
                            <input
                                type="number"
                                className="input"
                                value={lorebook.token_budget}
                                onChange={(e) => onChange({ ...lorebook, token_budget: parseInt(e.target.value) || 0 })}
                                min={0}
                            />
                        </div>
                        <div className="input-group" style={{ alignSelf: 'end' }}>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={lorebook.recursive_scanning}
                                    onChange={(e) => onChange({ ...lorebook, recursive_scanning: e.target.checked })}
                                />
                                Recursive Scanning
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Entries Layout */}
            <div className="lorebook-layout">
                {/* Entries Sidebar */}
                <div className="entries-sidebar">
                    <div className="entries-header">
                        <span className="entries-title">Entries ({lorebook.entries.length})</span>
                        <button className="btn btn-primary btn-sm" onClick={handleAddEntry}>+ Add</button>
                    </div>
                    <div className="entries-list">
                        {lorebook.entries.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                                <div className="empty-state-icon" style={{ fontSize: '2rem' }}>📝</div>
                                <div className="empty-state-title" style={{ fontSize: '0.9rem' }}>No entries yet</div>
                                <button className="btn btn-primary btn-sm" onClick={handleAddEntry}>
                                    Create First Entry
                                </button>
                            </div>
                        ) : (
                            lorebook.entries.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className={`entry-item ${activeEntryId === entry.id ? 'active' : ''}`}
                                    onClick={() => setActiveEntryId(entry.id)}
                                >
                                    <div className="entry-item-title">
                                        <span style={{ opacity: 0.5, marginRight: 'var(--space-sm)' }}>#{index + 1}</span>
                                        {entry.comment || entry.keys.join(', ') || 'Untitled'}
                                        {entry.constant && <span style={{ marginLeft: 'var(--space-xs)' }}>📌</span>}
                                    </div>
                                    <div className="entry-item-keys">
                                        {entry.keys.slice(0, 3).join(', ')}
                                        {entry.keys.length > 3 && ` +${entry.keys.length - 3}`}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Entry Editor */}
                <div className="entry-editor">
                    {activeEntry ? (
                        <>
                            <div className="entry-editor-header">
                                <h4 style={{ margin: 0 }}>{activeEntry.comment || 'Edit Entry'}</h4>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button className="btn btn-ghost btn-sm" title="Generate with AI">
                                        ✨ Generate
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleDeleteEntry(activeEntry.id)}
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>
                            <div className="entry-editor-body">
                                <div className="input-group">
                                    <label className="input-label">Title / Comment</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={activeEntry.comment}
                                        onChange={(e) => handleEntryChange('comment', e.target.value)}
                                        placeholder="Entry title or description"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Keys (comma separated)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={activeEntry.keys.join(', ')}
                                        onChange={(e) => handleEntryChange('keys', e.target.value.split(',').map(k => k.trim()).filter(k => k))}
                                        placeholder="keyword1, keyword2, keyword3"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Secondary Keys (optional)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={activeEntry.secondary_keys.join(', ')}
                                        onChange={(e) => handleEntryChange('secondary_keys', e.target.value.split(',').map(k => k.trim()).filter(k => k))}
                                        placeholder="filter1, filter2"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Content</label>
                                    <textarea
                                        className="input textarea textarea-large"
                                        value={activeEntry.content}
                                        onChange={(e) => handleEntryChange('content', e.target.value)}
                                        placeholder="The lore content that will be injected when keys are triggered..."
                                    />
                                </div>

                                <div className="entry-options">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={activeEntry.enabled}
                                            onChange={(e) => handleEntryChange('enabled', e.target.checked)}
                                        />
                                        Enabled
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={activeEntry.constant}
                                            onChange={(e) => handleEntryChange('constant', e.target.checked)}
                                        />
                                        Always Active
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={activeEntry.selective}
                                            onChange={(e) => handleEntryChange('selective', e.target.checked)}
                                        />
                                        Selective
                                    </label>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
                                    <div className="input-group">
                                        <label className="input-label">Insertion Order</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={activeEntry.insertion_order}
                                            onChange={(e) => handleEntryChange('insertion_order', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Position</label>
                                        <select
                                            className="input"
                                            value={activeEntry.position}
                                            onChange={(e) => handleEntryChange('position', e.target.value)}
                                        >
                                            <option value="before_char">Before Character</option>
                                            <option value="after_char">After Character</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state" style={{ flex: 1 }}>
                            <div className="empty-state-icon">📚</div>
                            <div className="empty-state-title">Select an entry or create a new one</div>
                            <button className="btn btn-primary" onClick={handleAddEntry}>
                                + Create Entry
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div style={{
                marginTop: 'var(--space-xl)',
                display: 'flex',
                gap: 'var(--space-md)',
                justifyContent: 'flex-end',
                paddingTop: 'var(--space-lg)',
                borderTop: '1px solid var(--border-subtle)'
            }}>
                <input
                    type="file"
                    id="lorebook-import"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            try {
                                const content = evt.target?.result as string;
                                const parsed = JSON.parse(content);

                                let newEntries: LorebookEntry[] = [];

                                // Handle ST format where entries is an object map
                                const entriesRaw = parsed.entries || parsed;
                                const values = Array.isArray(entriesRaw) ? entriesRaw : Object.values(entriesRaw);

                                newEntries = values.map((entry: any) => ({
                                    id: entry.uid?.toString() || entry.id?.toString() || `imported_${Math.random().toString(36).substr(2, 9)}`,
                                    keys: entry.key || entry.keys || [],
                                    secondary_keys: entry.keysecondary || entry.secondary_keys || [],
                                    content: entry.content || '',
                                    comment: entry.comment || '',
                                    enabled: entry.disable === undefined ? (entry.enabled !== false) : !entry.disable,
                                    constant: !!entry.constant,
                                    selective: !!entry.selective,
                                    insertion_order: entry.order || 100,
                                    position: entry.position === 1 ? 'after_char' : 'before_char'
                                }));

                                onChange({
                                    ...lorebook,
                                    name: file.name.replace('.json', ''),
                                    entries: newEntries
                                });
                                if (newEntries.length > 0) {
                                    setActiveEntryId(newEntries[0].id);
                                }
                            } catch (err) {
                                console.error(err);
                                alert("Failed to parse Lorebook JSON");
                            }
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                    }}
                />
                <button className="btn btn-secondary" onClick={onOpenLibrary}>Load Lorebook</button>
                <button
                    className="btn btn-secondary"
                    onClick={() => {
                        // Export in ST-compatible format (object map)
                        const stFormatEntries: Record<string, any> = {};
                        lorebook.entries.forEach((entry, index) => {
                            stFormatEntries[index.toString()] = {
                                uid: index, // ST uses integer UIDs usually
                                key: entry.keys,
                                keysecondary: entry.secondary_keys,
                                comment: entry.comment,
                                content: entry.content,
                                constant: entry.constant,
                                selective: entry.selective,
                                order: entry.insertion_order,
                                position: entry.position === 'after_char' ? 1 : 0,
                                disable: !entry.enabled,
                                excludeRecursion: false,
                                probability: 100,
                                useProbability: true,
                                displayIndex: index
                            };
                        });

                        const exportData = { entries: stFormatEntries };

                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                        const downloadAnchorNode = document.createElement('a');
                        downloadAnchorNode.setAttribute("href", dataStr);
                        downloadAnchorNode.setAttribute("download", `${lorebook.name || 'lorebook'}.json`);
                        document.body.appendChild(downloadAnchorNode);
                        downloadAnchorNode.click();
                        downloadAnchorNode.remove();
                    }}
                >
                    Export JSON
                </button>
                <button className="btn btn-primary" onClick={onOpenLibrary}>Save Lorebook</button>
            </div>
        </div>
    );
};
