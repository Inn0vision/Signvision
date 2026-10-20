import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import AvatarWebView, { AvatarWebViewRef } from '../components/AvatarWebView';
import { SearchBar } from '../components/SearchBar';
import { ModeSelector } from '../components/ModeSelector';
import { GlossTokenBar, type GlossToken } from '../components/GlossTokenBar';
import { PlaybackQueueBar } from '../components/PlaybackQueueBar';
import { Header } from '../components/Header';
import { HistorySheet } from '../components/HistorySheet';
import { AvatarSelectSheet } from '../components/AvatarSelectSheet';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { lookupWord, getWordCount } from '../services/s3Service';
import CameraTranslateScreen from './CameraTranslateScreen';
import { processSentence, ApiError } from '../services/apiService';
import { compileSentenceSiGML } from '../services/sigmlCompiler';
import { useResponsive } from '../hooks/useResponsive';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import type { PlaybackStatus, HistoryItem, SignQueueItem, ProcessingMode, SearchHistoryItem, AvatarName } from '../types';
import { AVATAR_OPTIONS } from '../types';
import {
  CharacterSwitchIcon,
  ClockIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  PlayIcon,
  PauseIcon,
  PreviousSignIcon,
  NextSignIcon,
  ChevronDownIcon,
  CloseIcon,
  SearchMagnifyIcon,
} from '../components/ui/AppIcons';

const HISTORY_STORAGE_KEY = '@signvision_history';
const AVATAR_STORAGE_KEY = '@signvision_selected_avatar';
const MAX_HISTORY_ITEMS = 30;

const INITIAL_DEMO_SIGNS: SignQueueItem[] = [
  { word: 'WHO', url: 'https://signvision-data-741452524968-bucket.s3.ap-south-1.amazonaws.com/sigml-files/who.sigml', matchType: 'exact' },
  { word: 'FRIEND', url: 'https://signvision-data-741452524968-bucket.s3.ap-south-1.amazonaws.com/sigml-files/you.sigml', matchType: 'exact' },
  { word: 'WHO', url: 'https://signvision-data-741452524968-bucket.s3.ap-south-1.amazonaws.com/sigml-files/who.sigml', matchType: 'exact' },
];

const INITIAL_DEMO_HISTORY: HistoryItem[] = [
  {
    word: 'please tell me if you need any help',
    timestamp: 1792300320000,
    found: true,
    signCount: 3,
  },
  {
    word: 'but i can help you',
    timestamp: 1792295700000,
    found: true,
    signCount: 4,
  },
];

const formatRecentMeta = (item: HistoryItem): string => {
  const signs = item.signCount ?? Math.max(1, item.word.trim().split(/\s+/).length);
  const date = new Date(item.timestamp);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()] || 'Oct';
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;
  return `${signs} signs · ${day} ${month} ${year}, ${timeStr}`;
};

const AVATAR_LABELS: Record<AvatarName, string> = {
  luna: '👩 Luna',
  marc: '👨 Marc',
  anna: '👱‍♀️ Anna',
  francoise: '👩‍💼 Francoise',
  siggi: '🧢 Siggi',
};

