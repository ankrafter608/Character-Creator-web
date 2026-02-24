// Core types for the autonomous agent

export interface ToolCall {
  name: string;
  arguments: any;
  result?: string;
  id: string;
}

export interface AgentThought {
  type: 'thought' | 'command' | 'result' | 'error';
  content: string;
  toolCall?: ToolCall;
  timestamp: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thoughts?: AgentThought[];
  toolCalls?: ToolCall[];
}

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'observing' | 'error';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object; // JSON schema
  execute: (args: any, context: any) => Promise<string>;
}
