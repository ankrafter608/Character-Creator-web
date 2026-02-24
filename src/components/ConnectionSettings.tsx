import type { FC } from 'react';
import { useState } from 'react';
import type { APISettings } from '../types';
import { testConnection } from '../services/api';

interface ConnectionSettingsProps {
    settings: APISettings;
    onChange: (settings: APISettings) => void;
}

export const ConnectionSettings: FC<ConnectionSettingsProps> = ({ settings, onChange }) => {
    const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    const handleChange = (field: keyof APISettings, value: string) => {
        onChange({ ...settings, [field]: value });
    };

    const handleTestConnection = async () => {
        setTestStatus({ type: 'info', message: 'Testing connection...' });
        const result = await testConnection(settings);
        if (result.success) {
            setTestStatus({ type: 'success', message: result.message });
        } else {
            setTestStatus({ type: 'error', message: `Connection failed: ${result.message}` });
        }
    };

    return (
        <div className="section">
            <div className="section-header">
                <h3>🔌 API Connection</h3>
                <p className="text-muted">Configure your connection to Text Generation API.</p>
            </div>

            <div className="field-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="input-group">
                    <label className="input-label">API Provider</label>
                    <select
                        className="input"
                        value={settings.provider || 'openai'}
                        onChange={(e) => {
                            const newProvider = e.target.value as 'openai' | 'gemini';
                            let newUrl = settings.serverUrl;
                            if (newProvider === 'openai' && settings.serverUrl.includes('generativelanguage.googleapis.com')) {
                                newUrl = 'http://localhost:5000/v1';
                            } else if (newProvider === 'gemini' && settings.serverUrl.includes('localhost')) {
                                newUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
                            }
                            onChange({ ...settings, provider: newProvider, serverUrl: newUrl });
                        }}
                    >
                        <option value="openai">OpenAI Compatible (Oobabooga, vLLM, OpenAI)</option>
                        <option value="gemini">Google Gemini (Native)</option>
                    </select>
                </div>

                <div className="input-group">
                    <label className="input-label">
                        {settings.provider === 'gemini' ? 'API Endpoint' : 'API Base URL'}
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder={settings.provider === 'gemini' ? "https://generativelanguage.googleapis.com/v1beta/models" : "http://localhost:5000/v1"}
                        value={settings.serverUrl}
                        onChange={(e) => handleChange('serverUrl', e.target.value)}
                    />
                    <div className="input-hint">
                        {settings.provider === 'gemini'
                            ? "The endpoint for Gemini API (usually ends in /models)"
                            : "The base URL of your inference server (Oobabooga, KoboldCPP, etc.)"}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">API Key</label>
                    <input
                        type="password"
                        className="input"
                        placeholder={settings.provider === 'gemini' ? "AIzaSy..." : "sk-..."}
                        value={settings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                    />
                    <div className="input-hint">
                        {settings.provider === 'gemini'
                            ? "Your Google AI Studio API Key"
                            : "Optional for local servers. Required for OpenAI/DeepSeek."}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">Model Name</label>
                    <input
                        type="text"
                        className="input"
                        placeholder={settings.provider === 'gemini' ? "gemini-1.5-flash" : "gpt-3.5-turbo"}
                        value={settings.model}
                        onChange={(e) => handleChange('model', e.target.value)}
                    />
                    <div className="input-hint">
                        {settings.provider === 'gemini'
                            ? "e.g. gemini-1.5-flash, gemini-1.5-pro"
                            : "Model ID as expected by the server"}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            style={{ marginRight: '8px' }}
                            checked={settings.stream ?? true}
                            onChange={(e) => onChange({ ...settings, stream: e.target.checked })}
                        />
                        Enable Streaming
                    </label>
                    <div className="input-hint">
                        If enabled, responses will be streamed token by token. Disable if your proxy/server has issues with streaming.
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">Tokenizer</label>
                    <select
                        className="input"
                        value={settings.tokenizer || 'openai'}
                        onChange={(e) => handleChange('tokenizer', e.target.value)}
                    >
                        <option value="openai">OpenAI / GPT (Default)</option>
                        <option value="gemma">Gemma / Google</option>
                        <option value="claude">Claude / Anthropic</option>
                    </select>
                    <div className="input-hint">
                        Select the tokenizer that best matches your model for accurate token counting.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleTestConnection}
                        >
                            Test Connection
                        </button>
                        <button className="btn btn-secondary">Fetch Models</button>
                    </div>

                    {testStatus && (
                        <div className={`alert ${testStatus.type === 'error' ? 'alert-danger' : testStatus.type === 'success' ? 'alert-success' : 'alert-info'}`} style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)', background: testStatus.type === 'error' ? 'rgba(255, 0, 0, 0.1)' : testStatus.type === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(0, 0, 255, 0.1)', color: testStatus.type === 'error' ? 'var(--accent-danger)' : testStatus.type === 'success' ? 'var(--accent-success)' : 'var(--text-primary)' }}>
                            {testStatus.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