export const HomeScreen: React.FC = () => {
  const responsive = useResponsive();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('hello');
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>(INITIAL_DEMO_HISTORY);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarName>('luna');
  const [isAvatarSheetOpen, setIsAvatarSheetOpen] = useState(false);

  // Sentence processing state
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'mr'>('en');
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('sentence');
  const [signQueue, setSignQueue] = useState<SignQueueItem[]>(INITIAL_DEMO_SIGNS);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawGlossTokens, setRawGlossTokens] = useState<string[]>([]);
  const [translatedSentence, setTranslatedSentence] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const avatarRef = useRef<AvatarWebViewRef>(null);

  // Refs for robust sequence playback and avoiding stale closures
  const signQueueRef = useRef<SignQueueItem[]>(INITIAL_DEMO_SIGNS);
  const currentQueueIndexRef = useRef(0);
  const processingModeRef = useRef<ProcessingMode>('sentence');
  const isPlayingRef = useRef<boolean>(false);
  const isSequenceModeRef = useRef<boolean>(false);
  const isContinuousSequenceRef = useRef<boolean>(false);
  const lastFinishedTimeRef = useRef<number>(0);
  const lastFinishedIndexRef = useRef<number>(-1);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const pendingSentenceRef = useRef<{ queue: SignQueueItem[]; startIndex: number } | null>(null);

  useEffect(() => { signQueueRef.current = signQueue; }, [signQueue]);
  useEffect(() => { currentQueueIndexRef.current = currentQueueIndex; }, [currentQueueIndex]);
  useEffect(() => { processingModeRef.current = processingMode; }, [processingMode]);

  useEffect(() => {
    loadHistory();
    loadAvatarPreference();
    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, []);

  const loadAvatarPreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      if (saved && (AVATAR_OPTIONS as readonly string[]).includes(saved)) {
        setSelectedAvatar(saved as AvatarName);
      }
    } catch (error) {
      console.warn('Failed to load avatar preference:', error);
    }
  };

  const handleSelectAvatar = useCallback(async (newAvatar: AvatarName) => {
    if (newAvatar === selectedAvatar) return;
    if (playbackStatus === 'playing') {
      avatarRef.current?.stop();
      setPlaybackStatus('idle');
    }
    setSelectedAvatar(newAvatar);
    avatarRef.current?.setAvatar?.(newAvatar);
    try {
      await AsyncStorage.setItem(AVATAR_STORAGE_KEY, newAvatar);
    } catch (error) {
      console.warn('Failed to save avatar preference:', error);
    }
  }, [selectedAvatar, playbackStatus]);

  // Plays a single sign; if isSequence is false, stops immediately after playing once (NO looping)
  const playSignAtIndex = useCallback((index: number, queue?: SignQueueItem[], isSequence = false) => {
    const activeQueue = queue || signQueueRef.current;
    if (!activeQueue || activeQueue.length === 0 || index < 0 || index >= activeQueue.length) return;

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!isSequence) {
      isContinuousSequenceRef.current = false;
    }
    isSequenceModeRef.current = isSequence;
    isPlayingRef.current = true;
    currentQueueIndexRef.current = index;
    lastFinishedIndexRef.current = -1;
    setCurrentQueueIndex(index);
    setCurrentWord(activeQueue[index].word);
    setPlaybackStatus('playing');

    avatarRef.current?.play(activeQueue[index].url, activeQueue[index].word);
  }, []);

  // Plays ONLY ONCE a single sign (e.g. when tapping a tile) and stops
  const playSingleSign = useCallback((index: number, queue?: SignQueueItem[]) => {
    isContinuousSequenceRef.current = false;
    playSignAtIndex(index, queue, false);
  }, [playSignAtIndex]);

  // Plays a full sequence once through from startIndex to end, then stops (NO looping)
  // For multi-sign sentences, preloads all SiGML assets upfront so playback flows continuously without per-word buffering
  const startSentencePlayback = useCallback(async (queue: SignQueueItem[], startIndex = 0) => {
    if (!queue || queue.length === 0 || startIndex >= queue.length) return;
    signQueueRef.current = queue;
    setSignQueue(queue);

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!isAvatarReady) {
      pendingSentenceRef.current = { queue, startIndex };
      return;
    }

    const currentSession = ++playbackSessionRef.current;

    // For single-sign sentence, play directly
    if (queue.length === 1) {
      isContinuousSequenceRef.current = false;
      playSignAtIndex(0, queue, false);
      return;
    }

    // Preload all signs in parallel upfront into memory/HTTP cache
    // This eliminates any per-word network buffering and ensures exact 1:1 synchronization with cards 1, 2, 3...
    setPlaybackStatus('loading');
    setCurrentQueueIndex(startIndex);
    currentQueueIndexRef.current = startIndex;
    setCurrentWord(queue[startIndex].word);

    try {
      await Promise.all(
        queue.map(sign =>
          fetch(sign.url)
            .then(res => res.text())
            .catch(err => console.warn(`[HomeScreen] Preload failed for ${sign.word}:`, err))
        )
      );
    } catch (err) {
      console.warn('[HomeScreen] Preload error (non-fatal):', err);
    }

    if (playbackSessionRef.current !== currentSession) return;

    isContinuousSequenceRef.current = false;
    isSequenceModeRef.current = true;
    isPlayingRef.current = true;
    playSignAtIndex(startIndex, queue, true);
  }, [isAvatarReady, playSignAtIndex]);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSearchHistory(parsed);
          return;
        }
      }
      setSearchHistory(INITIAL_DEMO_HISTORY);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_HISTORY));
    } catch (error) {
      console.error('Failed to load history:', error);
      setSearchHistory(INITIAL_DEMO_HISTORY);
    }
  };

  const saveToHistory = async (word: string, found: boolean, signCount?: number) => {
    try {
      const count = signCount ?? (word.trim().includes(' ') ? word.trim().split(/\s+/).length : 1);
      const newItem: HistoryItem = { word, timestamp: Date.now(), found, signCount: count };
      const filtered = searchHistory.filter(h => h.word.toLowerCase() !== word.toLowerCase());
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setSearchHistory(updated);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const resetPlaybackState = () => {
    playbackSessionRef.current++;
    pendingSentenceRef.current = null;
    lastFinishedIndexRef.current = -1;
    setSignQueue([]);
    setCurrentQueueIndex(0);
    setRawGlossTokens([]);
    setTranslatedSentence(null);
    setErrorMessage(null);
    setSuggestions([]);
  };

  const handleSearch = useCallback(async (input: string, lang = selectedLanguage) => {
    if (!input.trim()) return;

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    isPlayingRef.current = false;
    isContinuousSequenceRef.current = false;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    avatarRef.current?.stop();
    resetPlaybackState();

    if (processingMode === 'sentence') {
      setIsProcessing(true);
      setPlaybackStatus('loading');

      try {
        const response = await processSentence(input, lang);

        if (!response.success || response.results.length === 0) {
          setPlaybackStatus('error');
          setErrorMessage(response.error || 'Failed to process sentence');
          saveToHistory(input, false);
          setIsProcessing(false);
          return;
        }

        if (response.translated_text && response.translated_text.trim().toLowerCase() !== input.trim().toLowerCase()) {
          setTranslatedSentence(response.translated_text.trim());
        } else {
          setTranslatedSentence(null);
        }

        const result = response.results[0];
        setRawGlossTokens(result.gloss.gloss);

        const queue: SignQueueItem[] = result.signs
          .filter(sign => sign.found && sign.s3_url)
          .map(sign => ({
            word: sign.word,
            url: sign.s3_url!,
            matchType: sign.match_type,
          }));

        if (queue.length === 0) {
          setPlaybackStatus('error');
          setErrorMessage('No signs found for this sentence');
          const unfound = result.signs.find(s => !s.found);
          if (unfound?.similar_words) {
            setSuggestions(unfound.similar_words);
          }
          saveToHistory(input, false);
        } else {
          setSignQueue(queue);
          signQueueRef.current = queue;
          currentQueueIndexRef.current = 0;
          saveToHistory(input, true, queue.length);
          startSentencePlayback(queue, 0);
        }
      } catch (error) {
        setPlaybackStatus('error');
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Failed to connect to backend');
        }
        saveToHistory(input, false);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setPlaybackStatus('loading');

      const result = lookupWord(input);

      if (result.found && result.url) {
        setCurrentWord(result.word);
        saveToHistory(result.word, true, 1);
        const singleQueue: SignQueueItem[] = [{
          word: result.word,
          url: result.url,
          matchType: result.matchType || 'exact',
        }];
        setSignQueue(singleQueue);
        signQueueRef.current = singleQueue;
        setCurrentQueueIndex(0);
        currentQueueIndexRef.current = 0;
        isSequenceModeRef.current = false;
        isPlayingRef.current = true;
        avatarRef.current?.play(result.url, result.word);
      } else {
        setPlaybackStatus('error');
        setErrorMessage(`"${input}" not found in dictionary`);
        setSuggestions(result.suggestions || []);
        saveToHistory(input, false);
      }
    }
  }, [searchHistory, processingMode, selectedLanguage, startSentencePlayback]);

  const handleAvatarReady = useCallback(() => {
    setIsAvatarReady(true);
    setPlaybackStatus('idle');
    if (pendingSentenceRef.current) {
      const pending = pendingSentenceRef.current;
      pendingSentenceRef.current = null;
      startSentencePlayback(pending.queue, pending.startIndex);
    }
  }, [startSentencePlayback]);

  const handlePlaying = useCallback((word: string, signIndex?: number) => {
    setPlaybackStatus('playing');
    setCurrentWord(word);
    // Only allow WebView to set queue index when continuous single-text SiGML compile is active
    // For sequential playback, currentQueueIndexRef is exclusively governed by playSignAtIndex
    if (isContinuousSequenceRef.current && typeof signIndex === 'number' && signIndex >= 0) {
      currentQueueIndexRef.current = signIndex;
      setCurrentQueueIndex(signIndex);
    }
  }, []);

  const handleFinished = useCallback((word: string) => {
    const now = Date.now();
    if (now - lastFinishedTimeRef.current < 250) return;
    lastFinishedTimeRef.current = now;

    if (!isPlayingRef.current) {
      setPlaybackStatus('finished');
      return;
    }

    // Continuous compiled sequence finished playing completely
    if (isContinuousSequenceRef.current) {
      isContinuousSequenceRef.current = false;
      isSequenceModeRef.current = false;
      isPlayingRef.current = false;
      setPlaybackStatus('finished');
      return;
    }

    // When playing a single sign, stop immediately after playing once (NO loop)
    if (!isSequenceModeRef.current) {
      isPlayingRef.current = false;
      setPlaybackStatus('finished');
      return;
    }

    const currentIndex = currentQueueIndexRef.current;
    if (lastFinishedIndexRef.current === currentIndex) {
      return;
    }
    lastFinishedIndexRef.current = currentIndex;

    const queue = signQueueRef.current;
    const nextIndex = currentIndex + 1;

    if (nextIndex < queue.length) {
      // Step to the next sign in the ISL sequence with tight 50ms transition for continuous flow
      playbackTimerRef.current = setTimeout(() => {
        playSignAtIndex(nextIndex, queue, true);
      }, 50);
    } else {
      // End of sentence sequence reached: stop cleanly, do NOT loop
      isSequenceModeRef.current = false;
      isPlayingRef.current = false;
      setPlaybackStatus('finished');
    }
  }, [playSignAtIndex]);

  const handleError = useCallback((message: string) => {
    setPlaybackStatus('error');
    setErrorMessage(message);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    // CWASA bridge status updates
  }, []);

  const handleStop = useCallback(() => {
    isContinuousSequenceRef.current = false;
    isSequenceModeRef.current = false;
    isPlayingRef.current = false;
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    avatarRef.current?.stop();
    setPlaybackStatus('idle');
  }, []);

  const handleReplay = useCallback(() => {
    const queue = signQueueRef.current.length > 0 ? signQueueRef.current : INITIAL_DEMO_SIGNS;
    if (processingModeRef.current === 'sentence' && queue.length > 1) {
      startSentencePlayback(queue, 0);
    } else if (queue.length > 0) {
      const startIndex = currentQueueIndexRef.current >= queue.length - 1 ? 0 : currentQueueIndexRef.current;
      playSingleSign(startIndex, queue);
    } else if (currentWord) {
      const result = lookupWord(currentWord);
      if (result.found && result.url) {
        setPlaybackStatus('loading');
        isContinuousSequenceRef.current = false;
        isSequenceModeRef.current = false;
        isPlayingRef.current = true;
        avatarRef.current?.play(result.url, result.word);
      }
    }
  }, [currentWord, playSingleSign, startSentencePlayback]);

  const handleNextQueue = useCallback(() => {
    const queue = signQueueRef.current.length > 0 ? signQueueRef.current : INITIAL_DEMO_SIGNS;
    if (currentQueueIndexRef.current < queue.length - 1) {
      playSingleSign(currentQueueIndexRef.current + 1, queue);
    }
  }, [playSingleSign]);

  const handlePreviousQueue = useCallback(() => {
    const queue = signQueueRef.current.length > 0 ? signQueueRef.current : INITIAL_DEMO_SIGNS;
    if (currentQueueIndexRef.current > 0) {
      playSingleSign(currentQueueIndexRef.current - 1, queue);
    }
  }, [playSingleSign]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    avatarRef.current?.setSpeed?.(speed);
  }, []);

  const handleResetCamera = useCallback(() => {
    avatarRef.current?.resetCamera?.();
  }, []);

  const handleClearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleRemoveHistoryItem = async (wordToRemove: string) => {
    const updated = searchHistory.filter(h => h.word !== wordToRemove);
    setSearchHistory(updated);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSelectHistoryItem = (query: string, isSentence: boolean) => {
    setProcessingMode(isSentence ? 'sentence' : 'word');
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleSuggestionPress = useCallback((word: string) => {
    setSearchQuery(word);
    setProcessingMode('word');
    handleSearch(word);
  }, [handleSearch]);

  // Transform raw gloss strings into rich GlossToken objects with semantic POS tags
  const richGlossTokens: GlossToken[] = rawGlossTokens.map((token, index) => {
    const isSubject = index === 0;
    const isTime = token.toUpperCase().includes('TODAY') || token.toUpperCase().includes('YESTERDAY') || token.toUpperCase().includes('NOW');
    const isNegation = token.toUpperCase().includes('NOT') || token.toUpperCase().includes('NO');
    const tag = isTime ? 'TIME' : isNegation ? 'NEGATION' : isSubject ? 'TOPIC' : 'ACTION';
    return {
      word: token,
      text: token,
      tag,
      active: index === currentQueueIndex && playbackStatus === 'playing',
    };
  });

  // Transform search history into SearchHistoryItem format for HistorySheet
  const formattedHistory: SearchHistoryItem[] = searchHistory.map(item => ({
    id: `${item.word}-${item.timestamp}`,
    query: item.word,
    timestamp: item.timestamp,
    isSentence: item.word.trim().includes(' '),
    foundCount: item.found ? 1 : 0,
  }));

  const getStatusBeacon = (): { label: string; variant: 'emerald' | 'amber' | 'ruby' | 'cyan' | 'default' | 'neutral' } => {
    if (isProcessing) return { label: 'PARSING ISL GRAMMAR', variant: 'cyan' };
    if (playbackStatus === 'playing') return { label: `SIGNING: ${currentWord || ''}`, variant: 'emerald' };
    if (playbackStatus === 'loading') return { label: 'BUFFERING ANIMATION', variant: 'amber' };
    if (playbackStatus === 'error') return { label: 'ERROR', variant: 'ruby' };
    if (playbackStatus === 'finished') return { label: 'COMPLETED', variant: 'emerald' };
    return { label: isAvatarReady ? 'ENGINE READY' : 'INITIALIZING CWASA', variant: isAvatarReady ? 'emerald' : 'neutral' };
  };

  const statusBeacon = getStatusBeacon();

  if (isCameraActive) {
    return (
      <CameraTranslateScreen
        onBack={() => setIsCameraActive(false)}
        onSignRecognized={(text) => {
          // Strictly ignore uncertain or failed recognitions
          if (!text || text === 'UNCLEAR SIGN SEQUENCE' || text.toUpperCase().includes('UNCLEAR')) {
            return;
          }
          setIsCameraActive(false);
          setSearchQuery(text);
          handleSearch(text);
        }}
      />
    );
  }

  // DESKTOP / TABLET SPLIT-SCREEN LAYOUT
  if (responsive.isDesktop || responsive.isTablet) {
    const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5];
    const currentSignWord =
      signQueue[currentQueueIndex]?.word?.toUpperCase() ||
      currentWord?.toUpperCase() ||
      (signQueue[0]?.word?.toUpperCase() ?? 'WHO');

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#050A12" />

        {/* Minimal Desktop Header */}
        <Header
          ctaLabel="Sign to English Conversion"
          signsCount={getWordCount()}
          showHistoryButton={false}
          onOpenHistory={() => setIsHistorySheetOpen(true)}
          onOpenLiveCamera={() => setIsCameraActive(true)}
          historyCount={searchHistory.length}
        />

        <View style={styles.desktopLayoutContainer}>
          {/* Left Column: Avatar Workspace & Playback Controls */}
          <View style={styles.desktopLeftColumn}>
            {/* 1. Avatar Viewing Panel */}
            <View style={styles.desktopAvatarPanel}>
              <AvatarWebView
                ref={avatarRef}
                avatar={selectedAvatar}
                onReady={handleAvatarReady}
                onPlaying={handlePlaying}
                onFinished={handleFinished}
                onError={handleError}
                onStatusChange={handleStatusChange}
                onAvatarChange={(av) => setSelectedAvatar(av as AvatarName)}
              />

              {/* Bottom-Left: Live Camera Indicator */}
              <TouchableOpacity
                style={styles.desktopLiveCameraChip}
                onPress={() => setIsCameraActive(true)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Open Live Camera"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <View style={styles.desktopLiveCameraDot} />
                <Text style={styles.desktopLiveCameraText}>Live Camera</Text>
              </TouchableOpacity>
            </View>

            {/* 2. Playback Controls Panel immediately beneath avatar viewer */}
            <View style={styles.desktopPlaybackPanel}>
              {/* Left: Current Sign info */}
              <View style={styles.desktopCurrentSignCol}>
                <Text style={styles.desktopCurrentSignLabel}>Current Sign</Text>
                <Text style={styles.desktopCurrentSignWord} numberOfLines={1}>
                  {currentSignWord}
                </Text>
              </View>

              {/* Center: Playback Buttons */}
              <View style={styles.desktopPlaybackControlsRow}>
                {/* Previous Sign */}
                <TouchableOpacity
                  style={styles.desktopNavBtn}
                  onPress={handlePreviousQueue}
                  disabled={currentQueueIndex <= 0}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Previous Sign"
                >
                  <PreviousSignIcon size={18} color={currentQueueIndex <= 0 ? '#475569' : '#FFFFFF'} />
                </TouchableOpacity>

                {/* Play/Pause */}
                <TouchableOpacity
                  style={[
                    styles.desktopPlayPauseBtn,
                    (playbackStatus === 'loading' || isProcessing) && styles.desktopPlayPauseBtnLoading,
                  ]}
                  onPress={() => {
                    if (playbackStatus === 'playing') {
                      handleStop();
                    } else {
                      handleReplay();
                    }
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={playbackStatus === 'playing' ? 'Pause' : 'Play'}
                >
                  {playbackStatus === 'loading' || isProcessing ? (
                    <ActivityIndicator size="small" color="#050A12" />
                  ) : playbackStatus === 'playing' ? (
                    <PauseIcon size={18} color="#050A12" />
                  ) : (
                    <PlayIcon size={20} color="#050A12" />
                  )}
                </TouchableOpacity>

                {/* Next Sign */}
                <TouchableOpacity
                  style={styles.desktopNavBtn}
                  onPress={handleNextQueue}
                  disabled={currentQueueIndex >= signQueue.length - 1}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Next Sign"
                >
                  <NextSignIcon size={18} color={currentQueueIndex >= signQueue.length - 1 ? '#475569' : '#FFFFFF'} />
                </TouchableOpacity>
              </View>

              {/* Right: Character Selector */}
              <View style={styles.desktopSpeedCol}>
                <Text style={styles.desktopSpeedLabel}>Character</Text>
                <TouchableOpacity
                  style={styles.desktopSpeedSelector}
                  onPress={() => {
                    const nextIdx = (AVATAR_OPTIONS.indexOf(selectedAvatar) + 1) % AVATAR_OPTIONS.length;
                    handleSelectAvatar(AVATAR_OPTIONS[nextIdx]);
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Change character. Currently ${selectedAvatar}`}
                >
                  <Text style={[styles.desktopSpeedText, { textTransform: 'capitalize' }]}>{selectedAvatar}</Text>
                  <ChevronDownIcon size={12} color="#8E9CAE" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Right Column: 3 Stacked Cards */}
          <View style={styles.desktopRightColumn}>
            {/* Card 1: Enter Sign Sequence */}
            <View style={styles.desktopCard}>
              <Text style={styles.desktopCardTitle}>Enter Sign Sequence</Text>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={(text, lang) => handleSearch(text, lang as any)}
                isLoading={playbackStatus === 'loading' || isProcessing}
                disabled={!isAvatarReady}
                isSentenceMode={processingMode === 'sentence'}
                placeholder="Type in English, Hindi, or Marathi (e.g. who are you, aap kaise ho, तुम्ही कसे आहात)..."
                dropdownPosition="bottom"
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
              />
            </View>

            {/* Card 2: ISL Sign Sequence */}
            <View style={styles.desktopCard}>
              <View style={styles.desktopCardHeaderRow}>
                <Text style={styles.desktopCardTitle}>ISL Sign Sequence</Text>
                <Text style={styles.desktopSignCountText}>
                  {(() => {
                    const count = signQueue.length > 0 ? signQueue.length : INITIAL_DEMO_SIGNS.length;
                    return `${count} ${count === 1 ? 'sign' : 'signs'}`;
                  })()}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.desktopSignTilesRow}
              >
                {(signQueue.length > 0 ? signQueue : INITIAL_DEMO_SIGNS).map((item, index, arr) => {
                  const isTileActive = (playbackStatus === 'playing' || playbackStatus === 'loading') && currentQueueIndex === index;
                  return (
                    <TouchableOpacity
                      key={`${item.word}-${index}`}
                      style={[
                        styles.desktopSignTile,
                        isTileActive && styles.desktopSignTileActive,
                        arr.length === 1 && { flex: 0, minWidth: 160 },
                      ]}
                      onPress={() => {
                        const queue = signQueueRef.current.length > 0 ? signQueueRef.current : INITIAL_DEMO_SIGNS;
                        playSingleSign(index, queue);
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Sign ${index + 1}: ${item.word}`}
                    >
                      <View style={[styles.desktopTileBadge, isTileActive && styles.desktopTileBadgeActive]}>
                        <Text style={[styles.desktopTileBadgeText, isTileActive && styles.desktopTileBadgeTextActive]}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text
                        style={[styles.desktopTileWord, isTileActive && styles.desktopTileWordActive]}
                        numberOfLines={1}
                      >
                        {item.word.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Card 3: Recent Translations */}
            <View style={styles.desktopCard}>
              <View style={styles.desktopCardHeaderRow}>
                <Text style={styles.desktopCardTitle}>Recent Translations</Text>
                <TouchableOpacity
                  onPress={() => setIsHistorySheetOpen(true)}
                  style={styles.desktopViewAllBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="View all recent translations"
                >
                  <Text style={styles.desktopViewAllText}>View all</Text>
                  <ArrowRightIcon size={12} color="#38BDF8" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>

              {/* Rows */}
              {(searchHistory.length > 0 ? searchHistory.slice(0, 2) : INITIAL_DEMO_HISTORY).map((item, index) => (
                <React.Fragment key={`${item.word}-${item.timestamp}-${index}`}>
                  {index > 0 && <View style={styles.desktopRecentDivider} />}
                  <View style={styles.desktopRecentRow}>
                    <View style={styles.desktopRecentClockCircle}>
                      <ClockIcon size={18} color="#8E9CAE" />
                    </View>

                    <TouchableOpacity
                      style={styles.desktopRecentTextContainer}
                      onPress={() => handleSelectHistoryItem(item.word, item.word.trim().includes(' '))}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Select recent translation: ${item.word}`}
                    >
                      <Text style={styles.desktopRecentQueryText} numberOfLines={1}>
                        {item.word}
                      </Text>
                      <Text style={styles.desktopRecentMetaText}>
                        {formatRecentMeta(item)}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.desktopRecentPlayBtn}
                      onPress={() => handleSelectHistoryItem(item.word, item.word.trim().includes(' '))}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${item.word}`}
                    >
                      <PlayIcon size={14} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSelectHistoryItem(item.word, item.word.trim().includes(' '))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ChevronRightIcon size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        <HistorySheet
          visible={isHistorySheetOpen}
          onClose={() => setIsHistorySheetOpen(false)}
          history={formattedHistory}
          onSelectQuery={handleSelectHistoryItem}
          onClearHistory={handleClearHistory}
          onRemoveItem={(id) => {
            const word = id.split('-')[0];
            handleRemoveHistoryItem(word);
          }}
        />

        <AvatarSelectSheet
          visible={isAvatarSheetOpen}
          selectedAvatar={selectedAvatar}
          onSelectAvatar={handleSelectAvatar}
          onClose={() => setIsAvatarSheetOpen(false)}
        />
      </SafeAreaView>
    );
  }

  // MOBILE REFERENCE DESIGN LAYOUT
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.canvas} />

      {/* Top App Header */}
      <Header
        signsCount={getWordCount()}
        showHistoryButton={false}
        onOpenHistory={() => setIsHistorySheetOpen(true)}
        onOpenLiveCamera={() => setIsCameraActive(true)}
        onOpenSettings={() => setIsAvatarSheetOpen(true)}
        historyCount={searchHistory.length}
      />

      <ScrollView
        style={styles.mobileScrollView}
        contentContainerStyle={styles.mobileScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bar: directly below header and ABOVE avatar */}
        <View style={styles.mobileComposerWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={(text, lang) => handleSearch(text, lang as any)}
            isLoading={playbackStatus === 'loading' || isProcessing}
            disabled={!isAvatarReady}
            isSentenceMode={processingMode === 'sentence'}
            placeholder="Type in English, Hindi, or Marathi..."
            dropdownPosition="bottom"
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
          />
        </View>

        {/* 3D Avatar Stage: large vertically-oriented viewing area */}
        <View style={styles.mobileStageContainer}>
          <AvatarWebView
            ref={avatarRef}
            avatar={selectedAvatar}
            onReady={handleAvatarReady}
            onPlaying={handlePlaying}
            onFinished={handleFinished}
            onError={handleError}
            onStatusChange={handleStatusChange}
            onAvatarChange={(av) => setSelectedAvatar(av as AvatarName)}
          />

          {/* Top-Right Control: Character Switch Button (replaces former fullscreen button) */}
          <TouchableOpacity
            style={styles.avatarTopRightBtn}
            onPress={() => setIsAvatarSheetOpen(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Switch character"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CharacterSwitchIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Bottom-Left Control: Live Camera Indicator Chip */}
          <TouchableOpacity
            style={styles.liveCameraChip}
            onPress={() => setIsCameraActive(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Open live camera"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View style={styles.liveCameraDot} />
            <Text style={styles.liveCameraText}>Live Camera</Text>
          </TouchableOpacity>
        </View>

        {/* ISL Sign Sequence Section: immediately below avatar viewer */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>ISL Sign Sequence</Text>
            <Text style={styles.sectionCountText}>
              {(() => {
                const count = signQueue.length > 0 ? signQueue.length : INITIAL_DEMO_SIGNS.length;
                return `${count} ${count === 1 ? 'sign' : 'signs'}`;
              })()}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.signSequenceRow}
          >
            {(signQueue.length > 0 ? signQueue : INITIAL_DEMO_SIGNS).map((item, index, arr) => {
              const isCardActive = (playbackStatus === 'playing' || playbackStatus === 'loading') && currentQueueIndex === index;
              return (
                <TouchableOpacity
                  key={`${item.word}-${index}`}
                  style={[
                    styles.signCard,
                    isCardActive && styles.signCardActive,
                    arr.length === 1 && { flex: 0, minWidth: 140 },
                  ]}
                  onPress={() => {
                    const queue = signQueueRef.current.length > 0 ? signQueueRef.current : INITIAL_DEMO_SIGNS;
                    playSingleSign(index, queue);
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Sign ${index + 1}: ${item.word}`}
                >
                  <View style={[styles.signCardBadge, isCardActive && styles.signCardBadgeActive]}>
                    <Text style={[styles.signCardBadgeText, isCardActive && styles.signCardBadgeTextActive]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.signCardWord, isCardActive && styles.signCardWordActive]} numberOfLines={1}>
                    {item.word.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Recent Translations Section: replaces old bottom playback control area */}
        <View style={[styles.sectionCard, styles.recentSectionCard]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity
              onPress={() => setIsHistorySheetOpen(true)}
              style={styles.viewAllBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="View all recent translations"
            >
              <Text style={styles.mobileViewAllText}>View all</Text>
              <ArrowRightIcon size={12} color="#38BDF8" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {(searchHistory.length > 0 ? searchHistory.slice(0, 2) : INITIAL_DEMO_HISTORY).map((item, index) => (
            <React.Fragment key={`${item.word}-${item.timestamp}-${index}`}>
              {index > 0 && <View style={styles.recentDivider} />}
              <TouchableOpacity
                style={styles.mobileRecentItemRow}
                onPress={() => handleSelectHistoryItem(item.word, item.word.trim().includes(' '))}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Translate recent phrase: ${item.word}`}
              >
                <View style={styles.recentClockCircle}>
                  <ClockIcon size={16} color="#94A3B8" />
                </View>

                <View style={styles.recentTextContainer}>
                  <Text style={styles.recentQueryText} numberOfLines={1}>
                    {item.word}
                  </Text>
                  <Text style={styles.recentMetaText}>
                    {formatRecentMeta(item)}
                  </Text>
                </View>

                <ChevronRightIcon size={16} color="#64748B" />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      {/* Search History Bottom Sheet */}
      <HistorySheet
        visible={isHistorySheetOpen}
        onClose={() => setIsHistorySheetOpen(false)}
        history={formattedHistory}
        onSelectQuery={handleSelectHistoryItem}
        onClearHistory={handleClearHistory}
        onRemoveItem={(id) => {
          const word = id.split('-')[0];
          handleRemoveHistoryItem(word);
        }}
      />

      {/* Avatar Selection Bottom Sheet */}
      <AvatarSelectSheet
        visible={isAvatarSheetOpen}
        selectedAvatar={selectedAvatar}
        onSelectAvatar={handleSelectAvatar}
        onClose={() => setIsAvatarSheetOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  // Desktop Layout Styles
  desktopLayoutContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },
  desktopLeftColumn: {
    flex: 1.15,
    flexDirection: 'column',
    height: '100%',
  },
  desktopAvatarPanel: {
    flex: 1,
    minHeight: 460,
    backgroundColor: '#09111E',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#162337',
  },
  desktopLiveCameraChip: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 18, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADII.full,
    zIndex: 20,
  },
  desktopLiveCameraDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00D6A5',
    marginRight: 8,
  },
  desktopLiveCameraText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  desktopPlaybackPanel: {
    marginTop: 16,
    backgroundColor: '#0B1422',
    borderWidth: 1,
    borderColor: '#162337',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desktopCurrentSignCol: {
    flex: 1,
    justifyContent: 'center',
  },
  desktopCurrentSignLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  desktopCurrentSignWord: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  desktopPlaybackControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  desktopNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101B2B',
  },
  desktopPlayPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopPlayPauseBtnLoading: {
    opacity: 0.75,
  },
  desktopSpeedCol: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  desktopSpeedLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  desktopSpeedSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#101B2B',
  },
  desktopSpeedText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  desktopRightColumn: {
    flex: 0.85,
    flexDirection: 'column',
    gap: 16,
  },
  desktopCard: {
    backgroundColor: '#08101C',
    borderWidth: 1,
    borderColor: '#162337',
    borderRadius: 20,
    padding: 20,
  },
  desktopCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  desktopCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  desktopSignCountText: {
    fontSize: 14,
    color: '#64748B',
  },
  desktopSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1726',
    borderWidth: 1,
    borderColor: '#1D2D42',
    borderRadius: RADII.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
    height: 52,
  },
  desktopSearchTextInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    paddingHorizontal: 12,
  },
  desktopSubmitCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopSubmitCircleBtnLoading: {
    opacity: 0.75,
  },
  desktopSignTilesRow: {
    flexDirection: 'row',
    gap: 12,
    minWidth: '100%',
    paddingBottom: 4,
  },
  desktopSignTile: {
    flex: 1,
    minWidth: 104,
    backgroundColor: '#0E1726',
    borderWidth: 1,
    borderColor: '#1D2D42',
    borderRadius: 14,
    padding: 14,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  desktopSignTileActive: {
    borderColor: '#06B6D4',
    backgroundColor: '#112238',
  },
  desktopTileBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16253A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopTileBadgeActive: {
    backgroundColor: '#06B6D4',
  },
  desktopTileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  desktopTileBadgeTextActive: {
    color: '#FFFFFF',
  },
  desktopTileWord: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 14,
  },
  desktopTileWordActive: {
    color: '#38BDF8',
  },
  desktopViewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopViewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#38BDF8',
  },
  desktopRecentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  desktopRecentClockCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0E1726',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  desktopRecentTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  desktopRecentQueryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F8FAFC',
  },
  desktopRecentMetaText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  desktopRecentPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#132135',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  desktopRecentDivider: {
    height: 1,
    backgroundColor: '#132135',
    marginVertical: 4,
  },

  // Mobile Styles
  mobileScrollView: {
    flex: 1,
    backgroundColor: '#050A12',
  },
  mobileScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  mobileComposerWrapper: {
    width: '100%',
    marginBottom: 14,
    zIndex: 100,
  },
  mobileStageContainer: {
    width: '100%',
    height: 420,
    backgroundColor: '#0A1220',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#182436',
    marginBottom: 14,
  },
  avatarTopRightBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  liveCameraChip: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 18, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADII.full,
    zIndex: 20,
  },
  liveCameraDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00D6A5',
    marginRight: 6,
  },
  liveCameraText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#070D18',
    borderWidth: 1,
    borderColor: '#162234',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  sectionCountText: {
    fontSize: 14,
    color: '#64748B',
  },
  signSequenceRow: {
    flexDirection: 'row',
    gap: 10,
    minWidth: '100%',
    paddingBottom: 4,
  },
  signCard: {
    flex: 1,
    minWidth: 92,
    backgroundColor: '#0F1827',
    borderWidth: 1,
    borderColor: '#1D2B3E',
    borderRadius: 14,
    padding: 14,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  signCardActive: {
    borderColor: '#06B6D4',
    backgroundColor: '#112035',
  },
  signCardBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#162438',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signCardBadgeActive: {
    backgroundColor: '#06B6D4',
  },
  signCardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  signCardBadgeTextActive: {
    color: '#FFFFFF',
  },
  signCardWord: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 14,
  },
  signCardWordActive: {
    color: '#38BDF8',
  },
  recentSectionCard: {
    marginBottom: 16,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileViewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#38BDF8',
  },
  mobileRecentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  recentClockCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#101B2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  recentQueryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F8FAFC',
  },
  recentMetaText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  recentDivider: {
    height: 1,
    backgroundColor: '#121C2B',
    marginVertical: 4,
  },
});

export default HomeScreen;
