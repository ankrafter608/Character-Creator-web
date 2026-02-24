import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { APISettings, Preset, PresetProfile, ConnectionProfile } from '../types';
import { ConnectionSettings } from './ConnectionSettings';
import { PresetEditor } from './PresetEditor';
import { PROMPT_CONFIGS, getDefaultPrompts } from '../utils/systemPrompts';
import type { CustomPrompts } from '../utils/systemPrompts';

// Mock default preset based on the JSON we saw
const defaultPreset: Preset = {
    temperature: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    top_p: 0.95,
    top_k: 60,
    top_a: 1,
    min_p: 0,
    repetition_penalty: 1,
    max_context_unlocked: true,
    openai_max_context: 8192,
    openai_max_tokens: 2048,
    impersonation_prompt: "",
    new_chat_prompt: "[Start a new Chat]",
    new_group_chat_prompt: "[Start a new group chat]",
    new_example_chat_prompt: "[Example Chat]",
    continue_nudge_prompt: "[Continue]",
    wi_format: "World Info: {0}",
    scenario_format: "Scenario: {{scenario}}",
    personality_format: "{{char}}'s personality: {{personality}}",
    group_nudge_prompt: "",
    prompts: [
        {
            name: "Main System Prompt",
            identifier: "main",
            role: "system",
            content: "You are {{char}}. Write a response to {{user}}.",
            system_prompt: true,
            injection_position: 0,
            injection_depth: 0,
            injection_order: 0,
            enabled: true
        },
        {
            name: "NSFW/Jailbreak",
            identifier: "nsfw",
            role: "system",
            content: "NSFW content is allowed.",
            system_prompt: true,
            injection_position: 0,
            injection_depth: 0,
            injection_order: 1,
            enabled: true
        }
    ]
};

interface SettingsProps {
    settings: APISettings;
    onChange: (settings: APISettings) => void;
    // Profile props
    presetProfiles: PresetProfile[];
    activePresetId: string | null;
    onPresetProfilesChange: (profiles: PresetProfile[]) => void;
    onActivePresetChange: (id: string | null) => void;
    connectionProfiles: ConnectionProfile[];
    activeConnectionId: string | null;
    onConnectionProfilesChange: (profiles: ConnectionProfile[]) => void;
    onActiveConnectionChange: (id: string | null) => void;
    // System prompts
    customPrompts: CustomPrompts;
    onCustomPromptsChange: (prompts: CustomPrompts) => void;
}

