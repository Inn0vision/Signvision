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
  signIndex?: number;
}

export interface PlayMessage {
  type: 'play';
  url: string;
  word: string;
}

export interface PlaySequenceMessage {
  type: 'playSequence';
  sigmlText: string;
  words: string[];
  initialIndex?: number;
}

export interface PlaySequenceUrlsMessage {
  type: 'playSequenceUrls';
  urls: string[];
  words: string[];
  initialIndex?: number;
}

export interface PauseMessage {
  type: 'pause';
}

export interface ResumeMessage {
  type: 'resume';
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

export interface SpeedMessage {
  type: 'speed';
  speed: number;
}

export interface ResetCameraMessage {
  type: 'resetCamera';
}

export type WebViewOutgoingMessage =
  | PlayMessage
  | PlaySequenceMessage
  | PlaySequenceUrlsMessage
  | PauseMessage
  | ResumeMessage
  | StopMessage
  | ChangeAvatarMessage
  | PingMessage
  | SpeedMessage
  | ResetCameraMessage;

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

export interface HistoryItem {
  word: string;
  timestamp: number;
  found: boolean;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  isSentence?: boolean;
  foundCount?: number;
}

// Avatar options
export const AVATAR_OPTIONS = ['luna', 'marc', 'anna', 'francoise', 'siggi'] as const;
export type AvatarName = typeof AVATAR_OPTIONS[number];

// API Response types (from backend)
export interface GlossResult {
  subject: string | null;
  object: string | null;
  verb: string | null;
  tense: string;
  negation: boolean;
  question: boolean;
  gloss: string[];
}

export interface SignLookup {
  word: string;
  original_query: string;
  found: boolean;
  s3_url: string | null;
  match_type: 'exact' | 'anchor' | 'partial' | 'semantic' | 'none';
  similar_words: string[];
}

export interface ProcessingResult {
  gloss: GlossResult;
  signs: SignLookup[];
}

export interface ProcessResponse {
  success: boolean;
  text: string;
  original_text?: string;
  detected_language?: string;
  translated_text?: string;
  results: ProcessingResult[];
  error?: string;
}

// Sign playback queue item
export interface SignQueueItem {
  word: string;
  url: string;
  matchType: SignLookup['match_type'];
}

// Processing mode for the app
export type ProcessingMode = 'word' | 'sentence';

// Video recognition microservice response (:8001)
export interface TranslateVideoCandidate {
  sign: string;
  probability: number;
}

export interface TranslateVideoResponse {
  translation: string;
  status?: 'CONFIDENT' | 'UNCERTAIN';
  predicted_sign?: string;
  raw_predicted_sign?: string;
  confidence?: number;
  hand_coverage?: number;
  rejection_reason?: string;
  status_message?: string;
  runner_up?: { sign: string | null; probability: number } | null;
  decision_margin?: number | null;
  wrist_motion?: number | null;
  gate_checks?: Record<string, { value: number; threshold: number; passed: boolean }>;
  top_candidates?: TranslateVideoCandidate[];
  temporal_window?: Record<string, any>;
  inference_time_ms?: number;
  total_processing_time_ms?: number;
}
