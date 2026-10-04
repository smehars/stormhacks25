import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Crosshair, Eye, EyeOff, Lock, Play, Square, Timer, Trophy, BellRing, Activity } from "lucide-react";
import { ISSUES, GOOD_THRESHOLD } from "@/lib/posture";
import { formatClock, formatDuration, goodPct } from "@/lib/analytics";
import { ScoreTimeline, PostureStrip, Legend } from "./charts";
import { cn } from "@/lib/utils";

const STATE_UI = {
  good: { label: "Good posture", dot: "bg-good", text: "text-good" },
  bad: { label: "Slouching", dot: "bg-bad", text: "text-bad" },
  away: { label: "Out of frame", dot: "bg-away", text: "text-ink-2" },
};

function ScoreRing({ score, state }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const color = state === "good" ? "var(--color-good)" : state === "bad" ? "var(--color-bad)" : "var(--color-away)";
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 150 150" className="size-full -rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--color-panel-2)" strokeWidth="11" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 300ms ease, stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular">{score ?? "--"}</span>
        <span className="text-xs text-ink-3">posture score</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl bg-panel-2 p-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

function CalibrationOverlay({ calibration }) {
  if (!calibration) return null;
  const { phase, seconds, progress, visible } = calibration;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
      <div className="mx-4 max-w-sm rounded-2xl border bg-panel/90 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Crosshair className="size-6" />
        </div>
        <h3 className="text-lg font-semibold">{phase === "capture" ? "Hold still…" : "Sit up tall"}</h3>
        <p className="mt-1 text-sm text-ink-2">
          {phase === "retry"
            ? "We couldn't see your head and shoulders. Make sure both are in the frame."
            : "Shoulders relaxed, back straight, eyes level with the screen. This is the posture LockedIn will hold you to."}
        </p>
        {phase === "capture" ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : (
          <div className="mt-4 text-5xl font-semibold tabular text-accent">{seconds}</div>
        )}
        {!visible && phase !== "retry" && <p className="mt-3 text-xs text-warn">Move back until your shoulders are in view.</p>}
      </div>
    </div>
  );
}

