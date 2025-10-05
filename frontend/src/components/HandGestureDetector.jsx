import React, { useRef, useEffect, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function HandGestureDetector({ 
  videoRef, 
  onGestureDetected, 
  isActive 
}) {
  const [handLandmarker, setHandLandmarker] = useState(null);
  const [gestureState, setGestureState] = useState({
    isClosedFist: false,
    gestureStartTime: null,
    gestureProgress: 0
  });

  const lastVideoTimeRef = useRef(-1);
  const runningModeRef = useRef("IMAGE");
  const rafId = useRef(null);

  // Load HandLandmarker model
  useEffect(() => {
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "IMAGE",
          numHands: 2,
        });
        setHandLandmarker(landmarker);
        console.log("HandLandmarker loaded successfully");
      } catch (error) {
        console.error("Failed to load HandLandmarker:", error);
      }
    })();
  }, []);

  // Detect closed fist gesture
  const detectClosedFist = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return false;

    const hand = landmarks[0]; // Use first detected hand
    
    // Hand landmark indices (MediaPipe hand model)
    const THUMB_TIP = 4;
    const INDEX_TIP = 8, INDEX_PIP = 6;
    const MIDDLE_TIP = 12, MIDDLE_PIP = 10;
    const RING_TIP = 16, RING_PIP = 14;
    const PINKY_TIP = 20, PINKY_PIP = 18;
    const WRIST = 0;

    // Check if fingers are curled down (tips below middle joints)
    const isIndexCurled = hand[INDEX_TIP].y > hand[INDEX_PIP].y;
    const isMiddleCurled = hand[MIDDLE_TIP].y > hand[MIDDLE_PIP].y;
    const isRingCurled = hand[RING_TIP].y > hand[RING_PIP].y;
    const isPinkyCurled = hand[PINKY_TIP].y > hand[PINKY_PIP].y;

    // Check thumb (different logic as it moves horizontally)
    const isThumbCurled = Math.abs(hand[THUMB_TIP].x - hand[WRIST].x) < 
                         Math.abs(hand[INDEX_PIP].x - hand[WRIST].x);

    // All fingers must be curled for closed fist
    return isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && isThumbCurled;
  };

  // Process hand detection
  const processHandDetection = async () => {
    if (!handLandmarker || !videoRef.current || !isActive) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    // Switch to VIDEO mode once
    if (runningModeRef.current === "IMAGE") {
      runningModeRef.current = "VIDEO";
      await handLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    const currentTime = video.currentTime;
    if (lastVideoTimeRef.current !== currentTime) {
      lastVideoTimeRef.current = currentTime;
      
      try {
        const startTimeMs = performance.now();
        const results = handLandmarker.detectForVideo(video, startTimeMs);
        const isClosedFist = detectClosedFist(results.landmarks);
        
        const now = Date.now();
        const REQUIRED_DURATION = 5000; // 5 seconds

        if (isClosedFist) {
          if (!gestureState.isClosedFist) {
            // Gesture just started
            console.log("Closed fist detected, starting timer...");
            setGestureState({
              isClosedFist: true,
              gestureStartTime: now,
              gestureProgress: 0
            });
          } else {
            // Gesture continuing
            const elapsed = now - gestureState.gestureStartTime;
            const progress = Math.min(elapsed / REQUIRED_DURATION, 1);
            
            setGestureState(prev => ({
              ...prev,
              gestureProgress: progress
            }));

            // Trigger action when gesture is held for 5 seconds
            if (elapsed >= REQUIRED_DURATION && progress >= 1) {
              console.log("5-second closed fist completed! Starting Pomodoro...");
              onGestureDetected('START_POMODORO');
              // Reset gesture state
              setGestureState({
                isClosedFist: false,
                gestureStartTime: null,
                gestureProgress: 0
              });
            }
          }
        } else {
          // No closed fist detected, reset
          if (gestureState.isClosedFist) {
            console.log("Closed fist released, resetting...");
            setGestureState({
              isClosedFist: false,
              gestureStartTime: null,
              gestureProgress: 0
            });
          }
        }
      } catch (error) {
        console.error("Hand detection error:", error);
      }
    }

    if (isActive) {
      rafId.current = requestAnimationFrame(processHandDetection);
    }
  };

  // Start/stop hand detection
  useEffect(() => {
    if (isActive && handLandmarker) {
      processHandDetection();
    } else {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    }

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [isActive, handLandmarker]);

  // Render gesture progress indicator
  if (!isActive || !gestureState.isClosedFist) return null;

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30">
      <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-4 border border-white/20 animate-in slide-in-from-top-4 duration-300">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3 relative">
            {/* Circular progress */}
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="4"
              />
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#10B981"
                strokeWidth="4"
                strokeDasharray={`${gestureState.gestureProgress * 219.9} 219.9`}
                strokeLinecap="round"
                className="transition-all duration-100"
              />
            </svg>
            
            {/* Fist icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-2xl animate-pulse">✊</div>
            </div>
          </div>
          
          <p className="text-white text-sm font-medium mb-1">
            Hold Closed Fist
          </p>
          <p className="text-emerald-400 text-xs font-mono">
            {Math.ceil((1 - gestureState.gestureProgress) * 5)}s remaining
          </p>
        </div>
      </div>
    </div>
  );
}