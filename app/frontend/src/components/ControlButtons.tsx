import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface ControlButtonsProps {
  onReplay: () => void;
  onPlayPause: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({ 
  onReplay, 
  onPlayPause,
  isPlaying = false,
  disabled = false
}) => {
  return (
    <View style={styles.container}>
      {/* Swap Button (Left) */}
      <TouchableOpacity 
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onReplay}
        disabled={disabled}
      >
        <Icon name="swap-horizontal" size={28} color="#11224E" />
      </TouchableOpacity>

      {/* Play/Pause Button (Center - Main) */}
      <TouchableOpacity 
        style={[styles.playButton, disabled && styles.buttonDisabled]}
        onPress={onPlayPause}
        disabled={disabled}
      >
        <Icon 
          name={isPlaying ? 'pause' : 'play'} 
          size={40} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>

      {/* Stop Button (Right) */}
      <TouchableOpacity 
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onReplay}
        disabled={disabled}
      >
        <Icon name="pause-circle" size={28} color="#11224E" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 25,
    marginTop: 40,
    paddingHorizontal: 20,
  },
  button: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#A7D9FE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  playButton: {
    backgroundColor: '#A7D9FE',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5.65,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

export default ControlButtons;
