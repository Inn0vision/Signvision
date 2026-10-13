import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Keyboard,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import { Button } from './ui/Button';
import { autocomplete } from '../services/s3Service';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (word: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  isSentenceMode?: boolean;
  onToggleSentenceMode?: () => void;
  dropdownPosition?: 'top' | 'bottom';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search for a word or type a sentence...',
  isLoading = false,
  disabled = false,
  isSentenceMode = false,
  onToggleSentenceMode,
  dropdownPosition = 'bottom',
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const listenPulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for loading state
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLoading, pulseAnim]);

  // Pulse animation for listening state
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(listenPulseAnim, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(listenPulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      listenPulseAnim.setValue(1);
    }
  }, [isListening, listenPulseAnim]);

  // Helper to extract active word for recommendations
  const getActiveSearchTerm = useCallback((text: string, isSentence: boolean): string => {
    if (!isSentence) return text.trim();
    const tokens = text.split(/\s+/);
    return tokens[tokens.length - 1]?.trim() || '';
  }, []);

  // Autocomplete suggestions from database
  useEffect(() => {
    const term = getActiveSearchTerm(value, isSentenceMode);
    if (term.length >= 1) {
      const results = autocomplete(term, 6);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, isSentenceMode, getActiveSearchTerm]);

  const resolveSpeechLocale = useCallback(async () => {
    const fallbackLocale = 'en-US';

    try {
      const localesResult = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      const availableLocales = [
        ...(localesResult.installedLocales || []),
        ...(localesResult.locales || []),
      ];

      const preferredLocales = ['en-US', 'en-IN', 'en-GB'];
      const preferredMatch = preferredLocales.find((locale) => availableLocales.includes(locale));

      return preferredMatch || availableLocales[0] || fallbackLocale;
    } catch (error) {
      console.warn('Failed to fetch supported locales. Falling back to en-US.', error);
      return fallbackLocale;
    }
  }, []);

  const handleSpeechRecognition = useCallback(async () => {
    if (isListening) {
      try {
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
      } catch (error) {
        console.log('Stop speech error:', error);
      }
      return;
    }

    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        Alert.alert(
          'Speech Recognition Unavailable',
          'Speech recognition is not available on this device right now.'
        );
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to translate speech into sign language.',
          [{ text: 'OK' }]
        );
        return;
      }

      const locale = await resolveSpeechLocale();
      console.log('Using speech locale:', locale);

      setIsListening(true);
      Keyboard.dismiss();

      ExpoSpeechRecognitionModule.start({
        lang: locale || 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
      });
    } catch (error) {
      console.error('Speech recognition error:', error);
      setIsListening(false);
      Alert.alert('Error', 'Failed to start speech recognition. Please try again.');
    }
  }, [isListening, resolveSpeechLocale]);

  // Result listener
  useEffect(() => {
    const subscription = ExpoSpeechRecognitionModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.transcript?.trim();
      if (!transcript) return;

      onChangeText(transcript);

      if (event.isFinal) {
        setIsListening(false);
        onSubmit(transcript);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onChangeText, onSubmit]);

  // Start & end listeners
  useEffect(() => {
    const startSubscription = ExpoSpeechRecognitionModule.addListener('start', () => {
      setIsListening(true);
    });

    const endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
      setIsListening(false);
    });

    return () => {
      startSubscription.remove();
      endSubscription.remove();
    };
  }, []);

  // Error listener
  useEffect(() => {
    const errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech error:', event.error, event.message);
        Alert.alert('Speech Error', event.message || `Error: ${event.error}`);
      }
    });

    return () => {
      errorSubscription.remove();
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      Keyboard.dismiss();
      inputRef.current?.blur();
      setShowSuggestions(false);
      onSubmit(value.trim());
    }
  }, [value, onSubmit]);

  const handleSuggestionPress = useCallback((word: string) => {
    if (isSentenceMode) {
      // In sentence mode, replace current active token and append space for continued typing
      const tokens = value.split(/\s+/);
      tokens.pop();
      const prefix = tokens.length > 0 ? `${tokens.join(' ')} ` : '';
      const updatedText = `${prefix}${word} `;
      onChangeText(updatedText);
      setShowSuggestions(false);
      inputRef.current?.focus();
    } else {
      onChangeText(word);
      Keyboard.dismiss();
      inputRef.current?.blur();
      setShowSuggestions(false);
      onSubmit(word);
    }
  }, [value, isSentenceMode, onChangeText, onSubmit]);

  const handleClear = useCallback(() => {
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleFocus = useCallback(() => {
    const term = getActiveSearchTerm(value, isSentenceMode);
    if (term.length >= 1 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [value, isSentenceMode, suggestions, getActiveSearchTerm]);

  const handleBlur = useCallback(() => {
    // Delay hiding so taps on suggestions register
    setTimeout(() => setShowSuggestions(false), 250);
  }, []);

  const renderSuggestions = () => (
    showSuggestions && suggestions.length > 0 && (
      <View
        style={[
          styles.suggestionsContainer,
          dropdownPosition === 'bottom' && styles.suggestionsContainerBottom,
        ]}
      >
        <View style={styles.suggestionsHeader}>
          <Text style={styles.suggestionsHeaderIcon}>🗂️</Text>
          <Text style={styles.suggestionsHeaderText}>DICTIONARY SIGNS</Text>
          <Text style={styles.suggestionsCountText}>{suggestions.length} found</Text>
        </View>
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(item)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Autocomplete suggestion: ${item}`}
            >
              <View style={styles.suggestionItemLeft}>
                <View style={styles.suggestionBadge}>
                  <Text style={styles.suggestionBadgeText}>ISL</Text>
                </View>
                <Text style={styles.suggestionText}>{item}</Text>
              </View>
              <Text style={styles.suggestionActionText}>
                {isSentenceMode ? '+ Add' : 'Sign ›'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    )
  );

  return (
    <View style={styles.wrapper}>
      {/* Autocomplete Suggestions Popover (when position is top) */}
      {dropdownPosition === 'top' && renderSuggestions()}

      {/* Listening Status Banner */}
      {isListening && (
        <Animated.View style={[styles.listeningBanner, { opacity: listenPulseAnim }]}>
          <View style={styles.recordingDot} />
          <Text style={styles.listeningBannerText}>Listening... Speak clearly in English</Text>
        </Animated.View>
      )}

      {/* Floating Composer Container */}
      <Animated.View
        style={[
          styles.composerContainer,
          disabled && styles.composerDisabled,
          isListening && styles.composerListening,
          { opacity: disabled ? 0.6 : pulseAnim },
        ]}
      >
        {/* Mode Toggle Icon if handler provided */}
        {onToggleSentenceMode && (
          <TouchableOpacity
            onPress={onToggleSentenceMode}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Switch mode. Currently ${isSentenceMode ? 'Sentence' : 'Word'} mode`}
            style={[
              styles.modeToggleChip,
              isSentenceMode && styles.modeToggleChipActive,
            ]}
          >
            <Text
              style={[
                styles.modeToggleText,
                isSentenceMode && styles.modeToggleTextActive,
              ]}
            >
              {isSentenceMode ? 'SENTENCE' : 'WORD'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Search Magnifying Glass Icon */}
        <Text style={styles.searchIcon}>🔍</Text>

        {/* Input Field */}
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isListening ? 'Listening to voice...' : placeholder}
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          editable={!disabled && !isListening}
          selectTextOnFocus
          accessible={true}
          accessibilityRole="search"
          accessibilityLabel="Search or speak phrase to translate"
        />

        {/* Clear Button */}
        {value.length > 0 && !isListening && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear search input"
            style={styles.clearBtn}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Microphone Button */}
        <TouchableOpacity
          onPress={handleSpeechRecognition}
          disabled={disabled}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Stop listening' : 'Start voice input'}
          style={[
            styles.micBtn,
            isListening && styles.micBtnListening,
          ]}
        >
          <Text style={styles.micIconText}>
            {isListening ? '⏹' : '🎙'}
          </Text>
        </TouchableOpacity>

        {/* Action Button (Sign >) */}
        {isListening ? (
          <TouchableOpacity
            onPress={handleSpeechRecognition}
            style={styles.stopActionBtn}
            accessibilityLabel="Stop speech recognition"
          >
            <Text style={styles.stopActionText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!value.trim() && disabled}
            style={[
              styles.signActionBtn,
              isLoading && styles.signActionBtnLoading,
            ]}
            accessibilityLabel="Translate text to sign language"
          >
            <Text style={styles.signActionText}>
              {isLoading ? '...' : 'Sign'}
            </Text>
            {!isLoading && <Text style={styles.signChevron}>›</Text>}
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Autocomplete Suggestions Popover (when position is bottom) */}
      {dropdownPosition === 'bottom' && renderSuggestions()}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    zIndex: 100,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A121D',
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 7 : 5,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  composerDisabled: {
    backgroundColor: COLORS.stage,
    borderColor: COLORS.borderSubtle,
  },
  composerListening: {
    borderColor: COLORS.ruby,
    backgroundColor: 'rgba(23, 14, 20, 0.95)',
  },
  searchIcon: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 4,
    marginRight: 4,
  },
  modeToggleChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADII.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    marginRight: 6,
  },
  modeToggleChipActive: {
    backgroundColor: COLORS.cyanMuted,
    borderColor: COLORS.cyan,
  },
  modeToggleText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  modeToggleTextActive: {
    color: COLORS.cyanLight,
  },
  textInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingHorizontal: 6,
  },
  clearBtn: {
    padding: 6,
    marginRight: 4,
  },
  clearIcon: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  micBtnListening: {
    backgroundColor: COLORS.ruby,
    borderColor: '#FDA4AF',
  },
  micIconText: {
    fontSize: 16,
  },
  signActionBtn: {
    backgroundColor: '#00DF8F',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00DF8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  signActionBtnLoading: {
    opacity: 0.7,
  },
  signActionText: {
    color: '#07080D',
    fontWeight: '800',
    fontSize: 14,
  },
  signChevron: {
    color: '#07080D',
    fontWeight: '800',
    fontSize: 17,
    marginLeft: 3,
    marginTop: -1,
  },
  stopActionBtn: {
    backgroundColor: COLORS.ruby,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopActionText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: RADII.md,
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: RADII.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignSelf: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: RADII.full,
    backgroundColor: COLORS.ruby,
    marginRight: 8,
  },
  listeningBannerText: {
    ...TYPOGRAPHY.caption,
    color: '#FDA4AF',
    fontWeight: '600',
  },
  suggestionsContainer: {
    backgroundColor: '#0F172A',
    borderRadius: RADII.lg,
    marginBottom: 8,
    maxHeight: 220,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.45)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 1000,
    zIndex: 9999,
  },
  suggestionsContainerBottom: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 1000,
    marginBottom: 0,
    marginTop: 4,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  suggestionsHeaderIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  suggestionsHeaderText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#06B6D4',
    letterSpacing: 0.8,
    flex: 1,
  },
  suggestionsCountText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  suggestionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 10,
  },
  suggestionBadgeText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  suggestionText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  suggestionActionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#00DF8F',
    marginLeft: 8,
  },
});

export default SearchBar;
