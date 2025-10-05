import React, { useRef, useEffect, useState } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const MediaPipePose = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const runningModeRef = useRef("IMAGE");
  const lastVideoTimeRef = useRef(-1);

  // Initialize MediaPipe Pose Landmarker
  useEffect(() => {
    const createPoseLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 2,
      });

      setPoseLandmarker(landmarker);
    };

    createPoseLandmarker();
  }, []);

  // Enable/disable webcam
  const enableCam = async () => {
    if (!poseLandmarker) {
      console.log("Wait! poseLandmarker not loaded yet.");
      return;
    }

    if (webcamRunning === true) {
      setWebcamRunning(false);
      // Reset state
      runningModeRef.current = "IMAGE";
      lastVideoTimeRef.current = -1;

      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      setWebcamRunning(true);

      // Start video stream
      const constraints = { video: true };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      } catch (error) {
        console.error("Error accessing camera:", error);
        setWebcamRunning(false);
      }
    }
  };

  // Main prediction loop
  const predictWebcam = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !poseLandmarker || !webcamRunning) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;

    // Switch to VIDEO mode if needed
    if (runningModeRef.current === "IMAGE") {
      runningModeRef.current = "VIDEO";
      await poseLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    const startTimeMs = performance.now();

    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        // Detect poses
        const results = await poseLandmarker.detectForVideo(video, startTimeMs);

        // Draw results
        const canvasCtx = canvas.getContext("2d");
        const drawingUtils = new DrawingUtils(canvasCtx);

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw pose landmarks if detected
        if (results.landmarks && results.landmarks.length > 0) {
          for (const landmarks of results.landmarks) {
            // Draw connections (skeleton)
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
              color: "#00FF00",
              lineWidth: 2,
            });

            // Draw landmarks (points)
            drawingUtils.drawLandmarks(landmarks, {
              color: "#FF0000",
              radius: 3,
            });
          }
        }

        canvasCtx.restore();
      } catch (error) {
        console.error("Prediction error:", error);
      }
    }

    // Continue prediction loop
    if (webcamRunning) {
      requestAnimationFrame(predictWebcam);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">MediaPipe Pose Detection</h2>

      <div className="mb-4 text-center">
        <Button onClick={enableCam} disabled={!poseLandmarker} variant={webcamRunning ? "destructive" : "default"} size="lg">
          {webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS"}
        </Button>
      </div>

      <div className="relative flex justify-center mb-4">
        <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg">
          <video ref={videoRef} autoPlay muted playsInline style={{ width: "480px", height: "360px" }} />
          <canvas
            ref={canvasRef}
            width="480"
            height="360"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "480px",
              height: "360px",
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <Badge variant={webcamRunning ? "default" : "secondary"}>Status: {webcamRunning ? "Running" : "Stopped"}</Badge>
        <Badge variant={poseLandmarker ? "default" : "outline"}>Model: {poseLandmarker ? "Ready" : "Loading..."}</Badge>
      </div>
    </div>
  );
};

export default MediaPipePose;