export default function LiveView({ tracker, settings, onToggleSkeleton, hasBaseline }) {
  const { videoRef, canvasRef, status, error, live, calibration, session, start, stop, recalibrate } = tracker;
  const running = status === "tracking" || status === "calibrating";

  // Second-by-second scores for the live chart (storage keeps 5s samples).
  const [points, setPoints] = useState([]);
  const lastLen = useRef(0);
  useEffect(() => {
    if (!session) {
      setPoints([]);
      lastLen.current = 0;
      return;
    }
    const len = session.good + session.bad + session.away;
    if (len === lastLen.current) return;
    lastLen.current = len;
    setPoints((p) => [...p, { score: live.state === "away" ? null : live.score }]);
    // Only advance once per recorded second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const ui = STATE_UI[live.state] ?? STATE_UI.away;
  const issue = live.issue ? ISSUES[live.issue] : null;
  const sessionSec = session ? session.good + session.bad + session.away : 0;
  const pct = session ? goodPct(session.good, session.bad) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Camera stage */}
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-video border bg-panel transition-shadow duration-500",
            status === "tracking" && live.state === "good" && "glow-good",
            status === "tracking" && live.state === "bad" && "glow-bad"
          )}
        >
          <video ref={videoRef} muted playsInline className="absolute inset-0 size-full -scale-x-100 object-cover" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover" />

          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_#1b2230_0%,_#0b0d10_70%)] p-6 text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border bg-panel-2">
                {status === "error" ? <CameraOff className="size-7 text-bad" /> : <Camera className="size-7 text-ink-2" />}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Ready when you are</h2>
              <p className="mt-2 max-w-md text-sm text-ink-2">
                {hasBaseline
                  ? "Start a session and LockedIn will quietly watch your posture while you work, even when this tab is in the background."
                  : "First, a 5 second calibration: sit the way you'd like to sit all day, and LockedIn learns that as your baseline."}
              </p>
              <button
                onClick={status === "error" ? () => location.reload() : start}
                disabled={status !== "ready" && status !== "error"}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-good px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-good/20 transition hover:brightness-110 disabled:opacity-50"
              >
                <Play className="size-4 fill-current" />
                {status === "loading" ? "Loading pose model…" : status === "error" ? "Reload" : hasBaseline ? "Start session" : "Calibrate & start"}
              </button>
              {error && <p className="mt-4 max-w-md text-sm text-bad">{error}</p>}
              <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-3">
                <Lock className="size-3" /> Video is processed on your device and never uploaded.
              </p>
            </div>
          )}

          <CalibrationOverlay calibration={calibration} />

          {status === "tracking" && (
            <>
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-sm font-medium backdrop-blur">
                <span className={cn("size-2.5 rounded-full", ui.dot, live.state === "bad" && "animate-pulse")} />
                {ui.label}
              </div>
              <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-sm tabular backdrop-blur">
                <Timer className="size-3.5 text-ink-2" />
                {formatClock(sessionSec)}
              </div>
            </>
          )}

          {running && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
              <button
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <Square className="size-3.5 fill-current" /> End session
              </button>
              <button
                onClick={recalibrate}
                disabled={status === "calibrating"}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-black/70 disabled:opacity-50"
              >
                <Crosshair className="size-4" /> Recalibrate
              </button>
              <button
                onClick={onToggleSkeleton}
                title={settings.showSkeleton ? "Hide tracking lines" : "Show tracking lines"}
                className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur transition hover:bg-black/70"
              >
                {settings.showSkeleton ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Session timeline */}
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold">This session</h3>
              <p className="text-xs text-ink-3">Posture score each second. Above the dashed line counts as good posture.</p>
            </div>
            <Legend
              items={[
                { label: "Score", color: "var(--color-accent)" },
                { label: `Good (≥${GOOD_THRESHOLD})`, color: "var(--color-good)", dashed: true },
              ]}
            />
          </div>
          {session && points.length > 0 ? (
            <>
              <ScoreTimeline points={points} />
              <div className="mt-4">
                <PostureStrip session={session} />
                <div className="mt-2">
                  <Legend
                    items={[
                      { label: "Good", color: "var(--color-good)" },
                      { label: "Slouching", color: "var(--color-bad)" },
                      { label: "Out of frame", color: "var(--color-away)" },
                    ]}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-ink-3">
              Your live posture graph appears here once a session starts.
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <aside className="flex flex-col gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-5">
            <ScoreRing score={status === "tracking" ? live.score : null} state={live.state} />
            <div className="min-w-0">
              <div className={cn("text-sm font-medium", status === "tracking" ? ui.text : "text-ink-3")}>
                {status === "tracking" ? ui.label : "Not tracking"}
              </div>
              <div className="mt-3 text-xs text-ink-3">Good posture streak</div>
              <div className="text-3xl font-semibold tabular">{formatClock(live.goodRun)}</div>
            </div>
          </div>

          <div
            className={cn(
              "mt-5 rounded-xl border p-4 text-sm transition-colors",
              issue ? "border-bad/30 bg-bad/10" : "border-good/20 bg-good/5"
            )}
          >
            {status !== "tracking" ? (
              <p className="text-ink-2">Tips show up here when LockedIn notices something off.</p>
            ) : live.state === "away" ? (
              <p className="text-ink-2">Can't see you. Make sure your head and both shoulders are in frame.</p>
            ) : issue ? (
              <>
                <div className="font-semibold text-bad">{issue.label}</div>
                <p className="mt-1 text-ink-2">{issue.tip}</p>
                {live.badRun > 0 && (
                  <p className="mt-2 text-xs text-ink-3 tabular">
                    {live.badRun < settings.alertAfterSec
                      ? `Reminder in ${settings.alertAfterSec - live.badRun}s`
                      : `Slouching for ${formatDuration(live.badRun)}`}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="font-semibold text-good">Looking good</div>
                <p className="mt-1 text-ink-2">Keep it up. Relax your shoulders and keep breathing.</p>
              </>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Session stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Activity} label="Good posture" value={pct == null ? "--" : `${pct}%`} hint={session ? `${formatDuration(session.good, { short: true })} total` : null} />
            <Stat icon={Trophy} label="Longest streak" value={session ? formatClock(session.longestGood) : "--"} />
            <Stat icon={Timer} label="Tracked" value={session ? formatClock(session.good + session.bad) : "--"} />
            <Stat icon={BellRing} label="Reminders" value={session ? session.alerts : "--"} />
          </div>
        </div>
      </aside>
    </div>
  );
}