export const Settings: FC<SettingsProps> = ({
    settings,
    onChange,
    presetProfiles,
    activePresetId,
    onPresetProfilesChange,
    onActivePresetChange,
    connectionProfiles,
    activeConnectionId,
    onConnectionProfilesChange,
    onActiveConnectionChange,
    customPrompts,
    onCustomPromptsChange
}) => {
    // Initialize active_preset if missing
    useEffect(() => {
        if (!settings.active_preset) {
            onChange({ ...settings, active_preset: defaultPreset });
        }
    }, [settings.active_preset]);

    const [activeTab, setActiveTab] = useState<'connection' | 'presets' | 'prompts' | 'data'>('connection');
    const [connectionProfileName, setConnectionProfileName] = useState('');
    const [presetProfileName, setPresetProfileName] = useState('');

    const [localPrompts, setLocalPrompts] = useState<CustomPrompts>(customPrompts);

    useEffect(() => {
        setLocalPrompts(customPrompts);
    }, [customPrompts]);

    const hasUnsavedPrompts = PROMPT_CONFIGS.some(config => localPrompts[config.id] !== customPrompts[config.id]);

    const handlePresetChange = (newPreset: Preset) => {
        onChange({ 
            ...settings, 
            active_preset: newPreset,
            tokenizer: newPreset.tokenizer || settings.tokenizer
        });
    };

    return (
        <div className="page-content" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div className="page-header" style={{ flexShrink: 0, padding: 'var(--space-xl)' }}>
                <h1 className="page-title">Settings</h1>
                <p className="page-description">Manage application configuration and data.</p>

                <div className="tabs" style={{ marginTop: 'var(--space-md)' }}>
                    <button
                        className={`tab ${activeTab === 'connection' ? 'active' : ''}`}
                        onClick={() => setActiveTab('connection')}
                    >
                        🔌 Connection
                    </button>
                    <button
                        className={`tab ${activeTab === 'presets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('presets')}
                    >
                        🎛️ Presets & Instruct
                    </button>
                    <button
                        className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('prompts')}
                    >
                        📝 System Prompts
                    </button>
                    <button
                        className={`tab ${activeTab === 'data' ? 'active' : ''}`}
                        onClick={() => setActiveTab('data')}
                    >
                        💾 Data Management
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-xl) var(--space-xl)' }}>
                {activeTab === 'connection' && (
                    <div>
                        {/* Connection Profiles Selector */}
                        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                            <div className="card-header">
                                <div className="card-title">
                                    <span>📁 Connection Profiles</span>
                                </div>
                            </div>
                            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <select
                                        className="input"
                                        style={{ flex: 1, minWidth: '200px' }}
                                        value={activeConnectionId || ''}
                                        onChange={(e) => {
                                            const id = e.target.value || null;
                                            onActiveConnectionChange(id);
                                            const profile = connectionProfiles.find(p => p.id === id);
                                            if (profile) {
                                                onChange({
                                                    ...settings,
                                                    serverUrl: profile.serverUrl,
                                                    apiKey: profile.apiKey,
                                                    model: profile.model,
                                                    provider: profile.provider || 'openai',
                                                    tokenizer: profile.tokenizer || 'openai'
                                                });
                                                setConnectionProfileName(profile.name);
                                            } else {
                                                setConnectionProfileName('');
                                            }
                                        }}
                                    >
                                        <option value="">-- New Connection --</option>
                                        {connectionProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Profile name..."
                                        style={{ flex: 1, minWidth: '200px' }}
                                        value={connectionProfileName}
                                        onChange={(e) => setConnectionProfileName(e.target.value)}
                                    />
                                    {activeConnectionId ? (
                                        <>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                disabled={!connectionProfileName.trim()}
                                                onClick={() => {
                                                    onConnectionProfilesChange(connectionProfiles.map(p =>
                                                        p.id === activeConnectionId
                                                            ? {
                                                                ...p,
                                                                name: connectionProfileName.trim(),
                                                                serverUrl: settings.serverUrl,
                                                                apiKey: settings.apiKey,
                                                                model: settings.model,
                                                                provider: settings.provider || 'openai',
                                                                tokenizer: settings.tokenizer
                                                            }
                                                            : p
                                                    ));
                                                }}
                                            >
                                                💾 Update Profile
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => {
                                                    onConnectionProfilesChange(connectionProfiles.filter(p => p.id !== activeConnectionId));
                                                    onActiveConnectionChange(null);
                                                    setConnectionProfileName('');
                                                }}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={!connectionProfileName.trim()}
                                            onClick={() => {
                                                const newProfile: ConnectionProfile = {
                                                    id: Date.now().toString(),
                                                    name: connectionProfileName.trim(),
                                                    serverUrl: settings.serverUrl,
                                                    apiKey: settings.apiKey,
                                                    model: settings.model,
                                                    provider: settings.provider || 'openai',
                                                    tokenizer: settings.tokenizer
                                                };
                                                onConnectionProfilesChange([...connectionProfiles, newProfile]);
                                                onActiveConnectionChange(newProfile.id);
                                            }}
                                        >
                                            💾 Save as New
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ConnectionSettings settings={settings} onChange={onChange} />
                    </div>
                )}

                {activeTab === 'presets' && settings.active_preset && (
                    <div>
                        {/* Preset Profiles Selector */}
                        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                            <div className="card-header">
                                <div className="card-title">
                                    <span>📁 Preset Profiles</span>
                                </div>
                            </div>
                            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <select
                                        className="input"
                                        style={{ flex: 1, minWidth: '200px' }}
                                        value={activePresetId || ''}
                                        onChange={(e) => {
                                            const id = e.target.value || null;
                                            onActivePresetChange(id);
                                            const profile = presetProfiles.find(p => p.id === id);
                                            if (profile) {
                                                onChange({ 
                                                    ...settings, 
                                                    active_preset: profile.preset,
                                                    tokenizer: profile.preset.tokenizer || settings.tokenizer
                                                });
                                                setPresetProfileName(profile.name);
                                            } else {
                                                setPresetProfileName('');
                                            }
                                        }}
                                    >
                                        <option value="">-- New Preset --</option>
                                        {presetProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Profile name..."
                                        style={{ flex: 1, minWidth: '200px' }}
                                        value={presetProfileName}
                                        onChange={(e) => setPresetProfileName(e.target.value)}
                                    />
                                    {activePresetId ? (
                                        <>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                disabled={!presetProfileName.trim()}
                                                onClick={() => {
                                                    onPresetProfilesChange(presetProfiles.map(p =>
                                                        p.id === activePresetId
                                                            ? { 
                                                                ...p, 
                                                                name: presetProfileName.trim(), 
                                                                preset: {
                                                                    ...settings.active_preset!,
                                                                    tokenizer: settings.tokenizer as any
                                                                }
                                                            }
                                                            : p
                                                    ));
                                                }}
                                            >
                                                💾 Update Profile
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => {
                                                    onPresetProfilesChange(presetProfiles.filter(p => p.id !== activePresetId));
                                                    onActivePresetChange(null);
                                                    setPresetProfileName('');
                                                }}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={!presetProfileName.trim()}
                                            onClick={() => {
                                                const newProfile: PresetProfile = {
                                                    id: Date.now().toString(),
                                                    name: presetProfileName.trim(),
                                                    preset: {
                                                        ...settings.active_preset!,
                                                        tokenizer: settings.tokenizer as any
                                                    }
                                                };
                                                onPresetProfilesChange([...presetProfiles, newProfile]);
                                                onActivePresetChange(newProfile.id);
                                            }}
                                        >
                                            💾 Save as New
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">
                                    <span>Current Preset</span>
                                    {activePresetId && <span className="badge badge-primary">{presetProfiles.find(p => p.id === activePresetId)?.name || 'Custom'}</span>}
                                </div>
                                <div className="field-actions">
                                    <input
                                        type="file"
                                        id="preset-import"
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
                                                    // Basic validation: check if it has 'prompts' array
                                                    if (Array.isArray(parsed.prompts)) {
                                                        onChange({ ...settings, active_preset: parsed });
                                                    } else {
                                                        // Allow importing just the generation params or prompts separately?
                                                        // For now assume full preset
                                                        alert("Invalid preset file format: missing 'prompts' array");
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    alert("Failed to parse JSON file");
                                                }
                                            };
                                            reader.readAsText(file);
                                            // Reset input
                                            e.target.value = '';
                                        }}
                                    />
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => document.getElementById('preset-import')?.click()}
                                    >
                                        Import JSON
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => {
                                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings.active_preset, null, 2));
                                            const downloadAnchorNode = document.createElement('a');
                                            downloadAnchorNode.setAttribute("href", dataStr);
                                            downloadAnchorNode.setAttribute("download", "preset.json");
                                            document.body.appendChild(downloadAnchorNode);
                                            downloadAnchorNode.click();
                                            downloadAnchorNode.remove();
                                        }}
                                    >
                                        Export JSON
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <PresetEditor preset={settings.active_preset} onChange={handlePresetChange} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'prompts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">
                                    <span>System Prompt Templates</span>
                                </div>
                                <div className="field-actions" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={!hasUnsavedPrompts}
                                        onClick={() => {
                                            onCustomPromptsChange(localPrompts);
                                        }}
                                    >
                                        💾 Save Changes
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => {
                                            if (confirm('Reset all prompts to defaults? Your custom edits will be lost.')) {
                                                const defaults = getDefaultPrompts();
                                                setLocalPrompts(defaults);
                                                onCustomPromptsChange(defaults);
                                            }
                                        }}
                                    >
                                        Reset All to Defaults
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>
                                    These are the internal system prompts sent to the AI for each page.
                                    Your preset content (jailbreaks, style rules) is always prepended automatically — do NOT duplicate it here.
                                    Use {'{{variableName}}'} placeholders for dynamic values.
                                </p>
                            </div>
                        </div>

                        {PROMPT_CONFIGS.map(config => {
                            const isModified = localPrompts[config.id] !== config.defaultTemplate;
                            const isUnsaved = localPrompts[config.id] !== customPrompts[config.id];
                            return (
                                <div className="card" key={config.id}>
                                    <div className="card-header">
                                        <div className="card-title">
                                            <span>{config.name}</span>
                                            {isUnsaved && <span className="badge badge-warning" style={{ marginLeft: 'var(--space-sm)', backgroundColor: '#e6a23c', color: '#fff' }}>unsaved</span>}
                                            {isModified && !isUnsaved && <span className="badge badge-primary" style={{ marginLeft: 'var(--space-sm)' }}>modified</span>}
                                        </div>
                                        <div className="field-actions">
                                            {isModified && (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        const newPrompts = {
                                                            ...localPrompts,
                                                            [config.id]: config.defaultTemplate,
                                                        };
                                                        setLocalPrompts(newPrompts);
                                                        onCustomPromptsChange(newPrompts);
                                                    }}
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        <p className="text-muted" style={{ margin: 0, fontSize: '0.85em' }}>
                                            {config.description}
                                        </p>
                                        {config.variables.length > 0 && (
                                            <div className="text-muted" style={{ fontSize: '0.8em', fontFamily: 'var(--font-mono)' }}>
                                                Variables: {config.variables.map(v => (
                                                    <span key={v.name} title={v.description} style={{ marginRight: '8px', color: 'var(--accent)', cursor: 'help' }}>
                                                        {`{{${v.name}}}`}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <textarea
                                            className="input"
                                            style={{
                                                width: '100%',
                                                minHeight: '200px',
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.85em',
                                                resize: 'vertical',
                                                whiteSpace: 'pre-wrap',
                                            }}
                                            value={localPrompts[config.id] || ''}
                                            onChange={(e) => {
                                                setLocalPrompts({
                                                    ...localPrompts,
                                                    [config.id]: e.target.value,
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="field-grid">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Backup & Restore</h3>
                            </div>
                            <div className="card-body">
                                <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>
                                    Export all characters, settings, and chat history to a single file.
                                </p>
                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <button className="btn btn-primary">Download Backup</button>
                                    <button className="btn btn-secondary">Restore from Backup</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title text-danger">Danger Zone</h3>
                            </div>
                            <div className="card-body">
                                <button className="btn btn-danger">Reset All Data</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
