/**
 * SignVision Real-Time Hand Landmark Tracking Service
 * 
 * Runs MediaPipe HandLandmarker in VIDEO running mode on web.
 * Provides normalized (x, y, z) 21-keypoint landmarks for up to 2 visible hands.
 */

import { Platform } from 'react-native';

export interface NormalizedLandmark {
  x: number; // 0.0 to 1.0 (relative to image width)
  y: number; // 0.0 to 1.0 (relative to image height)
  z: number;
}

export type HandLandmarkList = NormalizedLandmark[];

// 21 Anatomical MediaPipe Connections
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger & knuckle arch
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger & knuckle arch
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky & knuckle arch
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [0, 17],
];

class HandTrackingService {
  private landmarker: any = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;
  private lastVideoTime: number = -1;
  private lastDetectTimestamp: number = 0;

  public async initialize(): Promise<boolean> {
    if (Platform.OS !== 'web') {
      // Native platforms offload frame inference to video-service
      return false;
    }

    if (this.isReady && this.landmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      // Load @mediapipe/tasks-vision dynamically in browser to bypass Metro bundler AST restrictions
      const loadBrowserModule = new Function('url', 'return import(url)');
      const vision = await loadBrowserModule('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18');
      const { FilesetResolver, HandLandmarker } = vision;

      const visionWasm = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.landmarker = await HandLandmarker.createFromOptions(visionWasm, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isReady = true;
      console.log('[HandTrackingService] MediaPipe HandLandmarker initialized successfully.');
      return true;
    } catch (err) {
      console.warn('[HandTrackingService] Failed to initialize MediaPipe HandLandmarker:', err);
      this.isReady = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  public detect(videoElement: HTMLVideoElement | null): HandLandmarkList[] {
    if (Platform.OS !== 'web' || !this.isReady || !this.landmarker || !videoElement) {
      return [];
    }

    try {
      if (videoElement.readyState < 2) return [];

      const now = performance.now();
      // Throttle detection to ~30 FPS (every 33ms) to preserve CPU/GPU
      if (now - this.lastDetectTimestamp < 33) {
        return [];
      }

      if (videoElement.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = videoElement.currentTime;
        this.lastDetectTimestamp = now;

        const results = this.landmarker.detectForVideo(videoElement, Math.round(now));
        if (results && results.landmarks && results.landmarks.length > 0) {
          return results.landmarks as HandLandmarkList[];
        }
      }
    } catch (err) {
      // Occasional frame sync error during stream resize/flip is safely caught
    }

    return [];
  }

  public dispose() {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (e) {
        // Safe disposal
      }
      this.landmarker = null;
    }
    this.isReady = false;
    this.isInitializing = false;
  }
}

export const handTrackingService = new HandTrackingService();
