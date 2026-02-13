
import { useState, useMemo } from 'react';
import type { FC } from 'react';
import type { CharacterHistoryEntry, LorebookHistoryEntry } from '../types';
import { computeLineDiff } from '../utils/diffUtils';

interface HistoryViewerProps {
    characterHistory: CharacterHistoryEntry[];
    lorebookHistory: LorebookHistoryEntry[];
    onRestoreCharacter: (entry: CharacterHistoryEntry) => void;
    onRestoreLorebook: (entry: LorebookHistoryEntry) => void;
}

type ActiveTab = 'character' | 'lorebook';

export const HistoryViewer: FC<HistoryViewerProps> = ({
    characterHistory,
    lorebookHistory,
    onRestoreCharacter,
    onRestoreLorebook,
}) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('character');
    const [selectedCharEntryId, setSelectedCharEntryId] = useState<string | null>(
        characterHistory.length > 0 ? characterHistory[characterHistory.length - 1].id : null
    );
    const [selectedLoreEntryId, setSelectedLoreEntryId] = useState<string | null>(
        lorebookHistory.length > 0 ? lorebookHistory[lorebookHistory.length - 1].id : null
    );

    const sortedCharHistory = [...characterHistory].sort((a, b) => b.timestamp - a.timestamp);
    const sortedLoreHistory = [...lorebookHistory].sort((a, b) => b.timestamp - a.timestamp);

    const selectedCharEntry = characterHistory.find(e => e.id === selectedCharEntryId);
    const selectedLoreEntry = lorebookHistory.find(e => e.id === selectedLoreEntryId);

    // Find previous entry for diffing (chronologically before selected)
    const previousCharEntry = useMemo(() => {
        if (!selectedCharEntry) return null;
        const index = characterHistory.findIndex(e => e.id === selectedCharEntry.id);
        return characterHistory[index - 1] || null;
    }, [selectedCharEntry, characterHistory]);

    const previousLoreEntry = useMemo(() => {
        if (!selectedLoreEntry) return null;
        const index = lorebookHistory.findIndex(e => e.id === selectedLoreEntry.id);
        return lorebookHistory[index - 1] || null;
    }, [selectedLoreEntry, lorebookHistory]);

    // Compute Diffs
    const characterDiff = useMemo(() => {
        if (!selectedCharEntry) return [];
        const oldChar = previousCharEntry ? JSON.stringify(previousCharEntry.snapshot, null, 2) : '';
        const newChar = JSON.stringify(selectedCharEntry.snapshot, null, 2);
        return computeLineDiff(oldChar, newChar);
    }, [selectedCharEntry, previousCharEntry]);

    const lorebookDiff = useMemo(() => {
        if (!selectedLoreEntry) return [];
        const oldLore = previousLoreEntry ? JSON.stringify(previousLoreEntry.snapshot, null, 2) : '';
        const newLore = JSON.stringify(selectedLoreEntry.snapshot, null, 2);
        return computeLineDiff(oldLore, newLore);
    }, [selectedLoreEntry, previousLoreEntry]);

    const handleRestoreCharacter = () => {
        if (selectedCharEntry && confirm(`Are you sure you want to restore character from ${new Date(selectedCharEntry.timestamp).toLocaleTimeString()}? Current unsaved changes will be lost.`)) {
            onRestoreCharacter(selectedCharEntry);
        }
    };

    const handleRestoreLorebook = () => {
        if (selectedLoreEntry && confirm(`Are you sure you want to restore lorebook from ${new Date(selectedLoreEntry.timestamp).toLocaleTimeString()}? Current unsaved changes will be lost.`)) {
            onRestoreLorebook(selectedLoreEntry);
        }
    };

    const renderVersionList = (
        entries: (CharacterHistoryEntry | LorebookHistoryEntry)[],
        selectedId: string | null,
        onSelect: (id: string) => void
    ) => (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-xs)' }}>
            {entries.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-description">No history yet</div>
                </div>
            ) : (
                entries.map(entry => (
                    <div
                        key={entry.id}
                        style={{
                            padding: 'var(--space-md)',
                            background: selectedId === entry.id ? 'var(--bg-elevated)' : 'transparent',
                            borderLeft: selectedId === entry.id ? '3px solid var(--primary)' : '3px solid transparent',
                            marginBottom: '2px',
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer'
                        }}
                        onClick={() => onSelect(entry.id)}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <div className={`badge ${entry.source === 'ai' ? 'badge-primary' : 'badge-muted'}`} style={{ fontSize: '0.7rem' }}>
                                {entry.source.toUpperCase()}
                            </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {entry.summary}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {new Date(entry.timestamp).toLocaleDateString()}
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderDiffViewer = (
        diff: { type: 'added' | 'removed' | 'unchanged'; content: string }[],
        title: string
    ) => (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-sm)' }}>
                {title}
            </h3>
            <div className="code-block" style={{ fontFamily: 'monospace', fontSize: '0.9rem', background: '#000' }}>
                {diff.map((line, i) => (
                    <div key={i} style={{
                        backgroundColor: line.type === 'added' ? 'rgba(0, 255, 0, 0.15)' :
                            line.type === 'removed' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
                        color: line.type === 'removed' ? 'var(--text-muted)' : 'var(--text-primary)',
                        display: 'flex',
                        padding: '0 4px'
                    }}>
                        <span style={{
                            width: '20px',
                            display: 'inline-block',
                            color: 'var(--text-muted)',
                            userSelect: 'none',
                            marginRight: '8px'
                        }}>
                            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.content}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <button
                    className={`btn ${activeTab === 'character' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('character')}
                >
                    👤 Character History ({characterHistory.length})
                </button>
                <button
                    className={`btn ${activeTab === 'lorebook' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('lorebook')}
                >
                    📚 Lorebook History ({lorebookHistory.length})
                </button>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', padding: 0 }}>

                {/* Left Sidebar: Version List */}
                <div style={{
                    width: '300px',
                    borderRight: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg-surface)'
                }}>
                    <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <h3 style={{ margin: 0 }}>📜 {activeTab === 'character' ? 'Character' : 'Lorebook'} Versions</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {activeTab === 'character' ? characterHistory.length : lorebookHistory.length} versions stored
                        </p>
                    </div>

                    {activeTab === 'character'
                        ? renderVersionList(sortedCharHistory, selectedCharEntryId, setSelectedCharEntryId)
                        : renderVersionList(sortedLoreHistory, selectedLoreEntryId, setSelectedLoreEntryId)
                    }
                </div>

                {/* Right Area: Diff Viewer */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
                    {activeTab === 'character' && selectedCharEntry ? (
                        <>
                            <div style={{
                                padding: 'var(--space-md)',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: 'var(--bg-surface)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                                        Character @ {new Date(selectedCharEntry.timestamp).toLocaleString()}
                                    </h2>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        vs Previous Version
                                    </span>
                                </div>
                                <button className="btn btn-warning" onClick={handleRestoreCharacter}>
                                    ⏪ Restore Character
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
                                {renderDiffViewer(characterDiff, '👤 Character Data')}
                            </div>
                        </>
                    ) : activeTab === 'lorebook' && selectedLoreEntry ? (
                        <>
                            <div style={{
                                padding: 'var(--space-md)',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: 'var(--bg-surface)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                                        Lorebook @ {new Date(selectedLoreEntry.timestamp).toLocaleString()}
                                    </h2>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        vs Previous Version
                                    </span>
                                </div>
                                <button className="btn btn-warning" onClick={handleRestoreLorebook}>
                                    ⏪ Restore Lorebook
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
                                {renderDiffViewer(lorebookDiff, '📚 Lorebook Data')}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state" style={{ flex: 1 }}>
                            <div className="empty-state-icon">🕑</div>
                            <div className="empty-state-title">Select a version</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
