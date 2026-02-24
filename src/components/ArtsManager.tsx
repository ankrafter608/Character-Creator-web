
import { useState, useEffect } from 'react';
import type { CharacterData, ArtPrompt } from '../types';
import { LibraryService } from '../services/library';

interface ArtsManagerProps {
    character: CharacterData;
    prompts: ArtPrompt[];
    onUpdatePrompts: (prompts: ArtPrompt[]) => void;
    onSelectCharacter: (char: CharacterData) => void;
    onGenerate: (aspectRatio: string) => void;
    isGenerating: boolean;
}

export const ArtsManager = ({ character, prompts, onUpdatePrompts, onSelectCharacter, onGenerate, isGenerating }: ArtsManagerProps) => {
    const [aspectRatio, setAspectRatio] = useState('Portrait (512x768)');
    const [savedCharacters, setSavedCharacters] = useState<any[]>([]);

    useEffect(() => {
        setSavedCharacters(LibraryService.getCharacters());
    }, []);

    const handleAddPrompt = () => {
        const newPrompt: ArtPrompt = {
            id: Date.now().toString(),
            label: 'New Prompt',
            prompt: '',
            model: 'anime'
        };
        onUpdatePrompts([...prompts, newPrompt]);
    };

    const handleDeletePrompt = (id: string) => {
        onUpdatePrompts(prompts.filter(p => p.id !== id));
    };

    const handleUpdatePrompt = (id: string, field: keyof ArtPrompt, value: string) => {
        onUpdatePrompts(prompts.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="arts-manager" style={{ padding: 'var(--space-md)', height: '100%', overflowY: 'auto' }}>
            <div className="arts-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>🎨 ARTS Tab</h2>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Generate ComfyUI prompts for <strong>{character.name || 'Current Character'}</strong>
                        </p>
                    </div>
                </div>

                <div className="controls-row" style={{ display: 'flex', gap: 'var(--space-md)', background: 'var(--bg-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Target Character</label>
                        <select
                            value={character.name} // Using name as ID for simplicity as established in LibraryService
                            onChange={(e) => {
                                const selected = savedCharacters.find(c => c.name === e.target.value);
                                if (selected) onSelectCharacter(selected.data);
                            }}
                            className="input"
                            style={{ width: '100%' }}
                        >
                            <option value={character.name}>Current: {character.name}</option>
                            {savedCharacters.filter(c => c.name !== character.name).map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Resolution / Ratio</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="input"
                            style={{ width: '100%' }}
                        >
                            <option value="Portrait (512x768)">Portrait (512x768)</option>
                            <option value="Portrait Large (832x1216)">Portrait Large (832x1216)</option>
                            <option value="Landscape (768x512)">Landscape (768x512)</option>
                            <option value="Landscape Large (1216x832)">Landscape Large (1216x832)</option>
                            <option value="Square (512x512)">Square (512x512)</option>
                            <option value="Square Large (1024x1024)">Square Large (1024x1024)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => onGenerate(aspectRatio)}
                            disabled={isGenerating}
                        >
                            {isGenerating ? '✨ Generating...' : '✨ Auto-Generate'}
                        </button>
                        <button className="btn btn-secondary" onClick={handleAddPrompt}>
                            + Add
                        </button>
                        <button 
                            className="btn btn-ghost text-danger" 
                            onClick={() => {
                                if (confirm('Clear all generated prompts?')) onUpdatePrompts([]);
                            }}
                        >
                            🗑️ Clear All
                        </button>
                    </div>
                </div>
            </div>

            <div className="prompts-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {prompts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🖼️</div>
                        <h3>No Prompts Generated</h3>
                        <p>Select a character and resolution, then click Auto-Generate.</p>
                    </div>
                ) : (
                    prompts.map((prompt) => (
                        <div key={prompt.id} className="card" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1 }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                                    <input
                                        type="text"
                                        value={prompt.label}
                                        onChange={(e) => handleUpdatePrompt(prompt.id, 'label', e.target.value)}
                                        placeholder="Label (e.g. Portrait)"
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            color: 'var(--text-primary)',
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            width: '200px'
                                        }}
                                    />
                                    <select
                                        value={prompt.model || 'anime'}
                                        onChange={(e) => handleUpdatePrompt(prompt.id, 'model', e.target.value)}
                                        style={{ marginLeft: 'auto', marginRight: 'var(--space-sm)', padding: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-secondary)' }}
                                    >
                                        <option value="anime">Anime</option>
                                        <option value="realistic">Realistic</option>
                                        <option value="fantasy">Fantasy</option>
                                    </select>
                                </div>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => handleDeletePrompt(prompt.id)}
                                    title="Delete Prompt"
                                    style={{ color: 'var(--error)' }}
                                >
                                    🗑️
                                </button>
                            </div>

                            {/* Prompt only */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>PROMPT</label>
                                    <button
                                        className="btn btn-xs btn-ghost"
                                        onClick={() => copyToClipboard(prompt.prompt)}
                                        title="Copy to clipboard"
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <textarea
                                    value={prompt.prompt}
                                    onChange={(e) => handleUpdatePrompt(prompt.id, 'prompt', e.target.value)}
                                    placeholder="1girl, solo, ..."
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-base)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: 'var(--space-sm)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.9rem',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
