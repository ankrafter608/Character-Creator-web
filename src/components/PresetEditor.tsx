import type { FC } from 'react';
import { useState } from 'react';
import type { Preset, PromptItem } from '../types';

interface PresetEditorProps {
    preset: Preset;
    onChange: (preset: Preset) => void;
}

export const PresetEditor: FC<PresetEditorProps> = ({ preset, onChange }) => {
    const [activeTab, setActiveTab] = useState<'generation' | 'formatting' | 'prompts'>('generation');
    const [selectedPromptIndex, setSelectedPromptIndex] = useState<number | null>(null);

    const updateField = (field: keyof Preset, value: any) => {
        onChange({ ...preset, [field]: value });
    };

    const updatePrompt = (index: number, field: keyof PromptItem, value: any) => {
        const newPrompts = [...preset.prompts];
        newPrompts[index] = { ...newPrompts[index], [field]: value };
        onChange({ ...preset, prompts: newPrompts });
    };

    const togglePrompt = (index: number) => {
        const newPrompts = [...preset.prompts];
        newPrompts[index].enabled = !newPrompts[index].enabled;
        onChange({ ...preset, prompts: newPrompts });
    };

    const deletePrompt = (index: number) => {
        const newPrompts = preset.prompts.filter((_, i) => i !== index);
        onChange({ ...preset, prompts: newPrompts });
        if (selectedPromptIndex === index) {
            setSelectedPromptIndex(null);
        } else if (selectedPromptIndex !== null && selectedPromptIndex > index) {
            setSelectedPromptIndex(selectedPromptIndex - 1);
        }
    };

    const addPrompt = () => {
        const newPrompt: PromptItem = {
            name: "New Prompt",
            identifier: "new_prompt_" + Date.now(),
            role: "system",
            content: "",
            system_prompt: true,
            injection_position: 0,
            injection_depth: 0,
            injection_order: 0,
            enabled: true
        };
        onChange({ ...preset, prompts: [...preset.prompts, newPrompt] });
        setSelectedPromptIndex(preset.prompts.length);
    };

    return (
        <div className="preset-editor">
            <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                <button
                    className={`tab ${activeTab === 'generation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generation')}
                >
                    Generation Params
                </button>
                <button
                    className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    Prompts / Instruct
                </button>
            </div>

            {activeTab === 'generation' && (
                <div className="animate-fadeIn">
                    <div className="field-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        <div className="input-group">
                            <label className="input-label">Temperature: {preset.temperature}</label>
                            <input
                                type="range" min="0" max="2" step="0.01"
                                value={preset.temperature}
                                onChange={(e) => updateField('temperature', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Top P: {preset.top_p}</label>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={preset.top_p}
                                onChange={(e) => updateField('top_p', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Presence Penalty: {preset.presence_penalty}</label>
                            <input
                                type="range" min="-2" max="2" step="0.01"
                                value={preset.presence_penalty}
                                onChange={(e) => updateField('presence_penalty', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Frequency Penalty: {preset.frequency_penalty}</label>
                            <input
                                type="range" min="-2" max="2" step="0.01"
                                value={preset.frequency_penalty}
                                onChange={(e) => updateField('frequency_penalty', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Max Response Tokens</label>
                            <input
                                type="number" className="input"
                                value={preset.openai_max_tokens}
                                onChange={(e) => updateField('openai_max_tokens', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Context Limit</label>
                            <input
                                type="number" className="input"
                                value={preset.openai_max_context}
                                onChange={(e) => updateField('openai_max_context', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Thinking Mode (Gemini)</label>
                            <select
                                className="input"
                                value={preset.thinking_mode || 'off'}
                                onChange={(e) => updateField('thinking_mode', e.target.value)}
                            >
                                <option value="off">Off</option>
                                <option value="auto">Auto</option>
                                <option value="max">Max</option>
                            </select>
                        </div>
                        {preset.thinking_mode === 'max' && (
                            <div className="input-group">
                                <label className="input-label">Thinking Budget (Tokens)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={preset.thinking_budget || 0}
                                    onChange={(e) => updateField('thinking_budget', parseInt(e.target.value))}
                                    placeholder="0 (Auto)"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'prompts' && (
                <div className="animate-fadeIn lorebook-layout">
                    {/* Prompt List */}
                    <div className="entries-sidebar">
                        <div className="entries-header">
                            <span className="entries-title">Prompt Sequence</span>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={addPrompt} title="Add Prompt">+</button>
                        </div>
                        <div className="entries-list">
                            {preset.prompts.map((prompt, index) => (
                                <div
                                    key={index}
                                    className={`entry-item ${selectedPromptIndex === index ? 'active' : ''}`}
                                    onClick={() => setSelectedPromptIndex(index)}
                                    style={{ opacity: prompt.enabled ? 1 : 0.5 }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="entry-item-title">{prompt.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                            <input
                                                type="checkbox"
                                                checked={prompt.enabled}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => togglePrompt(index)}
                                            />
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                style={{ color: 'var(--accent-danger)', padding: '2px' }}
                                                title="Delete Prompt"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deletePrompt(index);
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    <div className="entry-item-keys">Depth: {prompt.injection_depth} | Role: {prompt.role}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prompt Editor */}
                    <div className="entry-editor">
                        {selectedPromptIndex !== null ? (
                            <>
                                <div className="entry-editor-header">
                                    <input
                                        type="text"
                                        className="input"
                                        style={{ fontWeight: 'bold' }}
                                        value={preset.prompts[selectedPromptIndex].name}
                                        onChange={(e) => updatePrompt(selectedPromptIndex, 'name', e.target.value)}
                                    />
                                </div>
                                <div className="entry-editor-body">
                                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label className="input-label">Role</label>
                                            <select
                                                className="input"
                                                value={preset.prompts[selectedPromptIndex].role}
                                                onChange={(e) => updatePrompt(selectedPromptIndex, 'role', e.target.value)}
                                            >
                                                <option value="system">System</option>
                                                <option value="user">User</option>
                                                <option value="assistant">Assistant</option>
                                            </select>
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label className="input-label">Injection Depth</label>
                                            <input
                                                type="number"
                                                className="input"
                                                value={preset.prompts[selectedPromptIndex].injection_depth}
                                                onChange={(e) => updatePrompt(selectedPromptIndex, 'injection_depth', parseInt(e.target.value))}
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <label className="input-label">Content</label>
                                        <div className="field-body" style={{ flex: 1 }}>
                                            <textarea
                                                className="textarea"
                                                style={{ height: '100%' }}
                                                value={preset.prompts[selectedPromptIndex].content}
                                                onChange={(e) => updatePrompt(selectedPromptIndex, 'content', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-title">Select a prompt</div>
                                <div className="empty-state-description">Configure specific instruction blocks</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
