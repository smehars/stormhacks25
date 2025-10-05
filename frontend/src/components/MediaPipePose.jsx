import React, { useRef, useEffect, useState } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export default function MediaPipePose() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(false);

  // read/write flag safely inside rAF loop
  const runningRef = useRef(false);
  useEffect(() => { runningRef.current = webcamRunning; }, [webcamRunning]);

  const runningModeRef = useRef("IMAGE");
  const lastVideoTimeRef = useRef(-1);
  let rafId = useRef(null);

  // Loading the model via Googles API
  useEffect(() => {
    (async () => {
      const wasm = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
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


  // 
  const predictWebcam = async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !poseLandmarker) return;
    if (!runningRef.current) return;

    // size canvas to the actual video frame
    const vw = video.videoWidth || 480, vh = video.videoHeight || 360;
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

      const ctx = canvas.getContext("2d");
      const utils = new DrawingUtils(ctx);
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (res.landmarks?.length) {
        for (const lm of res.landmarks) {
          // class static: guaranteed to exist in JS API
          utils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { lineWidth: 2 });
          utils.drawLandmarks(lm, { radius: 3 });
        }
      }
      ctx.restore();
    }

    if (runningRef.current) rafId.current = requestAnimationFrame(predictWebcam);
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
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{ width: 480, height: 360, display: "block", background: "#000" }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: 480,
              height: 360,
              pointerEvents: "none",
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
}
