import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { translateVideoClip } from '../services/apiService';
import { TranslateVideoResponse } from '../types';
import HandLandmarkOverlay from '../components/HandLandmarkOverlay';
import { handTrackingService, type HandLandmarkList } from '../services/handTrackingService';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import {
  ChevronLeftIcon,
  FlipCameraIcon,
  CameraApertureIcon,
  CopyIcon,
  CheckIcon,
  RefreshIcon,
  AvatarPlayIcon,
  AlertCircleIcon,
} from '../components/video-translate/VideoTranslateIcons';

export interface CameraTranslateScreenProps {
  onBack: () => void;
  onSignRecognized?: (text: string) => void;
}

export type RecordingState =
  | 'IDLE'
  | 'COUNTDOWN'
  | 'RECORDING'
  | 'FINALIZING'
  | 'UPLOADING'
  | 'SUCCESS'
  | 'ERROR';

const RECORDING_DURATION_MS = 3500;
const MAX_RECORDING_SECONDS = 3;

export default function CameraTranslateScreen({ onBack, onSignRecognized }: CameraTranslateScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [webPermissionGranted, setWebPermissionGranted] = useState(false);

  // Single-source-of-truth recording lifecycle state
  const recordingStateRef = useRef<RecordingState>('IDLE');
  const [recordingState, setRecordingState] = useState<RecordingState>('IDLE');

  const [translation, setTranslation] = useState<string | null>(null);
  const [resultData, setResultData] = useState<TranslateVideoResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Live MediaPipe hand landmarks
  const [detectedHands, setDetectedHands] = useState<HandLandmarkList[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const isDesktop = Platform.OS === 'web' && windowWidth >= 768;

  // Responsive camera viewport maintaining uncropped aspect ratio
  const cameraDimensions = useMemo(() => {
    const isLandscape = windowWidth > windowHeight;
    const targetRatio = isLandscape ? 16 / 9 : 3 / 4;

    const availableWidth = isDesktop ? Math.min(windowWidth - 48, 640) : windowWidth;
    const maxAvailableHeight = isDesktop
      ? Math.min(windowHeight - 220, 520)
      : windowHeight * (isLandscape ? 0.72 : 0.60);

    let width = availableWidth;
    let height = width / targetRatio;

    if (height > maxAvailableHeight) {
      height = maxAvailableHeight;
      width = height * targetRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }, [windowWidth, windowHeight, isDesktop]);

  // Visual pulse animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Camera handles
  const cameraRef = useRef<CameraView>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);

  // Timers and monotonic references
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const counterRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Initialize MediaPipe HandLandmarker on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      handTrackingService.initialize().catch((err) => {
        console.warn('[CameraTranslateScreen] HandLandmarker init warning:', err);
      });
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      handTrackingService.dispose();
    };
  }, []);

  // Web camera permission lifecycle
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: facing === 'front' ? 'user' : 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
          .then((stream) => {
            setWebPermissionGranted(true);
            setWebStream(stream);
            setErrorMsg(null);
          })
          .catch((err) => {
            console.error('Camera access denied on web:', err);
            setErrorMsg('Camera access is required for live sign translation.');
          });

        return () => {
          setWebStream((prevStream) => {
            if (prevStream) {
              prevStream.getTracks().forEach((track) => track.stop());
            }
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

  // Live real-time hand detection loop on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || !webStream) return;

    let isActive = true;
    const runDetection = () => {
      if (!isActive) return;
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const hands = handTrackingService.detect(videoRef.current);
        if (hands && hands.length > 0) {
          setDetectedHands(hands);
        } else {
          setDetectedHands((prev) => (prev.length > 0 ? [] : prev));
        }
      }
      animFrameRef.current = requestAnimationFrame(runDetection);
    };

    animFrameRef.current = requestAnimationFrame(runDetection);

    return () => {
      isActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [webStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (counterRef.current) clearInterval(counterRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (Platform.OS === 'web' && webStream) {
        webStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [webStream]);

  // Recording pulse animation
  const isRecording = recordingState === 'RECORDING';
  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 650,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const toggleCamera = () => {
    if (recordingStateRef.current !== 'IDLE') return;
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  };

  /**
   * Safe guarded stopRecording function that avoids React stale closure bugs
   */
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (counterRef.current) {
      clearInterval(counterRef.current);
      counterRef.current = null;
    }

    if (recordingStateRef.current !== 'RECORDING') return;

    recordingStateRef.current = 'FINALIZING';
    setRecordingState('FINALIZING');

    if (Platform.OS === 'web') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('MediaRecorder stop error:', e);
        }
      }
    } else {
      if (cameraRef.current) {
        try {
          cameraRef.current.stopRecording();
        } catch (e) {
          // Ignore if already stopped
        }
      }
    }
  }, []);

  /**
   * Uploads finalized video to local ML microservice (:8001)
   */
  const processVideo = useCallback(async (videoData: string | Blob) => {
    recordingStateRef.current = 'UPLOADING';
    setRecordingState('UPLOADING');
    try {
      // Both Web (MediaRecorder) and Mobile (CameraView.recordAsync) record raw unflipped
      // sensor video frames. The ML model was trained on horizontally flipped selfie frames
      // (cv2.flip(frame, 1)). Setting isMirrored to false instructs the backend to apply
      // this required horizontal flip, aligning mobile hand coordinates with the model.
      const isMirrored = false;
      const response = await translateVideoClip(videoData, {
        isMirrored,
        facingMode: facing,
      });

      setResultData(response);
      setTranslation(response.translation);

      const isUnclear =
        response.status === 'UNCERTAIN' ||
        response.predicted_sign === 'UNCERTAIN' ||
        response.translation === 'UNCLEAR SIGN SEQUENCE' ||
        response.translation.toUpperCase().includes('UNCLEAR');

      if (isUnclear) {
        recordingStateRef.current = 'ERROR';
        setRecordingState('ERROR');
        setErrorMsg(
          response.status_message ||
            'Sign unclear — please try again. Ensure hands are clearly visible inside the guide frame.'
        );
      } else {
        recordingStateRef.current = 'SUCCESS';
        setRecordingState('SUCCESS');
      }
    } catch (e: any) {
      recordingStateRef.current = 'ERROR';
      setRecordingState('ERROR');
      setErrorMsg(e.message || 'Failed to translate ISL video. Please check connection and try again.');
    }
  }, [facing]);

  /**
   * Starts recording video with monotonic deadline and automatic stop
   */
  const startRecording = useCallback(async () => {
    if (recordingStateRef.current === 'RECORDING' || recordingStateRef.current === 'UPLOADING') {
      return;
    }

    recordingStateRef.current = 'RECORDING';
    setRecordingState('RECORDING');
    setRecordingSeconds(0);
    recordingStartTimeRef.current = Date.now();

    if (timerRef.current) clearTimeout(timerRef.current);
    if (counterRef.current) clearInterval(counterRef.current);

    // Monotonic interval check: guarantees accurate UI counter & stops exactly on deadline
    counterRef.current = setInterval(() => {
      if (recordingStateRef.current !== 'RECORDING') {
        if (counterRef.current) clearInterval(counterRef.current);
        return;
      }
      const elapsedMs = Date.now() - recordingStartTimeRef.current;
      const elapsedSec = Math.min(MAX_RECORDING_SECONDS, Math.floor(elapsedMs / 1000));
      setRecordingSeconds(elapsedSec);

      if (elapsedMs >= RECORDING_DURATION_MS) {
        stopRecording();
      }
    }, 100);

    // Hard deadline timer
    timerRef.current = setTimeout(() => {
      stopRecording();
    }, RECORDING_DURATION_MS);

    if (Platform.OS === 'web') {
      if (!webStream) {
        recordingStateRef.current = 'ERROR';
        setRecordingState('ERROR');
        setErrorMsg('Camera stream not found.');
        return;
      }

      let mimeType = 'video/webm';
      try {
        const MediaRecorderClass = (window as any).MediaRecorder;
        if (MediaRecorderClass.isTypeSupported && !MediaRecorderClass.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }

        const mediaRecorder = new MediaRecorderClass(webStream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        webChunksRef.current = [];

        mediaRecorder.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) webChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(webChunksRef.current, { type: mimeType });
          if (blob.size > 0) {
            processVideo(blob);
          } else {
            recordingStateRef.current = 'ERROR';
            setRecordingState('ERROR');
            setErrorMsg('Recorded video was empty. Please try again.');
          }
        };

        mediaRecorder.start();
      } catch (err: any) {
        recordingStateRef.current = 'ERROR';
        setRecordingState('ERROR');
        setErrorMsg('Failed to record video stream.');
      }
    } else {
      if (!cameraRef.current) return;
      try {
        const data = await cameraRef.current.recordAsync({
          maxDuration: MAX_RECORDING_SECONDS + 1,
          maxFileSize: 15 * 1024 * 1024,
        });
        if (data && data.uri) {
          processVideo(data.uri);
        }
      } catch (e: any) {
        if (recordingStateRef.current === 'RECORDING') {
          recordingStateRef.current = 'ERROR';
          setRecordingState('ERROR');
          setErrorMsg('Failed to record camera video.');
        }
      }
    }
  }, [webStream, stopRecording, processVideo]);

  const triggerCountdownAndRecord = useCallback(() => {
    if (recordingStateRef.current !== 'IDLE') return;

    setTranslation(null);
    setResultData(null);
    setErrorMsg(null);

    recordingStateRef.current = 'COUNTDOWN';
    setRecordingState('COUNTDOWN');
    setCountdown(2);

    let remaining = 2;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
        startRecording();
      }
    }, 1000);
  }, [startRecording]);

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    recordingStateRef.current = 'IDLE';
    setRecordingState('IDLE');
  }, []);

  const handleRecordPress = useCallback(() => {
    if (recordingState === 'FINALIZING' || recordingState === 'UPLOADING') return;

    if (recordingState === 'COUNTDOWN') {
      cancelCountdown();
      return;
    }

    if (recordingState === 'RECORDING') {
      stopRecording();
    } else {
      triggerCountdownAndRecord();
    }
  }, [recordingState, cancelCountdown, stopRecording, triggerCountdownAndRecord]);

  const resetState = useCallback(() => {
    recordingStateRef.current = 'IDLE';
    setRecordingState('IDLE');
    setTranslation(null);
    setResultData(null);
    setErrorMsg(null);
    setRecordingSeconds(0);
    setCountdown(null);
    setCopied(false);
  }, []);

  const handleCopy = async () => {
    if (!translation) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(translation);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      if (Platform.OS !== 'web') {
        const { Share } = require('react-native');
        await Share.share({ message: translation });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Copy action failed:', err);
    }
  };

  const isConfident = Boolean(
    recordingState === 'SUCCESS' &&
      resultData?.status === 'CONFIDENT' &&
      resultData?.predicted_sign &&
      resultData?.predicted_sign !== 'UNCERTAIN' &&
      translation &&
      translation !== 'UNCLEAR SIGN SEQUENCE' &&
      !translation.toUpperCase().includes('UNCLEAR')
  );

  const isComplete = recordingState === 'SUCCESS' || (recordingState === 'ERROR' && (translation || errorMsg));
  const isProcessing = recordingState === 'FINALIZING' || recordingState === 'UPLOADING';
  const hasPermission = Platform.OS === 'web' ? webPermissionGranted : permission?.granted;

  // Loading state while checking permission
  if (!permission && Platform.OS !== 'web') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color={COLORS.emerald} />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  // Permission Request / Denied View
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <CameraApertureIcon size={32} color={COLORS.emerald} />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>
            SignVision uses your camera to recognize Indian Sign Language gestures in real time. Video is
            processed securely and never stored.
          </Text>

          {Platform.OS !== 'web' ? (
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={requestPermission}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Grant camera permission"
            >
              <Text style={styles.primaryActionText}>Grant Camera Access</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.webPermNotice}>
              Please allow camera access in your browser prompt or site settings.
            </Text>
          )}

          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={onBack}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.secondaryActionText}>Return to App</Text>
          </TouchableOpacity>

          {errorMsg && <Text style={styles.permError}>{errorMsg}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.mainWrapper, isDesktop && styles.desktopWrapper]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              stopRecording();
              onBack();
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to translator"
            hitSlop={8}
          >
            <ChevronLeftIcon size={18} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Sign to Text</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Indian Sign Language translation
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.flipButton,
              (isRecording || isProcessing || countdown !== null) && styles.controlDisabled,
            ]}
            onPress={toggleCamera}
            disabled={isRecording || isProcessing || countdown !== null}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Switch camera. Currently facing ${facing}`}
            hitSlop={8}
          >
            <FlipCameraIcon size={16} color={COLORS.textSecondary} />
            <Text style={styles.flipButtonText}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Camera Stage Viewport */}
        <View style={styles.cameraStage}>
          <View
            style={[
              styles.cameraFrame,
              {
                width: cameraDimensions.width,
                height: cameraDimensions.height,
              },
            ]}
          >
            {Platform.OS === 'web' ? (
              <video
                ref={videoRef as any}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#07080D',
                  transform: facing === 'front' ? 'scaleX(-1)' : 'none',
                }}
              />
            ) : (
              <CameraView
                style={[
                  styles.nativeCamera,
                  facing === 'front' && { transform: [{ scaleX: -1 }] },
                ]}
                ref={cameraRef}
                facing={facing}
                zoom={0}
                mode="video"
                videoQuality="720p"
                mute={true}
                mirror={facing === 'front'}
              />
            )}

            {/* Genuine MediaPipe Hand Landmarks Overlay */}
            {!isComplete && !isProcessing && (
              <HandLandmarkOverlay
                isActive={true}
                isRecording={isRecording}
                detectedHands={detectedHands}
                viewportWidth={cameraDimensions.width}
                viewportHeight={cameraDimensions.height}
                isMirrored={facing === 'front'}
                statusText={
                  countdown !== null
                    ? `Get ready... ${countdown}`
                    : isRecording
                    ? `Recording gestures (00:0${recordingSeconds} / 00:03)`
                    : undefined
                }
              />
            )}

            {/* Countdown Overlay */}
            {countdown !== null && (
              <View style={styles.countdownOverlay}>
                <View style={styles.countdownBadge}>
                  <Text style={styles.countdownNumber}>{countdown}</Text>
                </View>
                <Text style={styles.countdownHint}>Get ready to sign...</Text>
                <TouchableOpacity
                  style={styles.countdownCancelBtn}
                  onPress={cancelCountdown}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel countdown"
                >
                  <Text style={styles.countdownCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Control Deck */}
        <View style={styles.controlDeck}>
          {isComplete ? (
            /* Result Card */
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={styles.resultStatusRow}>
                  <View
                    style={[
                      styles.resultStatusDot,
                      { backgroundColor: isConfident ? COLORS.emerald : COLORS.ruby },
                    ]}
                  />
                  <Text style={styles.resultStatusLabel}>
                    {isConfident ? 'TRANSLATION' : 'RECOGNITION UNCERTAIN'}
                  </Text>
                </View>

                {isConfident && (
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopy}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={copied ? 'Copied' : 'Copy translation'}
                    hitSlop={8}
                  >
                    {copied ? (
                      <>
                        <CheckIcon size={14} color={COLORS.emerald} />
                        <Text style={[styles.copyButtonText, { color: COLORS.emerald }]}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <CopyIcon size={14} color={COLORS.textSecondary} />
                        <Text style={styles.copyButtonText}>Copy</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {isConfident ? (
                <>
                  <Text style={styles.resultText} selectable={true}>
                    “{translation}”
                  </Text>
                  <Text style={styles.resultHint}>
                    Gesture sequence recognized successfully.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.uncertainAlertRow}>
                    <AlertCircleIcon size={18} color={COLORS.amber} />
                    <Text style={styles.uncertainHeading}>Sign unclear — please try again</Text>
                  </View>
                  <Text style={styles.resultHint}>
                    {errorMsg ||
                      'Ensure both hands are visible inside the guide frame with steady lighting, then repeat the gesture.'}
                  </Text>
                </>
              )}

              {/* Actions */}
              <View style={styles.resultActionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={resetState}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={isConfident ? 'Translate another sign' : 'Try again'}
                >
                  <RefreshIcon size={15} color={COLORS.textPrimary} />
                  <Text style={styles.actionBtnSecondaryText}>
                    {isConfident ? 'Translate Another' : 'Try Again'}
                  </Text>
                </TouchableOpacity>

                {isConfident && onSignRecognized && translation && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={() => {
                      if (isConfident && translation && translation !== 'UNCLEAR SIGN SEQUENCE') {
                        onSignRecognized(translation);
                      }
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="View on 3D Avatar"
                  >
                    <AvatarPlayIcon size={14} color={COLORS.textInverse} />
                    <Text style={styles.actionBtnPrimaryText}>View on 3D Avatar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : isProcessing ? (
            /* Processing Card */
            <View style={styles.processingCard}>
              <ActivityIndicator size="small" color={COLORS.emerald} />
              <View style={styles.processingTextGroup}>
                <Text style={styles.processingTitle}>
                  {recordingState === 'FINALIZING' ? 'Finalizing Clip...' : 'Translating Sign...'}
                </Text>
                <Text style={styles.processingSubtitle}>
                  {recordingState === 'FINALIZING'
                    ? 'Packaging recorded gestures'
                    : 'Analyzing hand gestures and posture'}
                </Text>
              </View>
            </View>
          ) : (
            /* Shutter Control Deck */
            <View style={styles.shutterDeck}>
              {/* Status Pill */}
              <View style={styles.statusPill}>
                <View
                  style={[
                    styles.statusPillDot,
                    { backgroundColor: isRecording ? COLORS.ruby : COLORS.emerald },
                  ]}
                />
                <Text style={styles.statusPillText}>
                  {isRecording ? `Recording 00:0${recordingSeconds} / 00:03` : 'Ready to record'}
                </Text>
              </View>

              {/* Shutter Button */}
              <View style={styles.shutterRow}>
                <TouchableOpacity
                  onPress={handleRecordPress}
                  activeOpacity={0.85}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? 'Stop recording sign' : 'Start recording sign (3 seconds)'}
                  style={styles.shutterTouch}
                >
                  <Animated.View
                    style={[
                      styles.shutterOuterRing,
                      isRecording && styles.shutterOuterRingActive,
                      { transform: [{ scale: isRecording ? pulseAnim : 1 }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.shutterInner,
                        isRecording && styles.shutterInnerActive,
                      ]}
                    />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Label */}
              <Text style={styles.shutterLabel}>
                {isRecording ? 'TAP TO FINISH EARLY' : 'RECORD SIGN (3s)'}
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
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  desktopWrapper: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADII.xl,
    backgroundColor: COLORS.stage,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    minHeight: 40,
  },
  backButtonText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  flipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    minHeight: 40,
  },
  flipButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  controlDisabled: {
    opacity: 0.4,
  },
  // Camera Stage
  cameraStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cameraFrame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCamera: {
    width: '100%',
    height: '100%',
  },
  // Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 8, 13, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  countdownBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownNumber: {
    ...TYPOGRAPHY.h1,
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 52,
  },
  countdownHint: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  countdownCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  countdownCancelText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  // Control Deck
  controlDeck: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    zIndex: 20,
  },
  shutterDeck: {
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADII.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 16,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  statusPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  shutterTouch: {
    padding: 6,
  },
  shutterOuterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterOuterRingActive: {
    borderColor: COLORS.ruby,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  shutterInnerActive: {
    width: 26,
    height: 26,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.ruby,
  },
  shutterLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.textMuted,
  },
  // Processing Card
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderRadius: RADII.lg,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    ...SHADOWS.card,
  },
  processingTextGroup: {
    marginLeft: 14,
    flex: 1,
  },
  processingTitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  processingSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Result Card
  resultCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    ...SHADOWS.card,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  resultStatusLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.textMuted,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  copyButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: 5,
  },
  resultText: {
    ...TYPOGRAPHY.h2,
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 32,
    marginBottom: 6,
  },
  resultHint: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  uncertainAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  uncertainHeading: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: RADII.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.emerald,
    borderWidth: 1,
    borderColor: COLORS.emeraldLight,
  },
  actionBtnPrimaryText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textInverse,
    marginLeft: 6,
  },
  actionBtnSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  actionBtnSecondaryText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 6,
  },
  // Permission & Fallback
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  permissionCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.xl,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    maxWidth: 400,
    width: '100%',
    ...SHADOWS.card,
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  permDesc: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryActionButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: RADII.md,
    backgroundColor: COLORS.emerald,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.emeraldLight,
  },
  primaryActionText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  secondaryActionButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: RADII.md,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  webPermNotice: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.amber,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  permError: {
    ...TYPOGRAPHY.caption,
    color: COLORS.ruby,
    marginTop: 12,
    textAlign: 'center',
  },
});
