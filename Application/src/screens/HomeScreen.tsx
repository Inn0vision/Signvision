import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AvatarWebView, { AvatarWebViewRef } from '../components/AvatarWebView';
import SearchBar from '../components/SearchBar';
import { lookupWord, getWordCount } from '../services/s3Service';
import type { PlaybackStatus, HistoryItem } from '../types';

const HISTORY_STORAGE_KEY = '@signvision_history';
const MAX_HISTORY_ITEMS = 20;

const HomeScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const avatarRef = useRef<AvatarWebViewRef>(null);

  useEffect(() => {
    loadHistory();
  }, []);

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
      const filtered = searchHistory.filter(h => h.word !== word);
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setSearchHistory(updated);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const handleSearch = useCallback((word: string) => {
    if (!word.trim()) return;
    
    setErrorMessage(null);
    setSuggestions([]);
    setPlaybackStatus('loading');
    
    const result = lookupWord(word);
    
    if (result.found && result.url) {
      setCurrentWord(result.word);
      saveToHistory(result.word, true);
      avatarRef.current?.play(result.url, result.word);
    } else {
      setPlaybackStatus('error');
      setErrorMessage(`"${word}" not found`);
      setSuggestions(result.suggestions || []);
      saveToHistory(word, false);
    }
  }, [searchHistory]);

  const handleAvatarReady = useCallback(() => {
    setIsAvatarReady(true);
    setPlaybackStatus('idle');
  }, []);

  const handlePlaying = useCallback((word: string) => {
    setPlaybackStatus('playing');
    setCurrentWord(word);
  }, []);

  const handleFinished = useCallback((word: string) => {
    setPlaybackStatus('finished');
  }, []);

  const handleError = useCallback((message: string) => {
    setPlaybackStatus('error');
    setErrorMessage(message);
  }, []);

  const handleStop = useCallback(() => {
    avatarRef.current?.stop();
    setPlaybackStatus('idle');
  }, []);

  const handleHistoryPress = useCallback((item: HistoryItem) => {
    setSearchQuery(item.word);
    handleSearch(item.word);
  }, [handleSearch]);

  const handleSuggestionPress = useCallback((word: string) => {
    setSearchQuery(word);
    handleSearch(word);
  }, [handleSearch]);

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const getStatusText = () => {
    switch (playbackStatus) {
      case 'loading':
        return 'Loading...';
      case 'playing':
        return `Playing: ${currentWord}`;
      case 'finished':
        return `Finished: ${currentWord}`;
      case 'error':
        return errorMessage || 'Error';
      default:
        return isAvatarReady ? 'Ready' : 'Initializing...';
    }
  };

  const getStatusColor = () => {
    switch (playbackStatus) {
      case 'playing':
        return '#4CAF50';
      case 'error':
        return '#f44336';
      case 'loading':
        return '#FF9800';
      default:
        return '#888';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1e" />
      
      <View style={styles.header}>
        <Text style={styles.title}>SignVision</Text>
        <Text style={styles.subtitle}>{getWordCount().toLocaleString()} signs available</Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearch}
          isLoading={playbackStatus === 'loading'}
          disabled={!isAvatarReady}
        />
      </View>

      <View style={styles.avatarContainer}>
        <AvatarWebView
          ref={avatarRef}
          onReady={handleAvatarReady}
          onPlaying={handlePlaying}
          onFinished={handleFinished}
          onError={handleError}
        />
        
        <View style={styles.statusBar}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {playbackStatus === 'playing' && (
            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionTitle}>Did you mean?</Text>
          <View style={styles.suggestionChips}>
            {suggestions.map((word) => (
              <TouchableOpacity
                key={word}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(word)}
              >
                <Text style={styles.suggestionChipText}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          {searchHistory.length > 0 && (
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <FlatList
          data={searchHistory}
          keyExtractor={(item) => `${item.word}-${item.timestamp}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.historyItem,
                !item.found && styles.historyItemNotFound,
              ]}
              onPress={() => handleHistoryPress(item)}
            >
              <Text style={styles.historyItemText}>{item.word}</Text>
              {!item.found && <Text style={styles.notFoundBadge}>✕</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyHistoryText}>No recent searches</Text>
          }
          contentContainerStyle={styles.historyList}
        />
      </View>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 10,
  },
  avatarContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 10,
    maxHeight: width * 1.2,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  stopButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  suggestionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 10,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#2a2a4a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  suggestionChipText: {
    color: '#4CAF50',
    fontSize: 13,
  },
  historyContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  clearText: {
    color: '#f44336',
    fontSize: 13,
  },
  historyList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  historyItemNotFound: {
    backgroundColor: '#3a2a2a',
    borderWidth: 1,
    borderColor: '#f4433666',
  },
  historyItemText: {
    color: '#fff',
    fontSize: 13,
  },
  notFoundBadge: {
    color: '#f44336',
    marginLeft: 6,
    fontSize: 10,
  },
  emptyHistoryText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
});

export default HomeScreen;
