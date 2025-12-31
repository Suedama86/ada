export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: 'SYSTEM' | 'USER' | 'JARVIS' | 'TOOL';
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AgentModule {
  id: string;
  name: string;
  status: 'active' | 'standby' | 'offline';
  load: number; // 0-100%
}

export interface SmartDevice {
  id: string;
  name: string;
  type: 'light' | 'lock' | 'thermostat';
  state: boolean | string | number;
  location: string;
}

export interface AudioVolumeState {
  input: number;
  output: number;
}

export type AIProvider = 'GEMINI' | 'OLLAMA';

export type ComputeTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  tier: ComputeTier;
  description: string;
  isVisionCapable: boolean;
}

export interface PendingUpdate {
  code: string;
  description: string;
  riskLevel: 'LOW' | 'HIGH';
}