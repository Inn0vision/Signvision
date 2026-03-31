/**
 * API Service for SignVision
 * Handles communication with the FastAPI backend for NLP processing and semantic search
 */

// API Configuration
// Using ADB reverse proxy: run `adb reverse tcp:8000 tcp:8000`
const API_CONFIG = {
  baseUrl: __DEV__ 
    ? 'http://localhost:8000'  // Works with adb reverse
    : 'https://your-production-api.com',
  timeout: 30000,
};

// Types for API responses
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
  results: ProcessingResult[];
  error?: string;
}

export interface LookupResponse {
  success: boolean;
  word: string;
  original_query: string;
  found: boolean;
  s3_url: string | null;
  match_type: string;
  similar_words: string[];
}

export interface SearchResponse {
  success: boolean;
  query: string;
  results: Array<{
    word: string;
    similarity: number;
  }>;
}

// Custom error for API failures
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an API request with timeout and error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout - backend may be unavailable');
      }
      throw new ApiError(`Network error: ${error.message}`);
    }
    
    throw new ApiError('Unknown error occurred');
  }
}

/**
 * Process a sentence through the NLP pipeline
 * Returns GLOSS tokens and sign URLs with semantic fallback
 */
export async function processSentence(text: string): Promise<ProcessResponse> {
  return apiRequest<ProcessResponse>('/process', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

/**
 * Transcribe audio and process through NLP pipeline
 * @param audioUri - Local file URI of the audio recording
 */
export async function transcribeAudio(audioUri: string): Promise<ProcessResponse> {
  const formData = new FormData();
  
  // Get the filename from URI
  const filename = audioUri.split('/').pop() || 'audio.wav';
  
  // Append the audio file
  formData.append('file', {
    uri: audioUri,
    type: 'audio/wav',
    name: filename,
  } as unknown as Blob);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        // Don't set Content-Type for FormData - browser/RN will set it with boundary
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        `Transcription failed: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof ApiError) throw error;
    if (error instanceof Error) {
      throw new ApiError(`Transcription error: ${error.message}`);
    }
    throw new ApiError('Unknown transcription error');
  }
}

/**
 * Look up a single word with semantic fallback
 */
export async function lookupWordApi(word: string): Promise<LookupResponse> {
  const encoded = encodeURIComponent(word.trim());
  return apiRequest<LookupResponse>(`/lookup/${encoded}`);
}

/**
 * Perform semantic search for similar words
 */
export async function semanticSearch(
  query: string,
  limit: number = 5
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query: query.trim(),
    limit: limit.toString(),
  });
  return apiRequest<SearchResponse>(`/search?${params}`);
}

/**
 * Check if the backend API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Update the API base URL (useful for development/testing)
 */
export function setApiBaseUrl(url: string): void {
  API_CONFIG.baseUrl = url;
}

/**
 * Get the current API base URL
 */
export function getApiBaseUrl(): string {
  return API_CONFIG.baseUrl;
}
