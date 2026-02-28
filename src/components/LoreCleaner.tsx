import { useState } from 'react';
import type { FC } from 'react';
import type { KBFile, APISettings, ChatMessage } from '../types';
import { generateCompletion } from '../services/api';

interface LoreCleanerProps {
    files: KBFile[];
    onFilesChange: (files: KBFile[]) => void;
    settings: APISettings;
}

type CleanMode = 'strip' | 'summary' | 'heavy_summary';

const modeDescriptions: Record<CleanMode, { icon: string; label: string; description: string }> = {
    strip: {
        icon: '🧹',
        label: 'Strip',
        description: 'Remove technical noise but keep ALL text intact',
    },
    summary: {
        icon: '🗜️',
        label: 'Normal',
        description: 'Remove noise and perform light summarization',
    },
    heavy_summary: {
        icon: '📦',
        label: 'Heavy',
        description: 'Extract only critical facts, heavy compression',
    },
};

const cleanPrompts: Record<CleanMode, string> = {
    strip: `You are an expert lore extractor. Your job is to strip away all technical noise and "Wiki garbage" from the provided text, leaving only the clean lore content.

REMOVE ALL OF THE FOLLOWING:
- Navigation menus, sidebars, and category lists (e.g., "Navigation", "Characters in X series", "Hagun Academy", "Staffs", "Members", "See also").
- Website metadata, timestamps, headers/footers, and site-specific links.
- Markdown syntax (headers #, bold **, italic *, links [](), etc.)
- HTML tags, JSON/code syntax, and code fences.
- Unnecessary asterisks, underscores, and formatting characters.
- Excessive whitespace and duplicate empty lines.

Rules:
1. Keep ALL actual factual lore content, character descriptions, abilities, and story info.
2. If a section or paragraph is clearly just a site navigation menu or a list of related links, REMOVE IT COMPLETELY.
3. Output ONLY the cleaned plain text. No commentary or meta-headers.
4. Preserve paragraph breaks as single empty lines.`,

    summary: `You are a text cleaner and summarizer. First, remove all formatting noise and "Wiki garbage" (navigation menus, sidebars, metadata, markdown, HTML). Then lightly summarize the content — compress it while keeping ALL important lore facts.

Rules:
1. Aggressively remove all site navigation, sidebar links, and metadata.
2. Summarize lightly — shorten verbose passages but keep ALL key facts, names, abilities, and relationships.
3. Output ONLY the cleaned and summarized text. No commentary.`,

    heavy_summary: `You are a meticulous editor. Your job is to condense the text while preserving ALL factual information, but removing fluff, repetition, and site navigation garbage.

Rules:
1. Remove all site navigation, sidebars, and metadata.
2. Keep ALL facts: what things are, what they do, history, appearance, relationships.
3. Only remove: purely decorative flowery prose, excessive repetition, and site garbage.
4. The output should be dense with information but still readable prose.
5. Output ONLY the result text. No commentary.`,
};

