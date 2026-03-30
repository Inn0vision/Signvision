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
} from 'react-native';
import { autocomplete } from '../services/s3Service';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (word: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search for a sign...',
  isLoading = false,
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Update suggestions when value changes
  useEffect(() => {
    if (value.length >= 2) {
      const results = autocomplete(value, 5);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      Keyboard.dismiss();
      setShowSuggestions(false);
      onSubmit(value.trim());
    }
  }, [value, onSubmit]);

  const handleSuggestionPress = useCallback((word: string) => {
    onChangeText(word);
    Keyboard.dismiss();
    setShowSuggestions(false);
    onSubmit(word);
  }, [onChangeText, onSubmit]);

  const handleClear = useCallback(() => {
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions]);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow suggestion press to register
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.inputContainer,
          disabled && styles.inputContainerDisabled,
          { opacity: disabled ? 0.6 : pulseAnim }
        ]}
      >
        {/* Search Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
        </View>
        
        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          editable={!disabled}
          selectTextOnFocus
        />
        
        {/* Clear Button */}
        {value.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
        
        {/* Search Button */}
        <TouchableOpacity
          style={[
            styles.searchButton,
            (!value.trim() || disabled) && styles.searchButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!value.trim() || disabled}
        >
          <Text style={styles.searchButtonText}>
            {isLoading ? '...' : 'Go'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Autocomplete Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    borderWidth: 1,
    borderColor: '#3a3a6a',
  },
  inputContainerDisabled: {
    backgroundColor: '#1a1a3a',
  },
  iconContainer: {
    marginRight: 8,
  },
  searchIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  clearIcon: {
    color: '#888',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchButtonDisabled: {
    backgroundColor: '#2a4a2a',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#3a3a6a',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a6a',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 15,
  },
});

export default SearchBar;
