import type { FC } from 'react';
import type { CharacterData, APISettings } from '../types';
import { usePersistentHeights } from '../hooks/usePersistentLayout';
import { countTokens } from '../utils/tokenCounter';

interface CharacterEditorProps {
    character: CharacterData;
    onChange: (character: CharacterData) => void;
    onOpenLibrary: () => void;
    onNew: () => void;
    settings: APISettings;
}

const fields: { id: keyof CharacterData; label: string; icon: string; rows: number; placeholder: string; colSpan: number }[] = [
    {
        id: 'name',
        label: 'Character Name',
        icon: '✏️',
        rows: 1,
        placeholder: 'Enter the character\'s name...',
        colSpan: 4
    },
    {
        id: 'personality',
        label: 'Personality',
        icon: '💫',
        rows: 6,
        placeholder: 'Character traits, behavior patterns, quirks, likes and dislikes...',
        colSpan: 8
    },
    {
        id: 'description',
        label: 'Description',
        icon: '📝',
        rows: 15,
        placeholder: 'Detailed description of the character\'s appearance, background, and notable characteristics...',
        colSpan: 6
    },
    {
        id: 'scenario',
        label: 'Scenario',
        icon: '🎭',
        rows: 10,
        placeholder: 'The setting and context for interactions with this character...',
        colSpan: 6
    },
    {
        id: 'first_mes',
        label: 'First Message',
        icon: '💬',
        rows: 10,
        placeholder: 'The opening message the character will send...',
        colSpan: 6
    },
    {
        id: 'mes_example',
        label: 'Example Messages',
        icon: '📋',
        rows: 15,
        placeholder: '<START>\n{{user}}: Hello!\n{{char}}: *waves* Hi there! Nice to meet you!',
        colSpan: 6
    },
    {
        id: 'creator_notes',
        label: "Author's Note",
        icon: '📓',
        rows: 6,
        placeholder: "Author's notes about the character, greeting summaries, usage tips...",
        colSpan: 12
    },
];

export const CharacterEditor: FC<CharacterEditorProps> = ({ character, onChange, onOpenLibrary, onNew, settings }) => {
    const { track, heights } = usePersistentHeights('character_editor_layout');

    const handleFieldChange = (fieldId: keyof CharacterData, value: string) => {
        if (fieldId === 'alternate_greetings') return;
        onChange({ ...character, [fieldId]: value });
    };

    const handleGreetingChange = (index: number, value: string) => {
        const newGreetings = [...character.alternate_greetings];
        newGreetings[index] = value;
        onChange({ ...character, alternate_greetings: newGreetings });
    };

    const addGreeting = () => {
        onChange({ ...character, alternate_greetings: [...character.alternate_greetings, ''] });
    };

    const removeGreeting = (index: number) => {
        onChange({
            ...character,
            alternate_greetings: character.alternate_greetings.filter((_, i) => i !== index),
        });
    };

    const handleNewCharacter = () => {
        if (confirm('Are you sure you want to create a new character? All unsaved changes will be lost.')) {
            onNew();
        }
    };

    const handleExportJSON = () => {
        // Construct V3 Character Card
        const exportData = {
            spec: "chara_card_v3",
            spec_version: "3.0",
            data: {
                name: character.name,
                description: character.description,
                personality: character.personality,
                scenario: character.scenario,
                first_mes: character.first_mes,
                mes_example: character.mes_example,
                creator_notes: character.creator_notes,
                system_prompt: "",
                post_history_instructions: "",
                tags: [],
                creator: "",
                character_version: "",
                alternate_greetings: character.alternate_greetings,
                extensions: {
                    talkativeness: "0.5",
                    fav: false,
                    world: "",
                    depth_prompt: {
                        prompt: "",
                        depth: 4,
                        role: "system"
                    }
                }
            }
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${character.name || 'character'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="page-content">
            <div className="field-grid">
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        className={`field-card animate-fadeIn field-span-${field.colSpan}`}
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="field-header">
                            <div className="field-title">
                                <span>{field.icon}</span>
                                <span>{field.label}</span>
                            </div>
                            <div className="field-actions">
                                <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Clear field"
                                    onClick={() => handleFieldChange(field.id, '')}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div className="field-body">
                            <textarea
                                ref={track(field.id)}
                                className="textarea input"
                                rows={field.rows}
                                value={character[field.id] as string}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                style={heights[field.id] ? { height: heights[field.id] } : undefined}
                            />
                        </div>
                        <div className="field-footer">
                            <span className="token-count">
                                {countTokens(character[field.id] as string, settings.tokenizer || 'openai')} tokens
                            </span>
                        </div>
                    </div>
                ))}

                {/* Alternate Greetings */}
                <div className="field-card animate-fadeIn field-span-12">
                    <div className="field-header">
                        <div className="field-title">
                            <span>👋</span>
                            <span>Alternate Greetings</span>
                            <span className="badge badge-muted">{character.alternate_greetings.length}</span>
                        </div>
                        <div className="field-actions">
                            <button className="btn btn-secondary btn-sm" onClick={addGreeting}>
                                + Add Greeting
                            </button>
                        </div>
                    </div>
                    <div className="field-body">
                        {character.alternate_greetings.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                <div className="empty-state-icon">👋</div>
                                <div className="empty-state-title">No alternate greetings</div>
                                <div className="empty-state-description">
                                    Add multiple greetings for variety in character interactions
                                </div>
                                <button className="btn btn-primary" onClick={addGreeting}>
                                    Add First Greeting
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                {character.alternate_greetings.map((greeting, index) => (
                                    <div key={index} style={{ position: 'relative' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            marginBottom: 'var(--space-sm)'
                                        }}>
                                            <span className="badge badge-primary">#{index + 1}</span>
                                            <div style={{ flex: 1 }} />
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                title="Generate"
                                            >
                                                ✨
                                            </button>
                                            <button
                                                className="btn btn-danger btn-icon btn-sm"
                                                onClick={() => removeGreeting(index)}
                                                title="Remove"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <textarea
                                            className="textarea input"
                                            rows={5}
                                            value={greeting}
                                            onChange={(e) => handleGreetingChange(index, e.target.value)}
                                            placeholder="An alternate opening message..."
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div style={{
                marginTop: 'var(--space-xl)',
                display: 'flex',
                gap: 'var(--space-md)',
                justifyContent: 'flex-end',
                paddingTop: 'var(--space-lg)',
                borderTop: '1px solid var(--border-subtle)'
            }}>
                <div style={{ marginRight: 'auto' }}>
                    <button className="btn btn-ghost text-danger" onClick={handleNewCharacter}>
                        🗑️ Clear All
                    </button>
                </div>
                <button className="btn btn-secondary" onClick={onOpenLibrary}>Load Character</button>
                <button className="btn btn-secondary" onClick={handleExportJSON}>Export JSON</button>
                <button className="btn btn-primary btn-lg" onClick={onOpenLibrary}>Save Character</button>
            </div>
        </div>
    );
};
