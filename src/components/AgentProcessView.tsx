import { type FC, useState } from 'react';
import type { ChatMessage } from '../types';
import type { AgentThought, ToolCall } from '../services/agent/types';

interface AgentProcessViewProps {
    messages: ChatMessage[];
}

const ThoughtBlock: FC<{ thought: AgentThought }> = ({ thought }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="thought-block" style={{
            marginBottom: 'var(--space-sm)',
            borderLeft: '2px solid var(--color-accent)',
            paddingLeft: 'var(--space-sm)',
            opacity: 0.9
        }}>
            <div 
                className="thought-header" 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)'
                }}
            >
                <span>{isExpanded ? '▼' : '▶'}</span>
                <span>Thinking Process</span>
            </div>
            {isExpanded && (
                <div className="thought-content" style={{
                    marginTop: 'var(--space-xs)',
                    fontSize: '0.9em',
                    fontStyle: 'italic',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'pre-wrap'
                }}>
                    {thought.content}
                </div>
            )}
        </div>
    );
};

const ToolCallBlock: FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
    return (
        <div className="tool-call-block" style={{
            marginBottom: 'var(--space-sm)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-sm)',
            border: '1px solid var(--color-border)'
        }}>
            <div className="tool-header" style={{
                fontSize: '0.85em',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
                marginBottom: 'var(--space-xs)'
            }}>
                🛠️ Using Tool: {toolCall.name}
            </div>
            <div className="tool-args" style={{
                fontSize: '0.8em',
                fontFamily: 'monospace',
                background: 'var(--color-bg-primary)',
                padding: 'var(--space-xs)',
                borderRadius: 'var(--radius-xs)',
                overflowX: 'auto'
            }}>
                {JSON.stringify(toolCall.arguments, null, 2)}
            </div>
        </div>
    );
};

export const AgentProcessView: FC<AgentProcessViewProps> = ({ messages }) => {
    return (
        <div className="chat-messages">
            {messages.length === 0 ? (
                <div className="empty-state" style={{ flex: 1, display: 'flex' }}>
                    <div className="empty-state-icon">🤖</div>
                    <div className="empty-state-title">Autonomous Agent</div>
                    <div className="empty-state-description">
                        I can research wikis, read pages, and build your character autonomously.
                        Just tell me what to create.
                    </div>
                </div>
            ) : (
                messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.role}`}>
                        <div className={`message-avatar ${msg.role}`}>
                            {msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚙️' : '🤖'}
                        </div>
                        <div className="message-content">
                            {/* Render Thoughts */}
                            {msg.thoughts && msg.thoughts.map((thought, idx) => (
                                <ThoughtBlock key={`thought-${idx}`} thought={thought} />
                            ))}

                            {/* Render Tool Calls */}
                            {msg.toolCalls && msg.toolCalls.map((toolCall, idx) => (
                                <ToolCallBlock key={`tool-${idx}`} toolCall={toolCall} />
                            ))}

                            {/* Render Main Content */}
                            {msg.content && (
                                <div className="text-content">
                                    {msg.content}
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
