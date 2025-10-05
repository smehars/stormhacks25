import React, { useRef, useEffect, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import PomodoroTimer from "./PomodoroTimer";
import PostureFeedback from "./PostureFeedback";

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
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [postureData, setPostureData] = useState(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false); // Default to expanded (false)

  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = webcamRunning;
  }, [webcamRunning]);

  const runningModeRef = useRef("IMAGE");
  const lastVideoTimeRef = useRef(-1);
  const rafId = useRef(null);

  const SELECTED_LANDMARKS = {
    NOSE: 0,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12
  };

  useEffect(() => {
    (async () => {
      const wasm = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
      const landmarker = await PoseLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO", // Start in VIDEO mode
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.8,
      });
      setPoseLandmarker(landmarker);
    })();
  }, []);

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
    setPostureData(null);
  };

  const startCamera = async () => {
    if (!poseLandmarker) return;
    setWebcamRunning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      video.srcObject = stream;

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

    const vw = video.videoWidth || 480,
      vh = video.videoHeight || 360;
    if (canvas.width !== vw) canvas.width = vw;
    if (canvas.height !== vh) canvas.height = vh;
    
    if (runningModeRef.current === "IMAGE") {
      runningModeRef.current = "VIDEO";
      await poseLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    const ts = performance.now();
    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;
      const res = await poseLandmarker.detectForVideo(video, ts);
      if (res.landmarks?.length) {
        const landmarks = res.landmarks[0];
        
        // Send to backend and update posture data
        const analysis = await sendLandmarksToBackend(res.landmarks[0]);
        if (analysis) {
          //console.log("Posture result:", analysis);
          setPostureData(analysis); // Update state with analysis data
        }
      }

      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (res.landmarks?.length) {
        const landmarks = res.landmarks[0];
        
        Object.values(SELECTED_LANDMARKS).forEach(index => {
          const landmark = landmarks[index];
          if (landmark && landmark.visibility > 0.5) {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = "#EF4444";
            ctx.fill();
            ctx.strokeStyle = "#FEE2E2";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.font = "12px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(index.toString(), x + 8, y - 8);
          }
        });

        const drawConnection = (fromIndex, toIndex) => {
          const from = landmarks[fromIndex];
          const to = landmarks[toIndex];
          if (from && to && from.visibility > 0.7 && to.visibility > 0.7) {
            ctx.beginPath();
            ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
            ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
            ctx.strokeStyle = "#10B981";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        };

        const drawShoulderMidpointToNose = () => {
          const leftShoulder = landmarks[SELECTED_LANDMARKS.LEFT_SHOULDER];
          const rightShoulder = landmarks[SELECTED_LANDMARKS.RIGHT_SHOULDER];
          const nose = landmarks[SELECTED_LANDMARKS.NOSE];

          if (leftShoulder && rightShoulder && nose &&
            leftShoulder.visibility > 0.7 && rightShoulder.visibility > 0.7 && nose.visibility > 0.7) {
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

        drawConnection(SELECTED_LANDMARKS.NOSE, SELECTED_LANDMARKS.LEFT_EAR);
        drawConnection(SELECTED_LANDMARKS.NOSE, SELECTED_LANDMARKS.RIGHT_EAR);
        drawConnection(SELECTED_LANDMARKS.LEFT_SHOULDER, SELECTED_LANDMARKS.RIGHT_SHOULDER);
        drawShoulderMidpointToNose();
      }
      ctx.restore();
    }

    if (runningRef.current) rafId.current = requestAnimationFrame(predictWebcam);
  };

  // Add calibrate function
  const calibrateNeutral = async () => {
    if (!postureData?.raw_angle_deg) return;
    
    try {
      const response = await fetch("http://localhost:3000/calibrate", {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify({ angle_deg: postureData.raw_angle_deg }),
      });
      
      if (response.ok) {
        const data = await response.json();
      } else {
        console.error("Calibration failed:", response.status);
      }
    } catch (err) {
      console.error("Failed to calibrate:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Full-screen video background */}
      <video 
        ref={videoRef} 
        muted 
        playsInline 
        autoPlay 
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          transform: webcamRunning ? 'scaleX(-1)' : 'none'
        }}
      />
      
      {/* Full-screen canvas overlay for landmarks */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ 
          transform: webcamRunning ? 'scaleX(-1)' : 'none'
        }}
      />

      {/* Dark overlay when camera is off */}
      {!webcamRunning && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
          <div className="text-center text-white">
            <svg className="w-24 h-24 mx-auto mb-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="text-2xl opacity-75 mb-4">Camera Off</p>
            <p className="text-lg opacity-50">Start analysis to begin posture tracking</p>
          </div>
        </div>
      )}

      {/* Floating Pomodoro Timer - Right Side */}
      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20">
        <div className={`transition-all duration-300 ease-in-out ${
          showPomodoro ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          {showPomodoro && <PomodoroTimer />}
        </div>
        
        {/* Toggle Button */}
        <Button
          onClick={() => setShowPomodoro(!showPomodoro)}
          className={`absolute ${showPomodoro ? '-left-12' : '-left-12'} top-1/2 transform -translate-y-1/2 
            w-10 h-16 rounded-l-xl rounded-r-none bg-gradient-to-b from-blue-500/90 to-teal-500/90 
hover:from-blue-600/90 hover:to-teal-600/90 hover:backdrop-blur-sm border-r-0 
            flex items-center justify-center transition-all duration-300`}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </Button>
      </div>

      {/* Floating UI Controls - Top */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Lock In</h1>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${poseLandmarker ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}></div>
              <Badge variant="outline" className="px-3 py-1 bg-black/50 border-white/20 text-white">
                Skeleton Model: {poseLandmarker ? "Ready" : "Loading..."}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Square Posture Panel - Top Left */}
      {webcamRunning && postureData && (
        <div className={`absolute top-24 left-6 bg-black/70 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all duration-300 z-10 ${
          panelCollapsed ? 'w-16 h-16 p-2' : 'w-80 p-4'
        }`}>
          
          {/* Panel Header with Status Circle and Minimize Button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                postureData.state === 'good_posture' ? 'bg-green-500' : 
                postureData.state === 'bad_posture' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              {!panelCollapsed && <h3 className="text-lg font-semibold">Posture Analysis</h3>}
            </div>
            
            {/* Minimize/Expand Button */}
            <Button
              onClick={() => setPanelCollapsed(!panelCollapsed)}
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10 h-6 w-6 rounded-full p-0"
            >
              {panelCollapsed ? (
                // Expand icon (plus)
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              ) : (
                // Minimize icon (minus)
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                </svg>
              )}
            </Button>
          </div>
          
          {/* Panel Content - Only show when not collapsed */}
          {!panelCollapsed && (
            <div className="space-y-3">
              {/* Posture Status */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">Status:</span>
                <Badge 
                  variant={postureData.state === 'good_posture' ? 'default' : 'destructive'} 
                  className={`px-2 py-1 ${
                    postureData.state === 'good_posture' 
                      ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                      : postureData.state === 'bad_posture'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}
                >
                  {postureData.state?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                </Badge>
              </div>

              {/* Issue/Reason */}
              <div className="pt-2 border-t border-white/10">
                <span className="text-xs text-white/50">Issue: </span>
                <span className="text-xs text-white/80 capitalize">
                  {postureData.reason?.replace('_', ' ') || 'None detected'}
                </span>
              </div>

              {/* AI Feedback Section */}
              <div className="pt-2 border-t border-white/10">
                <PostureFeedback 
                  postureData={postureData} 
                  isVisible={webcamRunning} 
                  isEmbedded={true}
                />
              </div>
            </div>
          )}

          {/* Collapsed State - REMOVED the middle badge content */}
          {/* When collapsed, only the header row with dot + button shows */}
        </div>
      )}

      {/* Floating UI Controls - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-center gap-4">
          {/* Main Start/Stop Button */}
          <Button
            onClick={enableCam}
            disabled={!poseLandmarker}
            className={`px-8 py-4 text-lg rounded-full shadow-lg transition-all duration-300 ${
              webcamRunning
                ? "bg-red-500/90 hover:bg-red-600/90 text-white backdrop-blur-sm"
                : "bg-gradient-to-r from-teal-500/90 to-blue-500/90 hover:from-teal-600/90 hover:to-blue-600/90 text-white backdrop-blur-sm"
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

          {/* Calibrate Button - Always show when webcam is running and we have posture data */}
          {webcamRunning && postureData && (
            <Button
              onClick={calibrateNeutral}
              className="px-6 py-4 text-lg rounded-full shadow-lg transition-all duration-300 bg-purple-500/90 hover:bg-purple-600/90 text-white backdrop-blur-sm"
              size="lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                />
              </svg>
              Calibrate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
