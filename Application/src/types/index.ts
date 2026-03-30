/**
 * Type definitions for SignVision app
 */

// Avatar player message types (WebView <-> React Native)
export interface AvatarMessage {
  type: 'ready' | 'playing' | 'finished' | 'stopped' | 'error' | 'status' | 'pong' | 'avatarChanged';
  word?: string;
  message?: string;
  status?: string;
  gloss?: string;
  avatar?: string;
  initialized?: boolean;
}

export interface PlayMessage {
  type: 'play';
  url: string;
  word: string;
}

export interface StopMessage {
  type: 'stop';
}

export interface ChangeAvatarMessage {
  type: 'changeAvatar';
  avatar: string;
}

export interface PingMessage {
  type: 'ping';
}

export type WebViewOutgoingMessage = PlayMessage | StopMessage | ChangeAvatarMessage | PingMessage;

// App state types
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'finished' | 'error';

export interface AppState {
  searchQuery: string;
  currentWord: string | null;
  playbackStatus: PlaybackStatus;
  errorMessage: string | null;
  isAvatarReady: boolean;
  searchHistory: string[];
}

// Search history item
export interface HistoryItem {
  word: string;
  timestamp: number;
  found: boolean;
}

// Avatar options
export const AVATAR_OPTIONS = ['anna', 'marc', 'francoise', 'luna'] as const;
export type AvatarName = typeof AVATAR_OPTIONS[number];
