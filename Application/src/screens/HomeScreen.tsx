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

const HISTORY_STORAGE_KEY = '@signvision_history';
const AVATAR_STORAGE_KEY = '@signvision_selected_avatar';
const MAX_HISTORY_ITEMS = 30;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarName>('luna');
  const [isAvatarSheetOpen, setIsAvatarSheetOpen] = useState(false);

  // Sentence processing state
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('word');
  const [signQueue, setSignQueue] = useState<SignQueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawGlossTokens, setRawGlossTokens] = useState<string[]>([]);
  const [translatedSentence, setTranslatedSentence] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const avatarRef = useRef<AvatarWebViewRef>(null);

  // Refs to avoid stale closures in event listeners
  const signQueueRef = useRef<SignQueueItem[]>([]);
  const currentQueueIndexRef = useRef(0);
  const processingModeRef = useRef<ProcessingMode>('word');
  const playbackSessionRef = useRef<number>(0);
  const pendingSentenceRef = useRef<{ queue: SignQueueItem[]; startIndex: number } | null>(null);

  useEffect(() => { signQueueRef.current = signQueue; }, [signQueue]);
  useEffect(() => { currentQueueIndexRef.current = currentQueueIndex; }, [currentQueueIndex]);
  useEffect(() => { processingModeRef.current = processingMode; }, [processingMode]);

  useEffect(() => {
    loadHistory();
    loadAvatarPreference();
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

  const startSentencePlayback = useCallback(async (queue: SignQueueItem[], startIndex = 0) => {
    if (!queue || queue.length === 0 || startIndex >= queue.length) return;

    const sessionId = ++playbackSessionRef.current;
    setCurrentQueueIndex(startIndex);
    setCurrentWord(queue[startIndex].word);
    setPlaybackStatus('loading');

    if (!isAvatarReady) {
      pendingSentenceRef.current = { queue, startIndex };
      return;
    }

    try {
      const compileTarget = queue.slice(startIndex);
      const compiled = await compileSentenceSiGML(compileTarget);

      // Discard stale response if a newer action occurred
      if (playbackSessionRef.current !== sessionId) return;

      if (compiled && compiled.combinedSigml) {
        avatarRef.current?.playSequence?.(
          compiled.combinedSigml,
          compiled.validSigns.map(s => s.word),
          startIndex
        );
      } else {
        // Fallback: instruct WebView to fetch & compile from URLs
        avatarRef.current?.playSequenceUrls?.(
          compileTarget.map(s => s.url),
          compileTarget.map(s => s.word),
          startIndex
        );
      }
    } catch (err) {
      console.error('[startSentencePlayback] Error initiating sequence playback:', err);
      if (playbackSessionRef.current === sessionId) {
        setPlaybackStatus('error');
        setErrorMessage('Failed to start sentence playback');
      }
    }
  }, [isAvatarReady]);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const saveToHistory = async (word: string, found: boolean) => {
    try {
      const newItem: HistoryItem = { word, timestamp: Date.now(), found };
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
    setSignQueue([]);
    setCurrentQueueIndex(0);
    setRawGlossTokens([]);
    setTranslatedSentence(null);
    setErrorMessage(null);
    setSuggestions([]);
  };

  const handleSearch = useCallback(async (input: string) => {
    if (!input.trim()) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    avatarRef.current?.stop();
    resetPlaybackState();

    if (processingMode === 'sentence') {
      setIsProcessing(true);
      setPlaybackStatus('loading');

      try {
        const response = await processSentence(input);

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
          setCurrentQueueIndex(0);
          saveToHistory(input, true);
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
        saveToHistory(result.word, true);
        avatarRef.current?.play(result.url, result.word);
      } else {
        setPlaybackStatus('error');
        setErrorMessage(`"${input}" not found in dictionary`);
        setSuggestions(result.suggestions || []);
        saveToHistory(input, false);
      }
    }
  }, [searchHistory, processingMode, startSentencePlayback]);

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
    if (typeof signIndex === 'number' && signIndex >= 0) {
      setCurrentQueueIndex(signIndex);
    }
  }, []);

  const handleFinished = useCallback((word: string) => {
    setPlaybackStatus('finished');
  }, []);

  const handleError = useCallback((message: string) => {
    setPlaybackStatus('error');
    setErrorMessage(message);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    // CWASA bridge status updates
  }, []);

  const handleStop = useCallback(() => {
    playbackSessionRef.current++;
    pendingSentenceRef.current = null;
    avatarRef.current?.stop();
    setPlaybackStatus('idle');
  }, []);

  const handleReplay = useCallback(() => {
    if (processingMode === 'sentence' && signQueue.length > 0) {
      startSentencePlayback(signQueue, 0);
    } else if (currentWord) {
      const result = lookupWord(currentWord);
      if (result.found && result.url) {
        setPlaybackStatus('loading');
        avatarRef.current?.play(result.url, result.word);
      }
    }
  }, [processingMode, signQueue, currentWord, startSentencePlayback]);

  const handleNextQueue = useCallback(() => {
    if (currentQueueIndex < signQueue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      startSentencePlayback(signQueue, nextIndex);
    }
  }, [currentQueueIndex, signQueue, startSentencePlayback]);

  const handlePreviousQueue = useCallback(() => {
    if (currentQueueIndex > 0) {
      const prevIndex = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIndex);
      startSentencePlayback(signQueue, prevIndex);
    }
  }, [currentQueueIndex, signQueue, startSentencePlayback]);

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
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.canvas} />

        <Header
          signsCount={getWordCount()}
          onOpenHistory={() => setIsHistorySheetOpen(true)}
          onOpenLiveCamera={() => setIsCameraActive(true)}
          historyCount={searchHistory.length}
        />

        <View style={styles.desktopSplitLayout}>
          {/* Left: 3D Stage Console */}
          <View style={styles.desktopStagePane}>
            <Card variant="glass" glowColor="cyan" style={styles.stageCard}>
              <View style={styles.stageTopOverlay}>
                <Badge
                  label={statusBeacon.label}
                  variant={statusBeacon.variant}
                  pulse={playbackStatus === 'playing' || isProcessing}
                />
                <View style={styles.stageControlsRow}>
                  {/* Speed buttons */}
                  {[0.75, 1.0, 1.5].map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      onPress={() => handleSpeedChange(speed)}
                      style={[
                        styles.speedChip,
                        playbackSpeed === speed && styles.speedChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.speedChipText,
                          playbackSpeed === speed && styles.speedChipTextActive,
                        ]}
                      >
                        {speed}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={handleResetCamera}
                    style={styles.cameraResetBtn}
                    accessibilityLabel="Reset 3D camera angle"
                  >
                    <Text style={styles.cameraResetText}>🎯 Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsAvatarSheetOpen(true)}
                    style={styles.desktopAvatarToggleBtn}
                    accessibilityLabel={`Current avatar: ${selectedAvatar}. Tap to change character.`}
                  >
                    <Text style={styles.desktopAvatarToggleText}>
                      {AVATAR_LABELS[selectedAvatar] || 'Avatar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.desktopAvatarContainer}>
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
              </View>

              {/* Playback Controls inside stage */}
              <View style={styles.stageBottomControls}>
                <PlaybackQueueBar
                  currentIndex={currentQueueIndex}
                  totalCount={signQueue.length > 0 ? signQueue.length : (currentWord ? 1 : 0)}
                  currentWord={currentWord ?? undefined}
                  isPlaying={playbackStatus === 'playing'}
                  isBuffering={playbackStatus === 'loading' || isProcessing}
                  onPlayPause={() => {
                    if (playbackStatus === 'playing') {
                      handleStop();
                    } else {
                      handleReplay();
                    }
                  }}
                  onReplay={handleReplay}
                  onNext={handleNextQueue}
                  onPrevious={handlePreviousQueue}
                  playbackSpeed={playbackSpeed}
                  onSpeedChange={handleSpeedChange}
                  onResetCamera={handleResetCamera}
                />
              </View>
            </Card>
          </View>

          {/* Right: Linguistic & Input Control Console */}
          <ScrollView
            style={styles.desktopControlPane}
            contentContainerStyle={styles.desktopControlContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.paneSection}>
              <Text style={styles.sectionHeader}>TRANSLATION MODE</Text>
              <ModeSelector
                mode={processingMode}
                onModeChange={(mode) => {
                  setProcessingMode(mode);
                  resetPlaybackState();
                }}
              />
            </View>

            <View style={styles.paneSection}>
              <Text style={styles.sectionHeader}>INPUT PHRASE OR WORD</Text>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={handleSearch}
                isLoading={playbackStatus === 'loading' || isProcessing}
                disabled={!isAvatarReady}
                isSentenceMode={processingMode === 'sentence'}
                placeholder={processingMode === 'sentence' ? 'Type an English sentence (e.g. "What is your name?")...' : 'Search a single word (e.g. "Hello")...'}
              />
            </View>

            {/* Error Card */}
            {errorMessage && (
              <Card variant="glass" glowColor="ruby" style={styles.errorCard}>
                <Text style={styles.errorTitle}>Translation Notice</Text>
                <Text style={styles.errorBody}>{errorMessage}</Text>
              </Card>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.paneSection}>
                <Text style={styles.sectionHeader}>DID YOU MEAN?</Text>
                <View style={styles.suggestionRow}>
                  {suggestions.map((word) => (
                    <TouchableOpacity
                      key={word}
                      style={styles.suggestionPill}
                      onPress={() => handleSuggestionPress(word)}
                    >
                      <Text style={styles.suggestionPillText}>{word}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ISL Grammar Tokens */}
            {rawGlossTokens.length > 0 && (
              <View style={styles.paneSection}>
                <GlossTokenBar
                  tokens={richGlossTokens}
                  originalSentence={translatedSentence ? `${searchQuery} → ${translatedSentence}` : searchQuery}
                />
              </View>
            )}

            {/* Quick History Drawer Section */}
            <View style={styles.paneSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionHeader}>RECENT TRANSLATIONS</Text>
                {searchHistory.length > 0 && (
                  <TouchableOpacity onPress={() => setIsHistorySheetOpen(true)}>
                    <Text style={styles.viewAllText}>View All ({searchHistory.length})</Text>
                  </TouchableOpacity>
                )}
              </View>

              {searchHistory.slice(0, 5).map((item) => (
                <TouchableOpacity
                  key={`${item.word}-${item.timestamp}`}
                  style={styles.recentItemRow}
                  onPress={() => handleSelectHistoryItem(item.word, item.word.trim().includes(' '))}
                >
                  <Text style={styles.recentItemWord}>{item.word}</Text>
                  <Badge
                    label={item.found ? 'FOUND' : 'MISSING'}
                    variant={item.found ? 'emerald' : 'ruby'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
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

      {/* Top Search & Mode Controls Section (Positioned near the top, above avatar) */}
      <View style={styles.mobileTopControlSection}>
        {/* Mode Selector Segmented Pill */}
        <View style={styles.mobileModeSelectorWrapper}>
          <ModeSelector
            compact={true}
            mode={processingMode}
            onModeChange={(mode) => {
              setProcessingMode(mode);
              resetPlaybackState();
            }}
          />
        </View>

        {/* Search Bar with Autocomplete Dropdown floating below */}
        <View style={styles.mobileComposerWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearch}
            isLoading={playbackStatus === 'loading' || isProcessing}
            disabled={!isAvatarReady}
            isSentenceMode={processingMode === 'sentence'}
            placeholder={
              processingMode === 'sentence'
                ? 'Type or speak a sentence...'
                : 'Search or speak a word...'
            }
            dropdownPosition="bottom"
          />
        </View>

        {/* Status and Secondary Controls Bar (ENGINE READY, Camera Target, Book) */}
        <View style={styles.mobileStatusControlsRow}>
          <View style={styles.mobileEngineStatus}>
            <View style={styles.mobileEngineDot} />
            <Text style={styles.mobileEngineText}>
              {isProcessing
                ? 'PROCESSING...'
                : playbackStatus === 'playing'
                ? (currentWord ? `SIGNING: ${currentWord.toUpperCase()}` : 'SIGNING...')
                : 'ENGINE READY'}
            </Text>
          </View>
          <View style={styles.mobileSecondaryActions}>
            <TouchableOpacity
              onPress={() => {
                const currentIndex = AVATAR_OPTIONS.indexOf(selectedAvatar);
                const nextAvatar = AVATAR_OPTIONS[(currentIndex + 1) % AVATAR_OPTIONS.length];
                handleSelectAvatar(nextAvatar);
              }}
              onLongPress={() => setIsAvatarSheetOpen(true)}
              style={styles.mobileAvatarToggleBtn}
              accessibilityLabel={`Current avatar: ${selectedAvatar}. Tap to cycle, long press for avatar details.`}
            >
              <Text style={styles.mobileAvatarToggleText}>
                {AVATAR_LABELS[selectedAvatar] || 'Avatar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleResetCamera}
              style={styles.mobileSecondaryIconBtn}
              accessibilityLabel="Reset 3D camera"
            >
              <Text style={styles.mobileSecondaryIconText}>🎯</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsHistorySheetOpen(true)}
              style={styles.mobileSecondaryIconBtn}
              accessibilityLabel="Open Sign Dictionary and History"
            >
              <Text style={styles.mobileSecondaryIconText}>📖</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3D Avatar Stage Directly Below Controls */}
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

        {/* Floating ISL Gloss Tokens Bar */}
        {rawGlossTokens.length > 0 && (
          <View style={styles.mobileGlossFloatingWrapper}>
            <GlossTokenBar
              tokens={richGlossTokens}
              originalSentence={translatedSentence ? `${searchQuery} → ${translatedSentence}` : searchQuery}
            />
          </View>
        )}

        {/* Suggestion Chips Overlay if word missing */}
        {suggestions.length > 0 && (
          <View style={styles.mobileSuggestionsContainer}>
            <Text style={styles.mobileSuggestHeader}>Did you mean?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mobileSuggestList}
            >
              {suggestions.map((word) => (
                <TouchableOpacity
                  key={word}
                  style={styles.suggestionPill}
                  onPress={() => handleSuggestionPress(word)}
                >
                  <Text style={styles.suggestionPillText}>{word}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Polished Bottom-Anchored Recent History Panel */}
      <View style={styles.mobileRecentBottomPanel}>
        <View style={styles.mobileDragHandle} />
        <View style={styles.mobileRecentHeaderRow}>
          <View style={styles.mobileRecentTitleGroup}>
            <Text style={styles.mobileRecentClockIcon}>⏱</Text>
            <Text style={styles.mobileRecentHeaderText}>RECENT</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsHistorySheetOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="See all search history"
          >
            <Text style={styles.mobileSeeAllText}>See all ›</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileRecentChipsList}
        >
          {(searchHistory.length > 0
            ? searchHistory.slice(0, 8).map(h => ({ text: h.word, isSentence: h.word.includes(' ') }))
            : [
                { text: 'Hello', isSentence: false },
                { text: 'Thank you', isSentence: false },
                { text: 'How are you?', isSentence: true },
                { text: 'Yes', isSentence: false },
              ]
          ).map((item, idx) => (
            <TouchableOpacity
              key={`${item.text}-${idx}`}
              style={styles.mobileRecentChip}
              onPress={() => handleSelectHistoryItem(item.text, item.isSentence)}
              accessibilityLabel={`Recent translation: ${item.text}`}
            >
              <Text style={styles.mobileChipClockIcon}>⏱</Text>
              <Text style={styles.mobileChipText}>{item.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
  // Desktop Split Styles
  desktopSplitLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  desktopStagePane: {
    flex: 1.2,
    height: '100%',
  },
  stageCard: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.stage,
    borderRadius: RADII.xl,
    overflow: 'hidden',
  },
  stageTopOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 10,
  },
  stageControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  speedChipActive: {
    backgroundColor: COLORS.emeraldMuted,
    borderColor: COLORS.emerald,
  },
  speedChipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  speedChipTextActive: {
    color: COLORS.emeraldLight,
  },
  cameraResetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  cameraResetText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  desktopAvatarToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.full,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  desktopAvatarToggleText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.cyanLight,
    fontWeight: '700',
  },
  desktopAvatarContainer: {
    flex: 1,
    borderRadius: RADII.lg,
    overflow: 'hidden',
  },
  stageBottomControls: {
    marginTop: 8,
  },
  desktopControlPane: {
    flex: 0.9,
    height: '100%',
  },
  desktopControlContent: {
    paddingBottom: 40,
    gap: 16,
  },
  paneSection: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  sectionHeader: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cyan,
    fontWeight: '600',
  },
  recentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  recentItemWord: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  errorCard: {
    padding: 12,
  },
  errorTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 14,
    color: COLORS.ruby,
    marginBottom: 4,
  },
  errorBody: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionPill: {
    backgroundColor: COLORS.emeraldMuted,
    borderWidth: 1,
    borderColor: COLORS.emerald,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.full,
  },
  suggestionPillText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.emeraldLight,
    fontWeight: '600',
  },

  // Mobile Styles
  mobileTopControlSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
    zIndex: 1000,
    elevation: 50,
    overflow: 'visible',
    backgroundColor: COLORS.canvas,
  },
  mobileModeSelectorWrapper: {
    alignSelf: 'center',
  },
  mobileComposerWrapper: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
    elevation: 50,
    overflow: 'visible',
  },
  mobileStatusControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 2,
  },
  mobileEngineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileEngineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00DF8F',
    marginRight: 8,
    shadowColor: '#00DF8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  mobileEngineText: {
    color: '#00DF8F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mobileSecondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileAvatarToggleBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAvatarToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.cyanLight,
  },
  mobileSecondaryIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileSecondaryIconText: {
    fontSize: 16,
  },
  mobileStageContainer: {
    flex: 1,
    backgroundColor: COLORS.stage,
    position: 'relative',
    overflow: 'hidden',
  },
  mobileGlossFloatingWrapper: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  mobileSuggestionsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: COLORS.panel,
    borderRadius: RADII.md,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    zIndex: 25,
    ...SHADOWS.card,
  },
  mobileSuggestHeader: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginBottom: 6,
  },
  mobileSuggestList: {
    gap: 8,
  },
  mobileRecentBottomPanel: {
    backgroundColor: '#080E17',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  mobileDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 10,
  },
  mobileRecentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mobileRecentTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileRecentClockIcon: {
    fontSize: 14,
    color: '#94A3B8',
  },
  mobileRecentHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  mobileSeeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00DF8F',
  },
  mobileRecentChipsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileRecentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1726',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  mobileChipClockIcon: {
    fontSize: 13,
    color: '#00DF8F',
  },
  mobileChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
});

export default HomeScreen;
