import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, BellRing, Coffee, Settings, Video } from "lucide-react";
import { usePostureTracker } from "@/hooks/usePostureTracker";
import { loadBaseline, loadSettings, saveBaseline, saveSettings } from "@/lib/storage";
import LiveView from "@/components/LiveView";
import AnalyticsView from "@/components/AnalyticsView";
import SettingsDialog from "@/components/SettingsDialog";
import { cn } from "@/lib/utils";

const FAVICON_COLORS = { good: "#22c55e", bad: "#ef4444", away: "#71717a" };

function setFavicon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#14171c"/><circle cx="16" cy="9" r="4" fill="${color}"/><path d="M16 14v12M10 18h12" stroke="${color}" stroke-width="3" stroke-linecap="round"/></svg>`;
  const link = document.getElementById("favicon");
  if (link) link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function Toast({ toast }) {
  if (!toast) return null;
  const isBreak = toast.kind === "break";
  return (
    <div className="fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <div
        key={toast.id}
        className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur animate-in slide-in-from-top-4 fade-in-0",
          isBreak ? "border-accent/30 bg-panel/95" : "border-bad/40 bg-panel/95"
        )}
      >
        <div className={cn("flex size-9 items-center justify-center rounded-full", isBreak ? "bg-accent/15 text-accent" : "bg-bad/15 text-bad")}>
          {isBreak ? <Coffee className="size-4" /> : <BellRing className="size-4" />}
        </div>
        <div>
          <div className="text-sm font-semibold">{isBreak ? "Time for a break" : "Sit up straight"}</div>
          <div className="text-xs text-ink-2">{isBreak ? "Stand up, stretch, and rest your eyes." : "You've been slouching for a while."}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("live");
  const [settings, setSettings] = useState(loadSettings);
  const [baseline, setBaseline] = useState(loadBaseline);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const updateSettings = useCallback((s) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const onBaseline = useCallback((b) => {
    setBaseline(b);
    saveBaseline(b);
  }, []);

  const onAlert = useCallback((kind) => {
    clearTimeout(toastTimer.current);
    setToast({ kind, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const tracker = usePostureTracker({ settings, baseline, onBaseline, onAlert });
  const { status, live } = tracker;

  // Tab title and favicon mirror your posture so you can glance at them from another tab.
  useEffect(() => {
    if (status === "tracking") {
      const label = live.state === "good" ? "Good posture" : live.state === "bad" ? "Slouching" : "Out of frame";
      document.title = `${live.state === "bad" ? "⚠ " : ""}${label} · LockedIn`;
      setFavicon(FAVICON_COLORS[live.state]);
    } else {
      document.title = "LockedIn · Posture Coach";
      setFavicon("#22c55e");
    }
  }, [status, live.state]);

  const tabs = [
    { id: "live", label: "Live", icon: Video },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-bg/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-8" />
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">LockedIn</span>
            {status === "tracking" && (
              <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good sm:inline-flex">
                <span className="size-1.5 animate-pulse rounded-full bg-good" /> Tracking
              </span>
            )}
          </div>
          <nav className="inline-flex rounded-full border bg-panel p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition sm:px-4",
                  tab === t.id ? "bg-panel-2 font-medium text-ink" : "text-ink-3 hover:text-ink"
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-full border bg-panel text-ink-2 transition hover:text-ink"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Keep the live view mounted so the camera keeps running on the analytics tab. */}
        <div className={tab === "live" ? "" : "hidden"}>
          <LiveView
            tracker={tracker}
            settings={settings}
            hasBaseline={!!baseline}
            onToggleSkeleton={() => updateSettings({ ...settings, showSkeleton: !settings.showSkeleton })}
          />
        </div>
        {tab === "analytics" && (
          <AnalyticsView
            sessions={tracker.session ? [...tracker.sessions.filter((s) => s.id !== tracker.session.id), tracker.session] : tracker.sessions}
            settings={settings}
            onDelete={tracker.deleteSession}
            onClear={tracker.clearSessions}
            onStart={() => setTab("live")}
          />
        )}
      </main>

      <Toast toast={toast} />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        hasBaseline={!!baseline}
        onResetCalibration={() => {
          onBaseline(null);
          localStorage.removeItem("lockedin.baseline.v1");
          setSettingsOpen(false);
          if (status === "tracking") tracker.recalibrate();
        }}
      />
    </div>
  );
}
