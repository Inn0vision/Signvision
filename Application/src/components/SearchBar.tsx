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
  ActivityIndicator,
} from 'react-native';
import { Button } from './ui/Button';
import { autocomplete } from '../services/s3Service';
import { transcribeAudio } from '../services/apiService';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { SearchMagnifyIcon, ArrowRightIcon, MicIcon } from './ui/AppIcons';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (word: string, language?: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  isSentenceMode?: boolean;
  onToggleSentenceMode?: () => void;
  dropdownPosition?: 'top' | 'bottom';
  selectedLanguage?: 'en' | 'hi' | 'mr';
  onLanguageChange?: (lang: 'en' | 'hi' | 'mr') => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Type in English, Hindi, or Marathi...',
  isLoading = false,
  disabled = false,
  isSentenceMode = false,
  onToggleSentenceMode,
  dropdownPosition = 'bottom',
  selectedLanguage: propSelectedLanguage,
  onLanguageChange,
}) => {
  const [internalLanguage, setInternalLanguage] = useState<'en' | 'hi' | 'mr'>('en');
  const activeLanguage = propSelectedLanguage || internalLanguage;

  const handleLanguageSelect = (lang: 'en' | 'hi' | 'mr') => {
    setInternalLanguage(lang);
    onLanguageChange?.(lang);
  };

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const listenPulseAnim = useRef(new Animated.Value(1)).current;
  const webRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioStreamRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const latestTranscriptRef = useRef<string>('');

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

  // Pulse animation for listening / transcribing state
  useEffect(() => {
    if (isListening || isTranscribing) {
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
  }, [isListening, isTranscribing, listenPulseAnim]);

  // Clean up any ongoing audio recording when component unmounts
  useEffect(() => {
    return () => {
      if (webRecognitionRef.current) {
        try {
          webRecognitionRef.current.abort();
        } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      if (audioStreamRef.current) {
        try {
          audioStreamRef.current.getTracks().forEach((track: any) => track.stop());
        } catch (e) {}
      }
    };
  }, []);

  // Helper to extract active word for recommendations
  const getActiveSearchTerm = useCallback((text: string, isSentence: boolean): string => {
    if (!isSentence) return text.trim();
    const tokens = text.split(/\s+/);
    return tokens[tokens.length - 1]?.trim() || '';
  }, []);

  // Autocomplete suggestions from database
  useEffect(() => {
    if (isSentenceMode) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
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

  const resolveSpeechLocale = useCallback(async (lang: 'en' | 'hi' | 'mr'): Promise<string> => {
    if (lang === 'hi') return 'hi-IN';
    if (lang === 'mr') return 'mr-IN';

    const fallbackLocale = 'en-IN';
    if (Platform.OS === 'web') return fallbackLocale;

    try {
      const localesResult = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      const availableLocales = [
        ...(localesResult.installedLocales || []),
        ...(localesResult.locales || []),
      ];

      const preferredLocales = ['en-IN', 'en-US', 'en-GB'];
      const preferredMatch = preferredLocales.find((locale) => availableLocales.includes(locale));

      return preferredMatch || availableLocales[0] || fallbackLocale;
    } catch (error) {
      return fallbackLocale;
    }
  }, []);

  // Stop any active Web audio recording or speech recognition
  const stopWebSpeech = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.stop();
      } catch (e) {}
    }

    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track: any) => track.stop());
      } catch (e) {}
      audioStreamRef.current = null;
    }

    setIsListening(false);
  }, []);

  // Web MediaRecorder fallback: Records audio and transcribes via backend /transcribe
  const startMediaRecorderWeb = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      Alert.alert(
        'Microphone Unsupported',
        'Audio recording is not supported in this browser environment.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (audioStreamRef.current) {
          try {
            audioStreamRef.current.getTracks().forEach((track: any) => track.stop());
          } catch (e) {}
          audioStreamRef.current = null;
        }

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setIsListening(false);
          return;
        }

        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size < 200) {
          setIsListening(false);
          return;
        }

        setIsListening(false);
        setIsTranscribing(true);

        try {
          const res = await transcribeAudio(audioBlob, activeLanguage);
          if (res.success && res.text) {
            const transcribed = res.text.trim();
            onChangeText(transcribed);
            onSubmit(transcribed, activeLanguage);
          } else {
            Alert.alert(
              'Voice Recognition',
              res.error || 'Could not understand the audio. Please speak clearly.'
            );
          }
        } catch (transcribeErr: any) {
          console.error('Web voice transcription error:', transcribeErr);
          Alert.alert(
            'Transcription Failed',
            transcribeErr.message || 'Could not transcribe speech. Please try again.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
      setIsListening(true);
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      setIsListening(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        Alert.alert(
          'Microphone Blocked',
          'Microphone access was denied. Please allow microphone permissions in your browser address bar.'
        );
      } else {
        Alert.alert(
          'Microphone Error',
          err.message || 'Could not access your microphone.'
        );
      }
    }
  }, [activeLanguage, onChangeText, onSubmit]);

  // Web Speech Recognition with fallback for Chrome, Edge, Safari, Firefox, Opera
  const toggleWebSpeech = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (isListening || isTranscribing) {
      stopWebSpeech();
      return;
    }

    latestTranscriptRef.current = '';

    // Request/check microphone permission via getUserMedia
    let micStream: any = null;
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permErr: any) {
        console.warn('Microphone permission request failed:', permErr);
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          Alert.alert(
            'Microphone Blocked',
            'Microphone permission is blocked. Please click the microphone icon in your browser address bar to allow access.'
          );
          return;
        }
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // If browser doesn't have Web Speech API (Firefox, Brave shields, etc.), use backend MediaRecorder
    if (!SpeechRecognition) {
      if (micStream) {
        micStream.getTracks().forEach((track: any) => track.stop());
      }
      startMediaRecorderWeb();
      return;
    }

    if (micStream) {
      micStream.getTracks().forEach((track: any) => track.stop());
    }

    try {
      const recognition = new SpeechRecognition();
      webRecognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Map language code: Hindi -> hi-IN, Marathi -> mr-IN, English -> en-IN
      const langCode = activeLanguage === 'hi' ? 'hi-IN' : activeLanguage === 'mr' ? 'mr-IN' : 'en-IN';
      recognition.lang = langCode;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript + ' ';
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const fullText = (finalTranscript + interimTranscript).trim();
        if (fullText) {
          latestTranscriptRef.current = fullText;
          onChangeText(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        const error = event.error;
        console.warn('Web speech recognition error:', error);

        // If network error (common in Linux Chromium / Brave / offline) or service-not-allowed,
        // automatically fallback to backend MediaRecorder audio transcription!
        if (error === 'network' || error === 'service-not-allowed') {
          try {
            recognition.stop();
          } catch (e) {}
          startMediaRecorderWeb();
          return;
        }

        if (error === 'not-allowed') {
          Alert.alert(
            'Microphone Blocked',
            'Microphone permission was denied. Please allow microphone access in your browser settings.'
          );
        } else if (error !== 'no-speech' && error !== 'aborted') {
          console.error('Speech recognition error:', error);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        const textToSubmit = latestTranscriptRef.current.trim();
        if (textToSubmit) {
          onSubmit(textToSubmit, activeLanguage);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('SpeechRecognition failed to start, falling back to MediaRecorder:', err);
      startMediaRecorderWeb();
    }
  }, [isListening, isTranscribing, stopWebSpeech, activeLanguage, startMediaRecorderWeb, onChangeText, onSubmit]);

  // Mobile Speech Recognition using expo-speech-recognition
  const toggleNativeSpeech = useCallback(async () => {
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

      const locale = await resolveSpeechLocale(activeLanguage);

      setIsListening(true);
      Keyboard.dismiss();

      ExpoSpeechRecognitionModule.start({
        lang: locale,
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
  }, [isListening, activeLanguage, resolveSpeechLocale]);

  const handleSpeechRecognition = useCallback(() => {
    if (Platform.OS === 'web') {
      toggleWebSpeech();
    } else {
      toggleNativeSpeech();
    }
  }, [toggleWebSpeech, toggleNativeSpeech]);

  // Native result listener
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = ExpoSpeechRecognitionModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.transcript?.trim();
      if (!transcript) return;

      onChangeText(transcript);

      if (event.isFinal) {
        setIsListening(false);
        onSubmit(transcript, activeLanguage);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activeLanguage, onChangeText, onSubmit]);

  // Native start & end listeners
  useEffect(() => {
    if (Platform.OS === 'web') return;

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

  // Native error listener
  useEffect(() => {
    if (Platform.OS === 'web') return;

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
      onSubmit(value.trim(), activeLanguage);
    }
  }, [value, activeLanguage, onSubmit]);

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
    if (isSentenceMode) {
      setShowSuggestions(false);
      return;
    }
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
    showSuggestions && !isSentenceMode && suggestions.length > 0 && (
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

      {/* Language Selector Chips */}
      <View style={styles.langPillsRow}>
        <TouchableOpacity
          style={[styles.langPill, activeLanguage === 'en' && styles.langPillActive]}
          onPress={() => handleLanguageSelect('en')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Switch voice and translation to English"
        >
          <Text style={[styles.langPillText, activeLanguage === 'en' && styles.langPillTextActive]}>
            English
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langPill, activeLanguage === 'hi' && styles.langPillActive]}
          onPress={() => handleLanguageSelect('hi')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Switch voice and translation to Hindi"
        >
          <Text style={[styles.langPillText, activeLanguage === 'hi' && styles.langPillTextActive]}>
            हिंदी (Hindi)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langPill, activeLanguage === 'mr' && styles.langPillActive]}
          onPress={() => handleLanguageSelect('mr')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Switch voice and translation to Marathi"
        >
          <Text style={[styles.langPillText, activeLanguage === 'mr' && styles.langPillTextActive]}>
            मराठी (Marathi)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Listening or Transcribing Status Banner */}
      {(isListening || isTranscribing) && (
        <Animated.View style={[styles.listeningBanner, { opacity: listenPulseAnim }]}>
          {isTranscribing ? (
            <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 8 }} />
          ) : (
            <View style={styles.recordingDot} />
          )}
          <Text style={styles.listeningBannerText}>
            {isTranscribing
              ? `Transcribing ${activeLanguage === 'hi' ? 'Hindi' : activeLanguage === 'mr' ? 'Marathi' : 'English'} speech...`
              : `Listening... Speak clearly in ${activeLanguage === 'hi' ? 'Hindi' : activeLanguage === 'mr' ? 'Marathi' : 'English'}`}
          </Text>
        </Animated.View>
      )}

      {/* Floating Composer Container */}
      <Animated.View
        style={[
          styles.composerContainer,
          isFocused && styles.composerFocused,
          disabled && styles.composerDisabled,
          (isListening || isTranscribing) && styles.composerListening,
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
        <View style={styles.searchIconWrapper}>
          <SearchMagnifyIcon size={18} color={isFocused ? '#38BDF8' : '#94A3B8'} />
        </View>

        {/* Input Field */}
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          onFocus={() => {
            setIsFocused(true);
            handleFocus();
          }}
          onBlur={() => {
            setIsFocused(false);
            handleBlur();
          }}
          placeholder={
            isTranscribing
              ? `Transcribing speech in ${activeLanguage === 'hi' ? 'Hindi' : activeLanguage === 'mr' ? 'Marathi' : 'English'}...`
              : isListening
              ? `Listening in ${activeLanguage === 'hi' ? 'Hindi' : activeLanguage === 'mr' ? 'Marathi' : 'English'}...`
              : placeholder
          }
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          editable={!disabled && !isListening && !isTranscribing}
          selectTextOnFocus
          accessible={true}
          accessibilityRole="search"
          accessibilityLabel="Search or speak phrase to translate"
        />

        {/* Clear Button */}
        {value.length > 0 && !isListening && !isTranscribing && (
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
          disabled={disabled || isTranscribing}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Stop listening' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
          style={[
            styles.micBtn,
            (isListening || isTranscribing) && styles.micBtnListening,
          ]}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : isListening ? (
            <Text style={styles.micIconText}>⏹</Text>
          ) : (
            <MicIcon size={16} color="#94A3B8" />
          )}
        </TouchableOpacity>

        {/* Circular Blue Submit Button with White Right Arrow (matching reference) */}
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
            disabled={(!value.trim() && disabled) || isTranscribing}
            style={[
              styles.circularSubmitBtn,
              circularSubmitBtnWebStyle,
              (isLoading || isTranscribing) && styles.circularSubmitBtnLoading,
            ]}
            accessibilityLabel="Translate text to sign language"
          >
            {isLoading || isTranscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ArrowRightIcon size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Autocomplete Suggestions Popover (when position is bottom) */}
      {dropdownPosition === 'bottom' && renderSuggestions()}
    </View>
  );
};

const circularSubmitBtnWebStyle = Platform.OS === 'web' ? ({
  backgroundImage: 'linear-gradient(135deg, #0284C7 0%, #00C9D8 100%)',
} as any) : null;

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    zIndex: 100,
  },
  langPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.full,
    backgroundColor: '#0A1220',
    borderWidth: 1,
    borderColor: '#182436',
  },
  langPillActive: {
    backgroundColor: '#10243C',
    borderColor: '#38BDF8',
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E9CAE',
  },
  langPillTextActive: {
    color: '#38BDF8',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1320',
    borderRadius: RADII.full,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: Platform.OS === 'ios' ? 7 : 5,
    borderWidth: 1,
    borderColor: '#1D2B3D',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  composerFocused: {
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  composerDisabled: {
    backgroundColor: COLORS.stage,
    borderColor: COLORS.borderSubtle,
  },
  composerListening: {
    borderColor: COLORS.ruby,
    backgroundColor: 'rgba(23, 14, 20, 0.95)',
  },
  searchIconWrapper: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#F5F7FA',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingHorizontal: 6,
  },
  clearBtn: {
    padding: 6,
    marginRight: 2,
  },
  clearIcon: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  micBtnListening: {
    backgroundColor: COLORS.ruby,
    borderColor: '#FDA4AF',
  },
  micIconText: {
    fontSize: 14,
  },
  circularSubmitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C9D8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  circularSubmitBtnLoading: {
    opacity: 0.8,
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
