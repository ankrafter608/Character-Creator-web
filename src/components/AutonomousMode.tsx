import { type FC, useState, useEffect, useRef } from 'react';
import './AutonomousMode.css';
import { AgentLoop } from '../services/agent/AgentLoop';
import { computeLineDiff } from '../utils/diffUtils';
import type { AgentStatus } from '../services/agent/types';
import type { ChatMessage, APISettings, KBFile, CharacterData, LorebookData, LorebookEntry } from '../types';

interface AutonomousModeProps {
    messages: ChatMessage[];
    character: CharacterData;
    lorebook: LorebookData; // Added lorebook
    onSendMessage: (message: string) => void;
    isGenerating: boolean;
    // Context needed for tools
    settings: APISettings;
    wikiUrl: string;
    kbFiles: KBFile[];
    onAddKbFile: (file: KBFile) => void;
    onUpdateKbFile: (file: KBFile) => void;
    onUpdateCharacter: (data: Partial<CharacterData>) => void;
    onAddLorebookEntry: (entry: Partial<LorebookEntry>) => void;
    onUpdateMessages: (messages: ChatMessage[]) => void;
}

export const AutonomousMode: FC<AutonomousModeProps> = ({ 
    messages, 
    character,
    lorebook,
    settings,
    wikiUrl,
    kbFiles,
    onAddKbFile,
    onUpdateKbFile,
    onUpdateCharacter,
    onAddLorebookEntry,
    onUpdateMessages
}) => {
    const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
    const agentStatusRef = useRef<AgentStatus>('idle'); // Ref to track status synchronously
    
    const updateAgentStatus = (status: AgentStatus) => {
        setAgentStatus(status);
        agentStatusRef.current = status;
    };

    const [inputValue, setInputValue] = useState('');
    const agentRef = useRef<AgentLoop | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});

    const toggleSteps = (msgId: string) => {
        setCollapsedSteps(prev => ({
            ...prev,
            [msgId]: !prev[msgId]
        }));
    };

    // Initial Character State for Diffing
    const [initialCharacter, setInitialCharacter] = useState<CharacterData | null>(null);

    // Set initial character once when component mounts (or when character is first available)
    useEffect(() => {
        if (!initialCharacter && character) {
            setInitialCharacter(JSON.parse(JSON.stringify(character)));
        }
    }, [character]); // Logic ensures it only sets once unless manually reset

    // Compute Diff
    const characterDiff = initialCharacter ? computeLineDiff(
        JSON.stringify(initialCharacter, null, 2),
        JSON.stringify(character, null, 2)
    ) : [];

    // Ref to access latest messages in async callbacks
    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Ref for onUpdateMessages to avoid stale closures in AgentLoop
    const onUpdateMessagesRef = useRef(onUpdateMessages);
    useEffect(() => {
        onUpdateMessagesRef.current = onUpdateMessages;
    }, [onUpdateMessages]);

    // Update AgentLoop context whenever dependencies change
    useEffect(() => {
        if (agentRef.current) {
            agentRef.current.updateContext({
                wikiUrl,
                kbFiles,
                character,
                lorebook,
                addKbFile: onAddKbFile,
                updateKbFile: onUpdateKbFile,
                updateCharacter: onUpdateCharacter,
                addLorebookEntry: onAddLorebookEntry,
                settings
            });
        }
    }, [wikiUrl, kbFiles, character, lorebook, onAddKbFile, onUpdateKbFile, onUpdateCharacter, onAddLorebookEntry, settings]);

    // Initialize agent loop
    useEffect(() => {
        if (!agentRef.current) {
            console.log('[AutonomousMode] Initializing AgentLoop');
            agentRef.current = new AgentLoop(
                settings,
                { 
                    wikiUrl, 
                    kbFiles,
                    character,
                    lorebook,
                    addKbFile: onAddKbFile,
                    updateKbFile: onUpdateKbFile,
                    updateCharacter: (data: any) => {
                        console.log('[AutonomousMode] updateCharacter called via initial context', data);
                        onUpdateCharacter(data);
                    },
                    addLorebookEntry: (entry: any) => {
                        console.log('[AutonomousMode] addLorebookEntry called via initial context', entry);
                        onAddLorebookEntry(entry);
                    },
                    settings
                },
                (status) => updateAgentStatus(status),
                (msg) => {
                    // ... (existing callback)
                    const newMsg: ChatMessage = {
                        id: Date.now().toString(),
                        role: msg.role as 'user' | 'assistant' | 'system',
                        content: msg.content,
                        timestamp: Date.now(),
                        thoughts: msg.thoughts,
                        toolCalls: msg.toolCalls
                    };
                    
                    const lastMsg = messagesRef.current[messagesRef.current.length - 1];
                    const isStreaming = agentStatusRef.current !== 'idle';
                    
                    if (lastMsg && lastMsg.role === 'assistant' && isStreaming) {
                         const updatedMessages = [...messagesRef.current];
                         updatedMessages[updatedMessages.length - 1] = {
                             ...lastMsg,
                             content: msg.content,
                             thoughts: msg.thoughts,
                             toolCalls: msg.toolCalls
                         };
                         onUpdateMessagesRef.current(updatedMessages);
                         messagesRef.current = updatedMessages;
                    } else {
                        const newMessages = [...messagesRef.current, newMsg];
                        onUpdateMessagesRef.current(newMessages);
                        messagesRef.current = newMessages;
                    }
                }
            );
        }
    }, []); // Run once on mount

    // Update agent context when props change
    useEffect(() => {
        if (agentRef.current) {
            console.log('[AutonomousMode] Updating AgentLoop context');
            (agentRef.current as any).context = {
                wikiUrl,
                kbFiles,
                character,
                lorebook,
                addKbFile: (file: any) => {
                    console.log('[AutonomousMode] addKbFile context wrapper called', file.name);
                    onAddKbFile(file);
                },
                updateKbFile: onUpdateKbFile,
                updateCharacter: (data: any) => {
                    console.log('[AutonomousMode] updateCharacter context wrapper called', data);
                    onUpdateCharacter(data);
                },
                addLorebookEntry: (entry: any) => {
                    console.log('[AutonomousMode] addLorebookEntry context wrapper called', entry);
                    onAddLorebookEntry(entry);
                },
                settings
            };
            (agentRef.current as any).settings = settings;
        }
    }, [settings, wikiUrl, kbFiles, character, lorebook, onAddKbFile, onUpdateKbFile, onUpdateCharacter, onAddLorebookEntry]);

    const handleSend = async () => {
        if (!inputValue.trim() || agentStatus !== 'idle') return;

        // If starting a new session, reset initial character state to track changes from NOW
        if (messages.length === 0) {
            setInitialCharacter(JSON.parse(JSON.stringify(character)));
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: Date.now()
        };

        const newMessages = [...messages, userMsg];
        onUpdateMessages(newMessages); // Uses the prop directly, which app delegates to closure
        setInputValue('');
        
        // Add a placeholder assistant message for streaming
        const placeholderAiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            thoughts: [],
            toolCalls: []
        };
        const messagesWithPlaceholder = [...newMessages, placeholderAiMsg];
        
        // CRITICAL FIX: Update ref immediately so the callback sees the placeholder
        messagesRef.current = messagesWithPlaceholder;
        onUpdateMessages(messagesWithPlaceholder);
        
        await agentRef.current?.start(messagesWithPlaceholder);
    };

    // Auto-scroll to bottom with better logic
    useEffect(() => {
        // Only scroll if we are near the bottom to avoid "convulsing" when user reads up history
        const el = messagesEndRef.current;
        if (!el) return;

        // Force scroll on new message (length change) or status change
        // For streaming content, we can use a more lenient behavior
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length, agentStatus]); // Removed 'messages' content dependency to stop jitter

    // console.log('[AutonomousMode] Render. Messages:', messages.length, 'Status:', agentStatus);

    const renderDiffViewer = (diff: any[]) => (
        <div className="code-block" style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#1e1e1e', overflowX: 'auto', padding: '10px', height: '100%' }}>
            {diff.map((line, i) => (
                <div key={i} style={{
                    backgroundColor: line.type === 'added' ? 'rgba(0, 255, 0, 0.15)' :
                        line.type === 'removed' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
                    color: line.type === 'removed' ? '#aaa' : '#eee',
                    display: 'flex',
                }}>
                    <span style={{ minWidth: '15px', color: '#666', userSelect: 'none' }}>
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span style={{ whiteSpace: 'pre' }}>{line.content}</span>
                </div>
            ))}
        </div>
    );

    const renderMessage = (msg: ChatMessage, idx: number) => {
        if (msg.role === 'user') {
            return (
                <div key={msg.id || idx} className="chat-message user" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="message-avatar user">👤</div>
                    <div className="message-content">
                        <div className="text-content">{msg.content}</div>
                    </div>
                </div>
            );
        }

        // Assistant Message - "Agentic" Style
        // If there are no thoughts or tools, and content is empty, show "Thinking..." placeholder
        const isEmpty = !msg.content && (!msg.thoughts || msg.thoughts.length === 0) && (!msg.toolCalls || msg.toolCalls.length === 0);
        
        if (isEmpty && msg.role === 'assistant') {
             // Show a placeholder loader
             return (
                <div key={msg.id || idx} className="agent-message-container" style={{ marginBottom: 'var(--space-xl)', opacity: 0.7 }}>
                    <div className="agent-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="agent-avatar" style={{ fontSize: '1.2rem' }}>🤖</div>
                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Agent</div>
                            <span className="agent-status-badge">Thinking...</span>
                        </div>
                    </div>
                </div>
             );
        }
        
        if (isEmpty) return null;

        const hasSteps = (msg.thoughts && msg.thoughts.length > 0) || (msg.toolCalls && msg.toolCalls.length > 0);

        // Default collapse logic: collapse if it's not the latest message
        // BUT if user explicitly toggled it, respect that preference
        const isLatest = idx === messages.length - 1;
        const isCollapsedState = collapsedSteps[msg.id]; 
        
        // If state is undefined, default to collapsed for old messages, open for latest
        const isCollapsed = isCollapsedState !== undefined ? isCollapsedState : !isLatest;

        return (
            <div key={msg.id || idx} className="agent-message-container" style={{ marginBottom: 'var(--space-xl)' }}>
                
                {/* 1. Header with Status */}
                <div className="agent-header" style={{ justifyContent: 'space-between', display: 'flex' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="agent-avatar" style={{ fontSize: '1.2rem' }}>🤖</div>
                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Agent</div>
                        {agentStatus !== 'idle' && isLatest && (
                            <span className="agent-status-badge" style={{ 
                                fontSize: '0.75rem', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                background: 'rgba(var(--primary-rgb), 0.1)',
                                color: 'var(--primary)'
                            }}>
                                {agentStatus === 'thinking' ? 'Thinking...' : agentStatus === 'executing' ? 'Working...' : 'Active'}
                            </span>
                        )}
                     </div>
                     {hasSteps && (
                        <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ fontSize: '0.8rem', padding: '2px 8px', height: 'auto', opacity: 0.7 }}
                            onClick={() => toggleSteps(msg.id)}
                        >
                            {isCollapsed ? 'Show Steps' : 'Hide Steps'}
                        </button>
                     )}
                </div>

                {/* 2. Chain of Thought (Collapsible) */}
                {hasSteps && !isCollapsed && (
                    <div style={{ marginTop: '12px', marginBottom: '16px', animation: 'fadeIn 0.2s' }}>
                        {/* Thoughts & Tools Combined Stream */}
                        {msg.thoughts?.map((thought, i) => (
                            <div key={`thought-${i}`} className="agent-step thought">
                                <span style={{ marginRight: '8px' }}>💭</span>
                                <span>{thought.content}</span>
                            </div>
                        ))}

                        {msg.toolCalls?.map((tool, i) => {
                             const isPending = tool.arguments && tool.arguments._status === 'pending';
                             return (
                                <div key={`tool-${i}`} className={`agent-step tool ${isPending ? 'pending' : 'success'}`}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{isPending ? '⏳' : tool.result ? '✅' : '⚙️'}</span>
                                            <strong>{tool.name}</strong>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                            {isPending ? 'Preparing...' : 'Executed'}
                                        </span>
                                    </div>
                                    
                                    {!isPending && (
                                        <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.8, overflowX: 'auto', fontFamily: 'monospace' }}>
                                            {JSON.stringify(tool.arguments)}
                                        </div>
                                    )}
                                    
                                    {tool.result && (
                                        <div style={{ 
                                            marginTop: '6px', 
                                            paddingTop: '6px', 
                                            borderTop: '1px solid rgba(255,255,255,0.1)', 
                                            fontSize: '0.8rem', 
                                            color: 'var(--success)'
                                        }}>
                                            RESULT: {tool.result.substring(0, 100)}{tool.result.length > 100 ? '...' : ''}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Collapsed Placeholder */}
                {hasSteps && isCollapsed && (
                    <div style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic', marginBottom: '12px', paddingLeft: '4px' }}>
                        {msg.thoughts?.length || 0} thoughts, {msg.toolCalls?.length || 0} actions hidden...
                    </div>
                )}

                {/* 3. Final Response Text */}
                {msg.content && (
                    <div className="agent-response">
                        <div className="text-content markdown-body" style={{ whiteSpace: 'pre-wrap' }}>
                            {msg.content}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleClearChat = () => {
        onUpdateMessages([]);
        setInitialCharacter(null); // Reset diff tracking if needed, or keep it to show cumulative changes
    };

    return (
        <div className="page-content" style={{ height: 'calc(100vh - 60px)', display: 'flex', gap: 'var(--space-md)', overflow: 'hidden' }}>
            
            {/* Left Panel: Chat */}
            <div className="chat-container" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                
                {/* Header with Actions */}
                <div style={{ padding: '0 var(--space-md) var(--space-xs)', display: 'flex', justifyContent: 'flex-end' }}>
                    {messages.length > 0 && (
                        <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={handleClearChat}
                            title="Clear Chat"
                            disabled={agentStatus !== 'idle'}
                        >
                            🗑️ Clear History
                        </button>
                    )}
                </div>

                {/* Agent Process View */}
                <div className="chat-messages" style={{ overflowY: 'auto', padding: 'var(--space-md)' }}>
                    {messages.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">🤖</div>
                            <div className="empty-state-title">Autonomous Agent</div>
                            <div className="empty-state-description">
                                I am ready to research and create. Tell me what to build.
                            </div>
                        </div>
                    )}
                    
                    {messages.map(renderMessage)}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="chat-input-area">
                    <input
                        type="text"
                        className="input"
                        placeholder="Create a character based on Gilgamesh from Fate..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={agentStatus !== 'idle'}
                    />
                    <button 
                        className="btn btn-primary" 
                        onClick={handleSend}
                        disabled={agentStatus !== 'idle'}
                    >
                        {agentStatus === 'idle' ? 'Start' : 'Stop'}
                    </button>
                </div>
            </div>

            {/* Right Panel: Live Changes */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="card-header">
                    <h3 className="card-title">📝 Live Changes</h3>
                </div>
                <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
                    {initialCharacter ? (
                        renderDiffViewer(characterDiff)
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-description">Waiting for changes...</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
