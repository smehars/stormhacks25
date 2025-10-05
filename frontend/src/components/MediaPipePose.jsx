import React, { useRef, useEffect, useState } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

async function sendLandmarksToBackend(landmarks) {
  const formattedLandmarks = landmarks.map((lm, idx) => ({
    idx,
    x: lm.x,
    y: lm.y,
    z: lm.z ?? 0.0,
    visibility: lm.visibility ?? 1.0,
  }));

  try {
    const response = await fetch("http://localhost:3000/analyze_posture", {
      method: "POST",
      headers: {"Content-Type": "application/json" },
      body: JSON.stringify({ landmarks: formattedLandmarks }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Posture analysis:", data);
      return data;
    } else {
      console.error("Backend error:", response.status);
      return null;
    }
  } catch (err) {
    console.error("Failed to send posture data:", err);
    return null;
  }
}

export default function MediaPipePose() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(false);

  // read/write flag safely inside rAF loop
  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = webcamRunning;
  }, [webcamRunning]);

  const runningModeRef = useRef("IMAGE");
  const lastVideoTimeRef = useRef(-1);
  let rafId = useRef(null);

  // Define the landmarks we want to show
  const SELECTED_LANDMARKS = {
    NOSE: 0,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12
  };

  // Loading the model via Googles API
  useEffect(() => {
    (async () => {
      const wasm = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
      const landmarker = await PoseLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 2,
      });
      setPoseLandmarker(landmarker);
    })();
  }, []);

  // Turn off our UI flagg and set the live video stream back to a Image
  const stopCamera = () => {
    setWebcamRunning(false);
    runningModeRef.current = "IMAGE";
    lastVideoTimeRef.current = -1;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    const v = videoRef.current;
    if (v?.srcObject) {
      for (const t of v.srcObject.getTracks()) t.stop();
      v.srcObject = null;
    }
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };

  const startCamera = async () => {
    if (!poseLandmarker) return;
    setWebcamRunning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      video.srcObject = stream;

      // start after metadata so videoWidth/Height are known
      const start = async () => {
        await video.play().catch(() => {});
        predictWebcam();
      };
      if (video.readyState >= 2) start();
      else video.addEventListener("loadedmetadata", start, { once: true });
    } catch (e) {
      console.error(e);
      setWebcamRunning(false);
    }
  };

  const enableCam = () => {
    if (!poseLandmarker) return;
    if (runningRef.current) stopCamera();
    else startCamera();
  };

  const predictWebcam = async () => {
    const video = videoRef.current,
      canvas = canvasRef.current;
    if (!video || !canvas || !poseLandmarker) return;
    if (!runningRef.current) return;

    // size canvas to the actual video frame
    const vw = video.videoWidth || 480,
      vh = video.videoHeight || 360;
    if (canvas.width !== vw) canvas.width = vw;
    if (canvas.height !== vh) canvas.height = vh;

    // switch to VIDEO mode once
    if (runningModeRef.current === "IMAGE") {
      runningModeRef.current = "VIDEO";
      await poseLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    const ts = performance.now();
    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;
      const res = await poseLandmarker.detectForVideo(video, ts);
      if (res.landmarks?.length) {
        // Log only the selected landmarks
        const landmarks = res.landmarks[0];
        console.log("Selected Landmarks:", {
          nose: landmarks[SELECTED_LANDMARKS.NOSE],
          leftEar: landmarks[SELECTED_LANDMARKS.LEFT_EAR],
          rightEar: landmarks[SELECTED_LANDMARKS.RIGHT_EAR],
          leftShoulder: landmarks[SELECTED_LANDMARKS.LEFT_SHOULDER],
          rightShoulder: landmarks[SELECTED_LANDMARKS.RIGHT_SHOULDER]
        });

        const analysis = await sendLandmarksToBackend(res.landmarks[0]);
        if (analysis) {
          console.log("Posture result:", analysis);
        }
      }

      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (res.landmarks?.length) {
        const landmarks = res.landmarks[0];
        
        // Draw only the selected landmarks
        Object.values(SELECTED_LANDMARKS).forEach(index => {
          const landmark = landmarks[index];
          if (landmark && landmark.visibility > 0.5) {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            
            // Draw landmark point
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = "#EF4444"; // Red
            ctx.fill();
            ctx.strokeStyle = "#FEE2E2"; // Light red border
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw landmark label
            ctx.font = "12px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(index.toString(), x + 8, y - 8);
          }
        });

        // Draw connections between specific landmarks
        const drawConnection = (fromIndex, toIndex) => {
          const from = landmarks[fromIndex];
          const to = landmarks[toIndex];
          if (from && to && from.visibility > 0.5 && to.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
            ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
            ctx.strokeStyle = "#10B981"; // Emerald green
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        };

        const drawShoulderMidpointToNose = () => {
          const leftShoulder = landmarks[SELECTED_LANDMARKS.LEFT_SHOULDER];
          const rightShoulder = landmarks[SELECTED_LANDMARKS.RIGHT_SHOULDER];
          const nose = landmarks[SELECTED_LANDMARKS.NOSE];

          if (leftShoulder && rightShoulder && nose &&
            leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5 && nose.visibility > 0.5) {
              const midX = (leftShoulder.x + rightShoulder.x) / 2;
              const midY = (leftShoulder.y + rightShoulder.y) / 2;
              ctx.beginPath();
              ctx.moveTo(midX * canvas.width, midY * canvas.height);
              ctx.lineTo(nose.x * canvas.width, nose.y * canvas.height);
              ctx.strokeStyle = "#3B82F6";
              ctx.lineWidth = 3;
              ctx.stroke();
            }
        };

        // Draw connections: nose to ears, ears to shoulders
        drawConnection(SELECTED_LANDMARKS.NOSE, SELECTED_LANDMARKS.LEFT_EAR);
        drawConnection(SELECTED_LANDMARKS.NOSE, SELECTED_LANDMARKS.RIGHT_EAR);
        //drawConnection(SELECTED_LANDMARKS.LEFT_EAR, SELECTED_LANDMARKS.LEFT_SHOULDER);
        //drawConnection(SELECTED_LANDMARKS.RIGHT_EAR, SELECTED_LANDMARKS.RIGHT_SHOULDER);
        drawConnection(SELECTED_LANDMARKS.LEFT_SHOULDER, SELECTED_LANDMARKS.RIGHT_SHOULDER);
        drawShoulderMidpointToNose();
      }
      ctx.restore();
    }

    if (runningRef.current) rafId.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-teal-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Live Posture Analysis</h2>
        <p className="text-slate-600">Position yourself in front of the camera for real-time posture tracking</p>
      </div>

      {/* Control Button */}
      <div className="text-center mb-8">
        <Button
          onClick={enableCam}
          disabled={!poseLandmarker}
          className={`px-8 py-4 text-lg rounded-full shadow-lg transition-all duration-300 ${
            webcamRunning
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white"
          }`}
          size="lg"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {webcamRunning ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
          {webcamRunning ? "Stop Analysis" : "Start Analysis"}
        </Button>
      </div>

      {/* Video Container */}
      <div className="relative flex justify-center mb-6">
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          <video ref={videoRef} muted playsInline autoPlay style={{ width: 640, height: 480, display: "block" }} className="rounded-2xl" />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: 640,
              height: 480,
              pointerEvents: "none",
            }}
            className="rounded-2xl"
          />

          {/* Overlay when camera is off */}
          {!webcamRunning && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 rounded-2xl">
              <div className="text-center text-white">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-lg opacity-75">Camera Preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${webcamRunning ? "bg-green-500" : "bg-red-500"}`}></div>
          <Badge variant={webcamRunning ? "default" : "secondary"} className="px-3 py-1">
            {webcamRunning ? "Recording" : "Stopped"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${poseLandmarker ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}></div>
          <Badge variant={poseLandmarker ? "default" : "outline"} className="px-3 py-1">
            AI Model: {poseLandmarker ? "Ready" : "Loading..."}
          </Badge>
        </div>
      </div>

      {/* Instructions */}
      {webcamRunning && (
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Analysis Active</h4>
              <p className="text-blue-700 text-sm">
                Red dots show key landmarks with green connecting lines.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
