import type { FC } from 'react';
import type { ChatMessage } from '../types';

interface AutonomousModeProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isGenerating: boolean;
}

export const AutonomousMode: FC<AutonomousModeProps> = ({ messages, isGenerating }) => {
    return (
        <div className="page-content" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <div className="chat-container" style={{ flex: 1 }}>
                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="empty-state" style={{ flex: 1, display: 'flex' }}>
                            <div className="empty-state-icon">🤖</div>
                            <div className="empty-state-title">Autonomous Character Creator</div>
                            <div className="empty-state-description">
                                Describe the character you want to create in one prompt.
                                The AI will generate all fields, including personality, scenario, and example messages.
                            </div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 'var(--space-sm)',
                                justifyContent: 'center',
                                marginTop: 'var(--space-md)'
                            }}>
                                <span className="badge badge-primary">+ Include Lorebook</span>
                                <span className="badge badge-success">Full Card Generation</span>
                                <span className="badge badge-muted">Iterative Refinement</span>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={`chat-message ${msg.role}`}>
                                <div className={`message-avatar ${msg.role}`}>
                                    {msg.role === 'user' ? '👤' : '🤖'}
                                </div>
                                <div className="message-content">{msg.content}</div>
                            </div>
                        ))
                    )}

                    {isGenerating && (
                        <div className="chat-message assistant">
                            <div className="message-avatar">🤖</div>
                            <div className="message-content">
                                <span className="animate-pulse">Generating character...</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="chat-input-area">
                    <label className="checkbox-label" style={{ whiteSpace: 'nowrap' }}>
                        <input type="checkbox" defaultChecked />
                        Include Lorebook
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Describe your character... (e.g., 'A cyberpunk hacker with a mysterious past')"
                    />
                    <button className="btn btn-primary">
                        Generate ✨
                    </button>
                </div>
            </div>
        </div>
    );
};
