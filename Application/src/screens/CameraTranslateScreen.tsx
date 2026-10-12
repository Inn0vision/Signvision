import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { translateVideoClip } from '../services/apiService';
import HandLandmarkOverlay from '../components/HandLandmarkOverlay';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';

export interface CameraTranslateScreenProps {
  onBack: () => void;
  onSignRecognized?: (text: string) => void;
}

export default function CameraTranslateScreen({ onBack, onSignRecognized }: CameraTranslateScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [webPermissionGranted, setWebPermissionGranted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Animations
  const recordScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Native refs
  const cameraRef = useRef<CameraView>(null);

  // Web refs
  const videoRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const [webStream, setWebStream] = useState<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const counterRef = useRef<NodeJS.Timeout | null>(null);

  // Web camera permission
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing === 'front' ? 'user' : 'environment' },
          audio: false,
        })
          .then((stream) => {
            setWebPermissionGranted(true);
            setWebStream(stream);
          })
          .catch((err) => {
            console.error('Camera access denied on web:', err);
            setErrorMsg('Camera access is required for live sign translation.');
          });

        return () => {
          setWebStream((prevStream: any) => {
            if (prevStream) prevStream.getTracks().forEach((track: any) => track.stop());
            return null;
          });
        };
      } else {
        setErrorMsg('Camera API not supported in this browser.');
      }
    }
  }, [facing]);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current && webStream) {
      videoRef.current.srcObject = webStream;
    }
  }, [webStream, webPermissionGranted]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const hasPermission = Platform.OS === 'web' ? webPermissionGranted : permission?.granted;

  if (!permission && Platform.OS !== 'web') {
    return <View style={styles.centerContainer} />;
  }

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>
            SignVision needs access to your camera to recognize Indian Sign Language gestures in real-time.
          </Text>
          {Platform.OS !== 'web' && (
            <Button
              variant="glow"
              onPress={requestPermission}
              style={styles.permActionBtn}
            >
              Grant Permission
            </Button>
          )}
          <Button
            variant="ghost"
            onPress={onBack}
            style={styles.permActionBtn}
          >
            Cancel & Return
          </Button>
          {errorMsg && <Text style={styles.permError}>{errorMsg}</Text>}
        </View>
      </View>
    );
  }

  const toggleCamera = () => {
    if (isRecording || isProcessing) return;
    setFacing(current => (current === 'front' ? 'back' : 'front'));
  };

  const handlePress = () => {
    if (isProcessing) return;
    if (isRecording) {
      Animated.spring(recordScale, { toValue: 1, useNativeDriver: true }).start();
      stopRecording();
    } else {
      Animated.spring(recordScale, { toValue: 1.15, useNativeDriver: true }).start();
      startRecording();
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setTranslation(null);
    setErrorMsg(null);
    setRecordingSeconds(0);

    counterRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);

    timerRef.current = setTimeout(() => stopRecording(), 7500);

    if (Platform.OS === 'web') {
      if (!webStream) {
        setIsRecording(false);
        setErrorMsg('No camera stream found.');
        return;
      }

      let mimeType = 'video/webm';
      try {
        const MediaRecorder = (window as any).MediaRecorder;
        if (MediaRecorder.isTypeSupported && !MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';

        const mediaRecorder = new MediaRecorder(webStream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        webChunksRef.current = [];

        mediaRecorder.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) webChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(webChunksRef.current, { type: mimeType });
          processVideo(blob);
        };

        mediaRecorder.start();
      } catch (err: any) {
        setIsRecording(false);
        setErrorMsg('Failed to start MediaRecorder on web.');
      }
    } else {
      if (!cameraRef.current) return;
      try {
        const data = await cameraRef.current.recordAsync({ maxDuration: 8 });
        setIsRecording(false);
        if (data && data.uri) processVideo(data.uri);
      } catch (e: any) {
        setIsRecording(false);
        setErrorMsg('Failed to record camera video.');
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (counterRef.current) clearInterval(counterRef.current);
    if (!isRecording) return;

    if (Platform.OS === 'web') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } else {
      if (cameraRef.current) cameraRef.current.stopRecording();
    }
    setIsRecording(false);
  };

  const processVideo = async (videoData: string | Blob) => {
    setIsProcessing(true);
    try {
      const response = await translateVideoClip(videoData);
      setTranslation(response.translation);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to analyze ISL video.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setTranslation(null);
    setErrorMsg(null);
    setIsProcessing(false);
    setRecordingSeconds(0);
  };

  const isComplete = translation || errorMsg;

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Camera Canvas (Bottom Layer) */}
      <View style={styles.cameraContainer}>
        <View style={styles.cameraWrapper}>
          {Platform.OS === 'web' ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={StyleSheet.flatten([styles.camera, { objectFit: 'cover' }] as any)}
            />
          ) : (
            <CameraView
              style={styles.camera}
              ref={cameraRef}
              facing={facing}
              zoom={0}
              mode="video"
            />
          )}
        </View>
      </View>

      {/* 2. Cybernetic HUD Overlays (Middle Layer) */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top HUD Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to avatar screen"
          >
            <Text style={styles.backBtnText}>← Avatar Stage</Text>
          </TouchableOpacity>

          <Badge
            label={isRecording ? `REC 00:0${recordingSeconds}` : isProcessing ? 'AI INFERENCE' : 'VISION HUD ACTIVE'}
            variant={isRecording ? 'ruby' : isProcessing ? 'cyan' : 'emerald'}
            pulse={isRecording || isProcessing}
          />

          <TouchableOpacity
            style={[styles.flipBtn, (isRecording || isProcessing) && styles.flipBtnDisabled]}
            onPress={toggleCamera}
            disabled={isRecording || isProcessing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Flip camera. Currently ${facing}`}
          >
            <Text style={styles.flipBtnText}>FLIP</Text>
          </TouchableOpacity>
        </View>

        {/* Hand Landmark Reticle Overlay */}
        {!isComplete && !isProcessing && (
          <HandLandmarkOverlay
            isActive={true}
            isRecording={isRecording}
            statusText={isRecording ? 'RECORDING ISL GESTURES' : 'ALIGN HANDS IN RETICLE'}
          />
        )}

        {/* 3. Action Layer (Bottom Layer) */}
        <View style={styles.footerControls} pointerEvents="box-none">
          {/* Result Card */}
          {isComplete ? (
            <Card variant="glass" glowColor={translation ? 'emerald' : 'ruby'} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Badge
                  label={translation && !translation.includes('UNCLEAR') ? 'SIGN TRANSLATED' : 'UNRECOGNIZED'}
                  variant={translation && !translation.includes('UNCLEAR') ? 'emerald' : 'ruby'}
                />
              </View>

              {translation && !translation.includes('UNCLEAR') ? (
                <>
                  <Text style={styles.resultTranslation}>“{translation}”</Text>
                  <Text style={styles.resultSubtitle}>
                    Inferred from your gestures using AI Vision.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.resultTranslation}>Unclear Gesture Sequence</Text>
                  <Text style={styles.resultSubtitle}>
                    {errorMsg || 'Could not recognize sequence. Ensure good lighting and sign within the reticle.'}
                  </Text>
                </>
              )}

              <View style={styles.resultActions}>
                <Button
                  variant="glow"
                  size="default"
                  onPress={resetState}
                  accessibilityLabel="Sign again"
                  style={styles.actionButton}
                >
                  Sign Again
                </Button>
                {translation && !translation.includes('UNCLEAR') && onSignRecognized && (
                  <Button
                    variant="outline"
                    size="default"
                    onPress={() => onSignRecognized(translation)}
                    accessibilityLabel="Replay in 3D Avatar"
                    style={styles.actionButton}
                  >
                    View on 3D Avatar
                  </Button>
                )}
              </View>
            </Card>
          ) : isProcessing ? (
            /* Processing Card */
            <Card variant="glass" glowColor="cyan" style={styles.processingCard}>
              <ActivityIndicator size="large" color={COLORS.cyan} />
              <Text style={styles.processingTitle}>Translating Sign Gestures...</Text>
              <Text style={styles.processingSubtitle}>
                Running video inference with Gemini Vision AI pipeline
              </Text>
            </Card>
          ) : (
            /* Recording Trigger UI */
            <View style={styles.triggerDeck}>
              <Text style={styles.promptHint}>
                {isRecording ? 'Capturing signs... Tap stop when done' : 'Position hands clearly in frame'}
              </Text>

              <View style={styles.triggerRow}>
                <TouchableOpacity
                  onPress={handlePress}
                  activeOpacity={0.85}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? 'Stop recording sign' : 'Start recording sign language'}
                  style={styles.recordOuterTouch}
                >
                  <Animated.View
                    style={[
                      styles.recordRing,
                      isRecording && styles.recordRingActive,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.recordInnerSquare,
                        isRecording && styles.recordInnerActive,
                      ]}
                    />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              <Text style={styles.triggerLabel}>
                {isRecording ? 'TAP TO COMPLETE SIGN' : 'TAP TO RECORD SIGN'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  cameraContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  cameraWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    zIndex: 20,
  },
  backBtn: {
    backgroundColor: 'rgba(7, 8, 13, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  backBtnText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  flipBtn: {
    backgroundColor: 'rgba(7, 8, 13, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  flipBtnDisabled: {
    opacity: 0.4,
  },
  flipBtnText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  footerControls: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    zIndex: 20,
  },
  triggerDeck: {
    alignItems: 'center',
  },
  promptHint: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  triggerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  recordOuterTouch: {
    padding: 6,
  },
  recordRing: {
    width: 76,
    height: 76,
    borderRadius: RADII.full,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  recordRingActive: {
    borderColor: COLORS.ruby,
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
  },
  recordInnerSquare: {
    width: 58,
    height: 58,
    borderRadius: RADII.full,
    backgroundColor: '#FFFFFF',
  },
  recordInnerActive: {
    width: 28,
    height: 28,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.ruby,
  },
  triggerLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  processingCard: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 8, 13, 0.88)',
    borderRadius: RADII.xl,
  },
  processingTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  processingSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  resultCard: {
    padding: 20,
    backgroundColor: 'rgba(7, 8, 13, 0.92)',
    borderRadius: RADII.xl,
  },
  resultHeader: {
    marginBottom: 10,
  },
  resultTranslation: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    fontSize: 22,
    marginBottom: 8,
  },
  resultSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.xl,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    maxWidth: 360,
    ...SHADOWS.card,
  },
  permIcon: {
    fontSize: 44,
    marginBottom: 16,
  },
  permTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  permDesc: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permActionBtn: {
    width: '100%',
    marginBottom: 10,
  },
  permError: {
    ...TYPOGRAPHY.caption,
    color: COLORS.ruby,
    marginTop: 8,
    textAlign: 'center',
  },
});