export const LoreCleaner: FC<LoreCleanerProps> = ({ files, onFilesChange, settings }) => {
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [cleanMode, setCleanMode] = useState<CleanMode>('strip');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'tokens'>('name');
    const [processing, setProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, fileName: '' });

    const filteredFiles = files
        .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'size': return b.content.length - a.content.length; // Descending size
                case 'tokens': return (b.tokens || 0) - (a.tokens || 0); // Descending tokens
                default: return 0;
            }
        });

    const toggleFile = (id: string) => {
        setSelectedFiles((prev) =>
            prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
        );
    };

    const selectAll = () => setSelectedFiles(filteredFiles.map((f) => f.id));
    const selectNone = () => setSelectedFiles([]);
    const selectUnprocessed = () => {
        setSelectedFiles(filteredFiles.filter((f) => !f.cleanMode || f.cleanMode === 'rejected').map((f) => f.id));
    };

    const getStatusBadge = (mode?: string) => {
        switch (mode) {
            case 'strip': return <span className="badge badge-success">🧹 Stripped</span>;
            case 'summary': return <span className="badge badge-success">🗜️ Summarized</span>;
            case 'heavy_summary': return <span className="badge badge-success">📦 Heavy</span>;
            case 'rejected': return <span className="badge badge-error">❌ Rejected</span>;
            default: return <span className="badge badge-muted">New</span>;
        }
    };

    const handleCleanSelected = async () => {
        if (selectedFiles.length === 0 || processing) return;
        setProcessing(true);
        setProcessProgress({ current: 0, total: selectedFiles.length, fileName: 'Starting parallel processing...' });

        const updatedFiles = [...files];
        const results: Record<string, { content?: string, error?: boolean }> = {};
        let finishedCount = 0;

        // Process all selected files in parallel
        await Promise.all(selectedFiles.map(async (fileId) => {
            const file = updatedFiles.find(f => f.id === fileId);
            if (!file) {
                finishedCount++;
                return;
            }

            try {
                const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: file.content,
                    timestamp: Date.now(),
                };

                // Each file gets its own API call, but they run simultaneously
                const response = await generateCompletion(settings, [userMessage], cleanPrompts[cleanMode]);

                if (response.content && !response.error) {
                    results[fileId] = { content: response.content };
                } else {
                    results[fileId] = { error: true };
                }
            } catch (e) {
                console.error(`Error cleaning file ${file.name}:`, e);
                results[fileId] = { error: true };
            } finally {
                finishedCount++;
                setProcessProgress(prev => ({ 
                    ...prev, 
                    current: finishedCount,
                    fileName: file.name
                }));
            }
        }));

        // Apply all results to the file list at once
        const finalFiles = updatedFiles.map(f => {
            const res = results[f.id];
            if (res) {
                if (res.error) {
                    return { ...f, cleanMode: 'rejected' as const };
                }
                if (res.content) {
                    return {
                        ...f,
                        originalContent: f.originalContent || f.content,
                        content: res.content,
                        cleanMode: cleanMode,
                        tokens: Math.floor(res.content.length / 4),
                    };
                }
            }
            return f;
        });

        onFilesChange(finalFiles);
        setSelectedFiles([]);
        setProcessing(false);
        setProcessProgress({ current: 0, total: 0, fileName: '' });
    };

    return (
        <div className="page-content">
            {/* Header Card */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-lg)' }}>
                        {/* Left side - Mode selector */}
                        <div>
                            <h3 style={{ margin: 0, marginBottom: 'var(--space-md)' }}>🧹 Lore Cleaner</h3>
                            <div className="cleaner-modes">
                                {(Object.keys(modeDescriptions) as CleanMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        className={`mode-btn ${cleanMode === mode ? 'active' : ''}`}
                                        onClick={() => setCleanMode(mode)}
                                        title={modeDescriptions[mode].description}
                                    >
                                        {modeDescriptions[mode].icon} {modeDescriptions[mode].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right side - Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => {
                                    // Remove duplicates based on content
                                    const uniqueMap = new Map();
                                    files.forEach(f => uniqueMap.set(f.content, f));
                                    if (uniqueMap.size < files.length) {
                                        onFilesChange(Array.from(uniqueMap.values()));
                                    }
                                }} title="Remove duplicate files based on content">
                                    🧹 Dedup
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => {
                                    if (selectedFiles.length < 2) return;
                                    const selectedContent = selectedFiles
                                        .map(id => files.find(f => f.id === id))
                                        .filter(f => f)
                                        .map(f => `### ${f?.name}\n${f?.content}`)
                                        .join('\n\n');

                                    const newFile: KBFile = {
                                        id: `merged-${Date.now()}`,
                                        name: `Merged_${selectedFiles.length}_Files.txt`,
                                        content: selectedContent,
                                        enabled: true,
                                        tokens: Math.floor(selectedContent.length / 4)
                                    };
                                    onFilesChange([...files, newFile]);
                                    setSelectedFiles([]);
                                }} disabled={selectedFiles.length < 2} title="Merge selected files into one">
                                    🔗 Merge
                                </button>
                                <div style={{ width: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />
                                <button className="btn btn-ghost btn-sm" onClick={selectUnprocessed}>New/Rejected</button>
                                <button className="btn btn-ghost btn-sm" onClick={selectAll}>All</button>
                                <button className="btn btn-ghost btn-sm" onClick={selectNone}>None</button>
                                <div style={{ width: '10px' }} />
                                <button className="btn btn-danger btn-sm" disabled={selectedFiles.length === 0} onClick={() => {
                                    onFilesChange(files.filter(f => !selectedFiles.includes(f.id)));
                                    setSelectedFiles([]);
                                }}>
                                    🗑️ Delete
                                </button>
                            </div>
                            <button
                                className="btn btn-primary btn-lg"
                                disabled={selectedFiles.length === 0 || processing}
                                style={{ minWidth: '200px' }}
                                onClick={handleCleanSelected}
                            >
                                {processing
                                    ? `⏳ Processing ${processProgress.current}/${processProgress.total}...`
                                    : `✨ Clean Selected (${selectedFiles.length})`
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Sort */}
            <div className="cleaner-toolbar" style={{ justifyContent: 'space-between' }}>
                <input
                    type="text"
                    className="input"
                    placeholder="Search your library..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort by:</span>
                    <select
                        className="input"
                        style={{ width: 'auto', padding: 'var(--space-sm)' }}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="name">Name (A-Z)</option>
                        <option value="size">Size (Large-Small)</option>
                        <option value="tokens">Tokens (High-Low)</option>
                    </select>
                </div>
            </div>

            {/* File Grid */}
            <div className="file-grid">
                {filteredFiles.map((file) => (
                    <div
                        key={file.id}
                        className={`file-card ${selectedFiles.includes(file.id) ? 'selected' : ''}`}
                        onClick={() => toggleFile(file.id)}
                    >
                        <div className="file-checkbox">
                            {selectedFiles.includes(file.id) && '✓'}
                        </div>
                        <div className="file-card-header">
                            <span className="file-icon">
                                {file.name.endsWith('.json') ? '📦' : file.name.endsWith('.md') ? '📝' : '📄'}
                            </span>
                            <span className="file-name">{file.name}</span>
                        </div>
                        <div className="file-meta">
                            <span>{Math.round(file.content.length / 1024)} KB</span>
                            {file.tokens && <span>• {file.tokens} tokens</span>}
                            <span>• {file.enabled ? 'Active' : 'Muted'}</span>
                        </div>
                        <div style={{ marginTop: 'var(--space-sm)' }}>
                            {getStatusBadge(file.cleanMode)}
                        </div>
                    </div>
                ))}

                {filteredFiles.length === 0 && (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                        <div className="empty-state-icon">🔍</div>
                        <div className="empty-state-title">No files match your search</div>
                    </div>
                )}
            </div>

            {/* Upload Area */}
            <div
                className="card"
                style={{
                    marginTop: 'var(--space-xl)',
                    textAlign: 'center',
                    padding: 'var(--space-2xl)',
                    border: '2px dashed var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                }}
                onClick={() => document.getElementById('lore-cleaner-upload')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    // In a real app, we would process e.dataTransfer.files
                    // For now, we'll just log or mock it
                    console.log('Dropped files:', e.dataTransfer.files);
                    const newFiles: KBFile[] = Array.from(e.dataTransfer.files).map((f, i) => ({
                        id: `new-${Date.now()}-${i}`,
                        name: f.name,
                        content: 'Loaded content...',
                        enabled: true,
                        tokens: Math.floor(f.size / 4) // Rough estimate
                    }));
                    onFilesChange([...files, ...newFiles]);
                }}
            >
                <input
                    type="file"
                    id="lore-cleaner-upload"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        if (e.target.files) {
                            const newFiles: KBFile[] = Array.from(e.target.files).map((f, i) => ({
                                id: `new-${Date.now()}-${i}`,
                                name: f.name,
                                content: 'Loaded content...',
                                enabled: true,
                                tokens: Math.floor(f.size / 4)
                            }));
                            onFilesChange([...files, ...newFiles]);
                        }
                    }}
                />
                <div className="empty-state-icon" style={{ marginBottom: 'var(--space-md)' }}>📁</div>
                <div className="empty-state-title">Drop files here or click to upload</div>
                <div className="empty-state-description" style={{ marginBottom: 0 }}>
                    Supports .txt, .md, .json files
                </div>
            </div>

            {/* Activity Log placeholder */}
            <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
                <div className="card-header">
                    <div className="card-title">🕐 Recent Activity</div>
                    <button className="btn btn-ghost btn-sm">Clear</button>
                </div>
                <div className="card-body">
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-lg)' }}>
                        No recent activity. Files you clean will appear here.
                    </div>
                </div>
            </div>
        </div>
    );
};
