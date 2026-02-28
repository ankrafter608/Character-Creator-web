
import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';
import type { KBFile } from '../types';
import { countTokens, countTokensAsync, type TokenizerType } from '../utils/tokenCounter';

interface FileManagerProps {
    files: KBFile[];
    onFilesChange: (files: KBFile[]) => void;
    tokenizer?: string;
}

export const FileManager: FC<FileManagerProps> = ({ files, onFilesChange, tokenizer }) => {
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get currently selected file object
    const selectedFile = files.find(f => f.id === selectedFileId);

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );


    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: KBFile[] = Array.from(e.target.files).map((f, i) => ({
                id: `file-${Date.now()}-${i}`,
                name: f.name,
                content: '', // Will be filled by FileReader
                enabled: true,
                tokens: 0
            }));

            // Read contents
            let processedCount = 0;
            // Capture tokenizer value at start of upload to avoid closure staleness
            const currentTokenizer = tokenizer || 'openai';
            
            newFiles.forEach((fileObj, index) => {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    fileObj.content = evt.target?.result as string;
                    // Start with an immediate heuristic count
                    fileObj.tokens = countTokens(fileObj.content, currentTokenizer as TokenizerType);
                    
                    // Replace with an accurate async count
                    const exactTokens = await countTokensAsync(fileObj.content, currentTokenizer as TokenizerType);
                    fileObj.tokens = exactTokens;
                    
                    processedCount++;
                    if (processedCount === newFiles.length) {
                        onFilesChange([...files, ...newFiles]);
                    }
                };
                reader.readAsText(e.target.files![index]);
            });
            
            // Reset input value to allow re-uploading same file if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };


    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this file?')) {
            onFilesChange(files.filter(f => f.id !== id));
            if (selectedFileId === id) setSelectedFileId(null);
        }
    };

    const handleToggleEnabled = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onFilesChange(files.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
    };

    // Force token recount on mount for files that have 0 tokens (migration/fix)
    useEffect(() => {
        const filesNeedingUpdate = files.filter(f => f.tokens === 0 && f.content.length > 0);
        if (filesNeedingUpdate.length > 0) {
            console.log('[FileManager] Recounting tokens for loaded files...');
            const recountTokens = async () => {
                const updatedFiles = await Promise.all(
                    files.map(async (f) => {
                        if ((!f.tokens || f.tokens === 0) && f.content && f.content.length > 0) {
                            const newTokens = await countTokensAsync(f.content, (tokenizer as TokenizerType) || 'openai');
                            return { ...f, tokens: newTokens };
                        }
                        return f;
                    })
                );
                onFilesChange(updatedFiles);
            };
            recountTokens();
        }
    }, []); 

    const handleContentChange = (newContent: string) => {
        if (selectedFileId) {
            const currentTokenizer = (tokenizer as TokenizerType) || 'openai';
            // First apply instant heuristic to keep UI responsive
            const heuristicTokens = countTokens(newContent, currentTokenizer);
            onFilesChange(files.map(f => f.id === selectedFileId ? {
                ...f,
                content: newContent,
                tokens: heuristicTokens
            } : f));

            // Then fetch precise token count asynchronously
            countTokensAsync(newContent, currentTokenizer).then((exactTokens) => {
                onFilesChange(files.map(f => f.id === selectedFileId ? {
                    ...f,
                    content: newContent,
                    tokens: exactTokens
                } : f));
            }).catch(e => console.error("Error fetching tokens:", e));
        }
    };

    const handleClearAll = () => {
        if (confirm('Are you sure you want to delete ALL files? This cannot be undone.')) {
            onFilesChange([]);
            setSelectedFileId(null);
        }
    };

    const handleEnableAll = () => {
        onFilesChange(files.map(f => ({ ...f, enabled: true })));
    };

    const handleDisableAll = () => {
        onFilesChange(files.map(f => ({ ...f, enabled: false })));
    };

    return (
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', padding: 0 }}>

                {/* Left Sidebar: File List */}
                <div style={{
                    width: '300px',
                    borderRight: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg-surface)'
                }}>
                    <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                            <h3 style={{ margin: 0 }}>📂 Files</h3>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                + Upload
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                multiple
                                onChange={handleFileUpload}
                            />
                        </div>
                        <input
                            type="text"
                            className="input"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ marginBottom: 'var(--space-sm)' }}
                        />

                        {/* Bulk Actions */}
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'space-between' }}>
                            <button className="btn btn-ghost btn-xs" onClick={handleEnableAll} title="Enable All">
                                👁️ All
                            </button>
                            <button className="btn btn-ghost btn-xs" onClick={handleDisableAll} title="Disable All">
                                🚫 All
                            </button>
                            <button className="btn btn-ghost btn-xs text-danger" onClick={handleClearAll} title="Delete All">
                                🗑️ Clear
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-xs)' }}>
                        {filteredFiles.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                                <div className="empty-state-description">No files found</div>
                            </div>
                        ) : (
                            filteredFiles.map(file => (
                                <div
                                    key={file.id}
                                    className={`
                                        p-2 rounded cursor-pointer flex items-center justify-between
                                        ${selectedFileId === file.id ? 'bg-primary/20' : 'hover:bg-hover'}
                                    `}
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: selectedFileId === file.id ? 'var(--bg-elevated)' : 'transparent',
                                        borderLeft: selectedFileId === file.id ? '3px solid var(--primary)' : '3px solid transparent',
                                        marginBottom: '2px'
                                    }}
                                    onClick={() => setSelectedFileId(file.id)}
                                >
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{file.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {Math.round(file.content.length / 1024)} KB •
                                            <span style={{ color: file.enabled ? 'var(--success)' : 'var(--error)', marginLeft: '4px' }}>
                                                {file.enabled ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        <button
                                            className="btn btn-icon btn-sm"
                                            onClick={(e) => handleToggleEnabled(file.id, e)}
                                            title={file.enabled ? "Disable for AI" : "Enable for AI"}
                                            style={{ color: file.enabled ? 'var(--success)' : 'var(--error)' }}
                                        >
                                            {file.enabled ? '👁️' : '🚫'}
                                        </button>
                                        <button
                                            className="btn btn-icon btn-sm"
                                            onClick={(e) => handleDelete(file.id, e)}
                                            title="Delete file"
                                            style={{ color: 'var(--error)' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Area: Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
                    {selectedFile ? (
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
                                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedFile.name}</h2>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {selectedFile.tokens} tokens
                                    </span>
                                </div>
                                <div className={`badge ${selectedFile.enabled ? 'badge-success' : 'badge-error'}`} style={{
                                    backgroundColor: selectedFile.enabled ? 'var(--success-bg)' : 'var(--error-bg)',
                                    color: selectedFile.enabled ? 'var(--success)' : 'var(--error)',
                                    border: `1px solid ${selectedFile.enabled ? 'var(--success)' : 'var(--error)'}`
                                }}>
                                    {selectedFile.enabled ? 'Included in Context' : 'Excluded from Context'}
                                </div>
                            </div>
                            <textarea
                                className="textarea"
                                value={selectedFile.content}
                                onChange={(e) => handleContentChange(e.target.value)}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    borderRadius: 0,
                                    resize: 'none',
                                    padding: 'var(--space-md)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.5',
                                    background: 'var(--bg-base)',
                                    color: 'var(--text-primary)'
                                }}
                                placeholder="Edit file content here..."
                            />
                        </>
                    ) : (
                        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <div className="empty-state-icon" style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📝</div>
                            <div className="empty-state-title">Select a file to edit</div>
                            <div className="empty-state-description">
                                Or upload new files using the sidebar
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
