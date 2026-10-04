import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LM, GOOD_THRESHOLD, buildBaseline, measure, score } from "@/lib/posture";
import { newSession, recordSecond } from "@/lib/analytics";
import { loadSessions, saveSessions } from "@/lib/storage";
import { chime, notify } from "@/lib/alerts";

const WASM_URL = `${import.meta.env.BASE_URL}mediapipe`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

const TICK_MS = 80;
const CALIBRATION_COUNTDOWN_MS = 3000;
const CALIBRATION_CAPTURE_MS = 2500;
const AWAY_AFTER_MS = 1500;
const MIN_SESSION_SEC = 10;

// Background tabs throttle requestAnimationFrame and main-thread timers, which
// would stop tracking the moment you switch to your editor. Worker timers keep
// ticking, so the detection loop is driven from one. The worker waits for each
// frame to finish before scheduling the next, so slow machines never pile up work.
function createTicker(ms, onTick) {
  const src = `let id=null;onmessage=e=>{clearTimeout(id);if(e.data>0)id=setTimeout(()=>postMessage(0),e.data)}`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const worker = new Worker(url);
  let stopped = false;
  worker.onmessage = () => {
    if (stopped) return;
    const started = performance.now();
    try {
      onTick();
    } finally {
      if (!stopped) worker.postMessage(Math.max(10, ms - (performance.now() - started)));
    }
  };
  worker.postMessage(ms);
  return () => {
    stopped = true;
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await PoseLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return await PoseLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

const COLORS = { good: "#22c55e", bad: "#ef4444", away: "#a1a1aa", calibrating: "#60a5fa" };

function drawOverlay(canvas, landmarks, state) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const w = canvas.width;
  const h = canvas.height;
  const p = (i) => landmarks[i] && (landmarks[i].visibility ?? 1) > 0.5 && { x: landmarks[i].x * w, y: landmarks[i].y * h };
  const color = COLORS[state] ?? COLORS.away;
  const ls = p(LM.LEFT_SHOULDER);
  const rs = p(LM.RIGHT_SHOULDER);
  const le = p(LM.LEFT_EAR);
  const re = p(LM.RIGHT_EAR);
  const nose = p(LM.NOSE);

  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, w / 220);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  const line = (a, b) => {
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  line(ls, rs);
  line(le, re);
  if (ls && rs) {
    const head = le && re ? { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 } : nose;
    line({ x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }, head);
  }
  ctx.shadowBlur = 0;
  for (const pt of [ls, rs, le, re, nose]) {
    if (!pt) continue;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(5, w / 160), 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

/**
 * Owns the camera, the pose model and the live session.
 *
 * status: loading → ready → calibrating → tracking (→ ready on stop)
 */
export function usePostureTracker({ settings, baseline, onBaseline, onAlert }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [live, setLive] = useState({ score: null, state: "away", issue: null, goodRun: 0, badRun: 0 });
  const [calibration, setCalibration] = useState(null); // { phase, progress }
  const [session, setSession] = useState(null);
  const [sessions, setSessions] = useState(loadSessions);

  const r = useRef({}).current; // mutable loop state
  r.settings = settings;
  r.baseline = baseline;
  r.onBaseline = onBaseline;
  r.onAlert = onAlert;

  useEffect(() => {
    let cancelled = false;
    createLandmarker()
      .then((lm) => {
        if (cancelled) return lm.close();
        r.landmarker = lm;
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setError("Couldn't load the pose model. Check your connection and reload.");
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
      r.landmarker?.close();
    };
  }, [r]);

  const persist = useCallback((s, { final = false } = {}) => {
    setSessions((prev) => {
      const others = prev.filter((x) => x.id !== s.id);
      const keep = s.good + s.bad >= MIN_SESSION_SEC || !final;
      const next = keep ? [...others, s] : others;
      saveSessions(next);
      return next;
    });
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !r.landmarker || video.readyState < 2) return;
    if (video.currentTime === r.lastVideoTime) return;
    r.lastVideoTime = video.currentTime;

    const now = performance.now();
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    let landmarks = null;
    try {
      landmarks = r.landmarker.detectForVideo(video, now).landmarks?.[0] ?? null;
    } catch (e) {
      console.warn(e);
    }
    const m = measure(landmarks, w, h);
    if (m) r.lastSeen = now;

    // Calibration: countdown, then collect upright frames.
    if (r.mode === "calibrating") {
      const elapsed = now - r.calStart;
      if (elapsed < CALIBRATION_COUNTDOWN_MS) {
        setCalibration({ phase: "countdown", seconds: Math.ceil((CALIBRATION_COUNTDOWN_MS - elapsed) / 1000), visible: !!m });
      } else {
        if (m) r.calSamples.push(m);
        const progress = Math.min(1, (elapsed - CALIBRATION_COUNTDOWN_MS) / CALIBRATION_CAPTURE_MS);
        setCalibration({ phase: "capture", progress, visible: !!m });
        if (progress >= 1) {
          const base = buildBaseline(r.calSamples);
          if (base) {
            r.onBaseline(base);
            r.baseline = base;
            beginTracking();
          } else {
            r.calStart = now;
            r.calSamples = [];
            setCalibration({ phase: "retry", seconds: 3, visible: false });
          }
        }
      }
      if (r.settings.showSkeleton) drawOverlay(canvas, landmarks, "calibrating");
      else canvas.getContext("2d").clearRect(0, 0, w, h);
      return;
    }

    if (r.mode !== "tracking") return;

    // Live scoring with smoothing and hysteresis so the state doesn't flicker.
    const away = !m || now - (r.lastSeen ?? 0) > AWAY_AFTER_MS;
    let state = r.state;
    let issue = r.issue;
    if (m) {
      const res = score(m, r.baseline, r.settings.sensitivity);
      r.ema = r.ema == null ? res.score : r.ema * 0.8 + res.score * 0.2;
      issue = res.issue;
      if (r.state !== "good" && r.ema >= GOOD_THRESHOLD + 3) state = "good";
      else if (r.state !== "bad" && r.ema < GOOD_THRESHOLD - 3) state = "bad";
      else if (r.state === "away") state = r.ema >= GOOD_THRESHOLD ? "good" : "bad";
    }
    if (away && now - (r.lastSeen ?? 0) > AWAY_AFTER_MS) state = "away";
    r.state = state;
    r.issue = state === "bad" ? issue : null;

    if (r.settings.showSkeleton) drawOverlay(canvas, landmarks, state);
    else canvas.getContext("2d").clearRect(0, 0, w, h);

    // Commit one second at a time to the session.
    while (now - r.lastSecond >= 1000) {
      r.lastSecond += 1000;
      if (state === "good") {
        r.goodRun++;
        r.badRun = 0;
      } else if (state === "bad") {
        r.badRun++;
        r.goodRun = 0;
      }
      if (state !== "away") r.sinceBreak++;

      const code = state === "good" ? "g" : state === "bad" ? "b" : "a";
      r.session = recordSecond(r.session, code, state === "away" ? null : Math.round(r.ema), r.goodRun);

      const alertAfter = r.settings.alertAfterSec;
      if (state === "bad" && r.badRun >= alertAfter && (r.badRun - alertAfter) % 60 === 0) {
        r.session = { ...r.session, alerts: r.session.alerts + 1 };
        if (r.settings.sound) chime("alert");
        if (r.settings.notifications) notify("Sit up straight", "You've been slouching for a while. Reset your posture.");
        r.onAlert?.("slouch");
      }
      if (r.settings.breakEveryMin > 0 && r.sinceBreak >= r.settings.breakEveryMin * 60) {
        r.sinceBreak = 0;
        if (r.settings.sound) chime("break");
        if (r.settings.notifications) notify("Time for a break", "Stand up, stretch, and rest your eyes for a minute.");
        r.onAlert?.("break");
      }
      setSession(r.session);
      if (r.session.segments.length && (r.session.good + r.session.bad + r.session.away) % 10 === 0) persist(r.session);
    }

    if (now - (r.lastUi ?? 0) > 200) {
      r.lastUi = now;
      setLive({
        score: state === "away" || r.ema == null ? null : Math.round(r.ema),
        state,
        issue: r.issue,
        goodRun: r.goodRun,
        badRun: r.badRun,
      });
    }
    // beginTracking is a stable function declared below; the loop reads it lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, r]);

  function beginTracking() {
    r.mode = "tracking";
    r.ema = null;
    r.state = "away";
    r.issue = null;
    r.goodRun = 0;
    r.badRun = 0;
    r.lastSecond = performance.now();
    if (!r.session) {
      r.session = newSession();
      r.sinceBreak = 0;
      setSession(r.session);
    }
    setCalibration(null);
    setStatus("tracking");
  }

  const startCalibration = useCallback(() => {
    r.mode = "calibrating";
    r.calStart = performance.now();
    r.calSamples = [];
    setCalibration({ phase: "countdown", seconds: 3, visible: false });
    setStatus("calibrating");
  }, [r]);

  const start = useCallback(async () => {
    if (!r.landmarker) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      console.error(e);
      setError(
        e?.name === "NotAllowedError"
          ? "Camera access was blocked. Allow the camera in your browser's address bar and try again."
          : "Couldn't start the camera. Make sure no other app is using it."
      );
      return;
    }
    if (r.settings.notifications && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    r.session = null;
    r.lastVideoTime = -1;
    r.stopTicker = createTicker(TICK_MS, tick);
    if (r.baseline) beginTracking();
    else startCalibration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, tick, startCalibration]);

  const stop = useCallback(() => {
    r.stopTicker?.();
    r.stopTicker = null;
    r.mode = null;
    const video = videoRef.current;
    video?.srcObject?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    const c = canvasRef.current;
    c?.getContext("2d").clearRect(0, 0, c.width, c.height);
    if (r.session) persist(r.session, { final: true });
    r.session = null;
    setSession(null);
    setCalibration(null);
    setLive({ score: null, state: "away", issue: null, goodRun: 0, badRun: 0 });
    setStatus("ready");
  }, [persist, r]);

  // Save progress if the tab is closed mid-session.
  useEffect(() => {
    const save = () => {
      if (!r.session) return;
      const list = loadSessions().filter((x) => x.id !== r.session.id);
      if (r.session.good + r.session.bad >= MIN_SESSION_SEC) list.push(r.session);
      saveSessions(list);
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [r]);

  useEffect(() => () => r.stopTicker?.(), [r]);

  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
  }, []);

  const clearSessions = useCallback(() => {
    setSessions([]);
    saveSessions([]);
  }, []);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    live,
    calibration,
    session,
    sessions,
    start,
    stop,
    recalibrate: startCalibration,
    deleteSession,
    clearSessions,
  };
}
