import { useEffect } from "react";
import { X } from "lucide-react";
import { SENSITIVITY } from "@/lib/posture";
import { cn } from "@/lib/utils";

function Row({ title, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {desc && <div className="mt-0.5 text-xs text-ink-3">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-good" : "bg-panel-2 border")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex rounded-full border bg-bg p-0.5">
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn("rounded-full px-3 py-1 text-xs transition", value === id ? "bg-panel-2 font-medium text-ink" : "text-ink-3 hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsDialog({ open, onClose, settings, onChange, onResetCalibration, hasBaseline }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const set = (k) => (v) => onChange({ ...settings, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border bg-panel shadow-2xl animate-in zoom-in-95"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-panel-2 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] divide-y overflow-y-auto px-6">
          <Row title="Sensitivity" desc="How far from your calibrated posture counts as slouching.">
            <Segmented value={settings.sensitivity} onChange={set("sensitivity")} options={Object.entries(SENSITIVITY).map(([k, v]) => [k, v.label])} />
          </Row>
          <Row title="Remind me after" desc="How long you can slouch before LockedIn nudges you.">
            <Segmented
              value={settings.alertAfterSec}
              onChange={set("alertAfterSec")}
              options={[
                [10, "10s"],
                [20, "20s"],
                [45, "45s"],
                [90, "90s"],
              ]}
            />
          </Row>
          <Row title="Break reminder" desc="A nudge to stand up and stretch.">
            <Segmented
              value={settings.breakEveryMin}
              onChange={set("breakEveryMin")}
              options={[
                [0, "Off"],
                [25, "25m"],
                [30, "30m"],
                [50, "50m"],
              ]}
            />
          </Row>
          <Row title="Daily goal" desc="Minutes of good posture you're aiming for each day.">
            <Segmented
              value={settings.dailyGoalMin}
              onChange={set("dailyGoalMin")}
              options={[
                [60, "1h"],
                [120, "2h"],
                [240, "4h"],
                [360, "6h"],
              ]}
            />
          </Row>
          <Row title="Sound" desc="A soft chime with each reminder.">
            <Toggle label="Sound" checked={settings.sound} onChange={set("sound")} />
          </Row>
          <Row title="Desktop notifications" desc="Reminders reach you while you're in another app.">
            <Toggle
              label="Desktop notifications"
              checked={settings.notifications}
              onChange={(v) => {
                if (v && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
                set("notifications")(v);
              }}
            />
          </Row>
          <Row title="Show tracking lines" desc="Draw the head and shoulder lines over the camera.">
            <Toggle label="Show tracking lines" checked={settings.showSkeleton} onChange={set("showSkeleton")} />
          </Row>
          <Row title="Calibration" desc={hasBaseline ? "Saved. Reset it if you moved your camera or desk." : "Not calibrated yet."}>
            <button
              disabled={!hasBaseline}
              onClick={onResetCalibration}
              className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-panel-2 disabled:opacity-40"
            >
              Reset
            </button>
          </Row>
        </div>
      </div>
    </div>
  );
}
