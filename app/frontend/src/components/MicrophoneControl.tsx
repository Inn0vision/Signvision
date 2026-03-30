import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface MicrophoneControlProps {
  onPress: () => void;
  isRecording: boolean;
  isLoading?: boolean;
}

const MicrophoneControl: React.FC<MicrophoneControlProps> = ({ 
  onPress, 
  isRecording,
  isLoading = false 
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[
          styles.micButton,
          isRecording && styles.micButtonActive
        ]}
        onPress={onPress}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={isRecording ? '#FFFFFF' : '#A7D9FE'} />
        ) : (
          <Icon 
            name="microphone" 
            size={70} 
            color={isRecording ? '#FFFFFF' : '#A7D9FE'}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 35,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#A7D9FE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.34,
    shadowRadius: 6.65,
    elevation: 10,
  },
  micButtonActive: {
    backgroundColor: '#FF6B6B',
  },
});

export default MicrophoneControl;
