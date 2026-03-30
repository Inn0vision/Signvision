import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Alert,
  TextInput,
} from 'react-native';
import Sound, { RecordBackType } from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Import components
import MainContainer from './MainContainer';
import CharacterAvatar from './CharacterAvatar';
import GreetingText from './GreetingText';
import MicrophoneControl from './MicrophoneControl';
import ControlButtons from './ControlButtons';

const BACKEND_URL = 'http://127.0.0.1:8001';

// Color theme
const COLORS = {
  darkBlue: '#11224E',
  lightBlue: '#A7D9FE',
  darkSkin: '#FCC9A7',
  lightSkin: '#F8E1CE',
};

const VoiceRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [text, setText] = useState('Hello, how are you?');
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [savedFilePath, setSavedFilePath] = useState('');
  const [glossResult, setGlossResult] = useState<any[]>([]);

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const recordAudioGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'App needs microphone access to record audio',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        let storageGranted = PermissionsAndroid.RESULTS.GRANTED;
        if (Platform.Version >= 29 && Platform.Version <= 32) {
          storageGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'App needs storage access to save recordings',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
        }

        return (
          recordAudioGranted === PermissionsAndroid.RESULTS.GRANTED &&
          storageGranted === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const generateFileName = () => {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
    return `voice_${timestamp}.wav`;
  };

  const sendAudioToBackend = async (filePath: string): Promise<string | null> => {
    const fileName = filePath.split('/').pop() || 'audio.wav';
    console.log('Uploading recorded audio to backend:', fileName);

    try {
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error('Audio file not found at: ' + filePath);
      }

      // Get file size
      const fileInfo = await RNFS.stat(filePath);
      console.log('File size:', fileInfo.size, 'bytes');

      // Attempt multipart/form-data upload
      try {
        console.log('Preparing multipart/form-data request');
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'android' ? 'file://' + filePath : filePath,
          name: fileName,
          type: 'audio/wav',
        } as any);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.error('Multipart request timeout after 180 seconds');
        }, 180000);

        const response = await fetch(`${BACKEND_URL}/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          body: formData as any,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('Multipart response status:', response.status);

        if (!response.ok) {
          const errText = await response.text();
          console.error('Multipart upload failed:', errText);
          throw new Error(`Server returned ${response.status}`);
        }

        const result = await response.json();
        console.log('Multipart upload success, transcription:', result);
        return result.text;
      } catch (multiErr) {
        console.warn('Multipart upload failed, falling back to base64', multiErr);
        // fallback to base64 method below
      }

      // Fallback: Read file as base64 and send to /transcribe-base64
      console.log('Reading file as base64 for fallback upload...');
      const fileData = await RNFS.readFile(filePath, 'base64');
      
      console.log('Base64 length:', fileData.length);

      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => {
        controller2.abort();
        console.error('Base64 request timeout after 180 seconds');
      }, 180000);

      try {
        const response2 = await fetch(`${BACKEND_URL}/transcribe-base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: fileName,
            filedata: fileData,
          }),
          signal: controller2.signal,
        });

        clearTimeout(timeoutId2);
        console.log('Base64 response status:', response2.status);

        if (!response2.ok) {
          let errorData;
          try {
            errorData = await response2.json();
            console.error('Backend error response (base64):', errorData);
          } catch {
            errorData = { detail: `HTTP ${response2.status}` };
          }
          throw new Error(errorData.detail || 'Failed to transcribe audio');
        }

        const result2 = await response2.json();
        console.log('Fallback transcription received:', result2);
        return result2.text;
      } catch (fetchError: any) {
        clearTimeout(timeoutId2);
        if (fetchError.name === 'AbortError') {
          console.error('Fallback request abort - timeout or network error');
          throw new Error('Transcription is taking longer than expected (>3 min). Check backend logs.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Error sending audio to backend:', error.message || error);
      throw error;
    } finally {
      // Delete local file after sending to backend
      try {
        if (filePath && await RNFS.exists(filePath)) {
          await RNFS.unlink(filePath);
          console.log('Local audio file deleted:', filePath);
        }
      } catch (deleteError) {
        console.warn('Could not delete local file:', deleteError);
      }
    }
  };

  const handleStartRecording = async () => {
    console.log('Starting recording...');
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Microphone permission is required to record');
      return;
    }

    try {
      const fileName = generateFileName();
      
      // Use temporary directory or app-specific directory instead of Downloads
      // Since we'll upload to backend and delete locally
      let filePath;
      if (Platform.OS === 'android') {
        // Use app's external directory - more reliable
        filePath = `${RNFS.ExternalDirectoryPath}/${fileName}`;
      } else {
        // iOS - use app's documents directory
        filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      }
      
      // store path internally but do not log it
      setSavedFilePath(filePath);

      Sound.addRecordBackListener((e: RecordBackType) => {
        setRecordSecs(e.currentPosition);
        setRecordTime(Sound.mmssss(Math.floor(e.currentPosition)));
      });

      await Sound.startRecorder(
        filePath,
        {
          AudioSamplingRate: 16000,
          AudioEncodingBitRate: 128000,
          AudioChannels: 1,
        },
        true
      );

      console.log('Recording started successfully');
      setRecording(true);

    } catch (err: any) {
      console.error('Start recording error:', err.message || err);
      Alert.alert('Error', 'Cannot start recording. Check permissions and storage.');
    }
  };

  const handleStopRecording = async () => {
    console.log('Stopping recording...');
    
    try {
      setRecording(false);
      setLoading(true);
      setTranscription('Processing audio...');

      const result = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      
      console.log('Recording stopped, recording result:', result);
      
      let filePath = savedFilePath || result;
      console.log('Attempting to send file from:', filePath);

      if (!filePath) {
        throw new Error('No file path available after recording');
      }

      // Verify file exists before sending
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`File not found at path: ${filePath}`);
      }

      try {
        console.log('Sending audio to backend for transcription...');
        const transcribedText = await sendAudioToBackend(filePath);
        
        if (transcribedText) {
          console.log('Transcription successfully received');
          setTranscription(transcribedText);
          setText(transcribedText);

          // Send the transcription to the backend NLP engine
          try {
            const nlpResponse = await fetch(`${BACKEND_URL}/process_text`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: transcribedText }),
            });
            if (!nlpResponse.ok) {
              const errText = await nlpResponse.text();
              console.error('NLP backend error:', errText);
            } else {
              const nlpResult = await nlpResponse.json();
              console.log('NLP backend response:', nlpResult);
              // Store gloss results for animation use
              if (nlpResult.results && Array.isArray(nlpResult.results)) {
                setGlossResult(nlpResult.results);
                console.log('Gloss results stored:', nlpResult.results);
              }
            }
          } catch (nlpError) {
            console.error('Error sending text to NLP backend:', nlpError);
          }
        } else {
          throw new Error('No transcription text received from backend');
        }
      } catch (transcribeError: any) {
        console.error('Transcription error:', transcribeError);
        const errorMsg = transcribeError.message || 'Failed to transcribe audio';
        setTranscription(`Error: ${errorMsg}`);
        Alert.alert('Transcription Error', errorMsg);
      }

    } catch (err: any) {
      console.error('Stop recording error:', err);
      const errorMsg = err.message || 'Error saving recording';
      setTranscription(`Error: ${errorMsg}`);
      Alert.alert('Recording Error', errorMsg);
    } finally {
      setLoading(false);
      setRecordSecs(0);
      setRecordTime('00:00:00');
      setSavedFilePath('');
      console.log('Stop recording process completed');
    }
  };

  const handlePlayPause = async () => {
    setPlaying(!playing);
    // Add playback logic here if needed
  };

  const handleReplay = () => {
    setRecordSecs(0);
    setRecordTime('00:00:00');
    // Add replay logic here if needed
  };

  useEffect(() => {
    return () => {
      Sound.removeRecordBackListener();
    };
  }, []);

  return (
    <MainContainer>
      {/* Character Avatar Section */}
      <CharacterAvatar source={null} />

      {/* Greeting Text Section */}
      <GreetingText text={text} />

      {/* Microphone Control Section */}
      <MicrophoneControl
        onPress={recording ? handleStopRecording : handleStartRecording}
        isRecording={recording}
        isLoading={loading}
      />

      {/* Status Text */}
      {recording && (
        <Text style={styles.recordingStatus}>
          Recording: {recordTime}
        </Text>
      )}

      {/* Control Buttons Section */}
      <ControlButtons
        onReplay={handleReplay}
        onPlayPause={handlePlayPause}
        isPlaying={playing}
        disabled={loading || recording}
      />

      {/* Transcription Display */}
      {/* {transcription && (
        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionLabel}>Transcribed Text:</Text>
          <Text style={styles.transcriptionText}>{transcription}</Text>
        </View>
      )} */}
    </MainContainer>
  );
};

const styles = StyleSheet.create({
  recordingStatus: {
    fontSize: 16,
    color: COLORS.lightBlue,
    fontFamily: 'Itim',
    fontWeight: '600',
    marginBottom: 20,
  },
  transcriptionContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(167, 217, 254, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightBlue,
    width: '90%',
  },
  transcriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.lightBlue,
    fontFamily: 'Itim',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Itim',
    lineHeight: 24,
  },
});

export default VoiceRecorder;
