import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { ChatSession } from '../types';

interface ChatSidebarProps {
    isOpen: boolean;
    sessions: ChatSession[];
    activeSessionId: string | null;
    onToggle: () => void;
    onNewSession: () => void;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onSendMessage: (sessionId: string, content: string) => void;
    onDeleteMessage: (sessionId: string, messageId: string) => void;
    onRegenerate: (sessionId: string) => void;
    onContinue: (sessionId: string) => void;
}

export const ChatSidebar: FC<ChatSidebarProps> = ({
    isOpen,
    sessions,
    activeSessionId,
    onToggle,
    onNewSession,
    onSelectSession,
    onDeleteSession,
    onSendMessage,
    onDeleteMessage,
    onRegenerate,
    onContinue
}) => {
    const [input, setInput] = useState('');
    const [width, setWidth] = useState(350);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeSession = sessions.find(s => s.id === activeSessionId);

    // Resizing logic
    const startResizing = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            
            // Calculate width based on distance from right edge of screen
            // Since sidebar is on the right, new width is (Window Width - Mouse X)
            const newWidth = window.innerWidth - e.clientX;
            
            if (newWidth > 200 && newWidth < 800) {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeSession?.messages]);

    const handleSend = () => {
        if (activeSessionId) {
            onSendMessage(activeSessionId, input);
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Toggle Button (when closed) */}
            {!isOpen && (
                <button
                    className="chat-toggle-btn collapsed"
                    onClick={onToggle}
                    title="Open AI Chat"
                >
                    💬
                </button>
            )}

            <div 
                ref={sidebarRef}
                className={`chat-sidebar ${isOpen ? 'open' : ''}`}
                style={{ width: isOpen ? width : 0 }}
            >
                {/* Resizer Handle */}
                <div 
                    className={`resizer-handle ${isResizing ? 'resizing' : ''}`}
                    onMouseDown={startResizing}
                />

                {/* Header */}
                <div className="chat-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>AI Assistant</h3>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={onToggle}>✕</button>
                    </div>

                    {/* Session Tabs */}
                    <div className="chat-tabs-scroll">
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                className={`chat-tab ${session.id === activeSessionId ? 'active' : ''}`}
                                onClick={() => onSelectSession(session.id)}
                            >
                                <span className="chat-tab-name">{session.name}</span>
                                <span
                                    className="chat-tab-close"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSession(session.id);
                                    }}
                                >×</span>
                            </div>
                        ))}
                        <button className="chat-new-btn" onClick={onNewSession} title="New Chat">+</button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="chat-messages-area">
                    {activeSession ? (
                        activeSession.messages.length === 0 ? (
                            <div className="empty-chat-state">
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🤖</div>
                                <p>Start chatting with AI</p>
                            </div>
                        ) : (
                            activeSession.messages.map((msg, index) => (
                                <div key={msg.id} className={`chat-message-bubble ${msg.role} ${msg.error ? 'error' : ''}`}>
                                    <div className="message-bubble-content">
                                        {msg.content || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>(empty)</span>}
                                    </div>
                                    <div className="message-actions">
                                        {msg.role === 'assistant' && (
                                            <>
                                                {index === activeSession.messages.length - 1 && (
                                                    <>
                                                        <button
                                                            className="msg-action-btn"
                                                            onClick={() => onRegenerate(activeSession.id)}
                                                            title="Regenerate"
                                                        >
                                                            🔄
                                                        </button>
                                                        <button
                                                            className="msg-action-btn"
                                                            onClick={() => onContinue(activeSession.id)}
                                                            title="Continue generation"
                                                        >
                                                            ⏩
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                        <button
                                            className="msg-action-btn delete"
                                            onClick={() => onDeleteMessage(activeSession.id, msg.id)}
                                            title="Delete message"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        <div className="empty-chat-state">
                            <p>No active chat</p>
                            <button className="btn btn-primary btn-sm" onClick={onNewSession}>Create Chat</button>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                {activeSession && (
                    <div className="chat-input-wrapper">
                        <textarea
                            className="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            style={{ resize: 'none' }}
                        />
                        <button
                            className="chat-send-btn"
                            onClick={handleSend}
                        >
                            ➤
                        </button>
                    </div>
                )}
            </div>

        </>
    );
};
