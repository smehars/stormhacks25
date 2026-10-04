import { useMemo, useState } from "react";
import { Activity, BellRing, CalendarCheck, Clock, Flame, Trash2, Trophy, BarChart3 } from "lucide-react";
import { dailyTotals, formatDuration, goalStreak, goodPct, hourlyGoodShare, startOfDay, summarize, formatClock } from "@/lib/analytics";
import { DailyBars, HourBars, Legend, PostureStrip } from "./charts";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: 7, label: "7 days" },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
];

function Tile({ icon: Icon, label, value, sub, delta }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
        {delta != null && delta !== 0 && (
          <span className={cn("whitespace-nowrap font-medium tabular", delta > 0 ? "text-good" : "text-bad")}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

function GoalProgress({ todayGoodMin, goalMin }) {
  const pct = Math.min(1, todayGoodMin / goalMin);
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <CalendarCheck className="size-3.5" />
        Today's goal
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">
        {formatDuration(todayGoodMin * 60, { short: true })}
        <span className="text-base font-normal text-ink-3"> / {formatDuration(goalMin * 60, { short: true })}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-good transition-[width]" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsView({ sessions, settings, onDelete, onClear, onStart }) {
  const [range, setRange] = useState(7);
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(() => {
    const now = Date.now();
    const from = startOfDay(now) - (range - 1) * 86400_000;
    const prevFrom = from - range * 86400_000;
    const inRange = sessions.filter((s) => s.end >= from);
    const cur = summarize(sessions, from, now + 1);
    const prev = summarize(sessions, prevFrom, from);
    const today = summarize(sessions, startOfDay(now), now + 1);
    return {
      cur,
      prev,
      today,
      daily: dailyTotals(sessions, range, now),
      hourly: hourlyGoodShare(inRange),
      streak: goalStreak(sessions, settings.dailyGoalMin, now),
      list: [...inRange].sort((a, b) => b.start - a.start),
    };
  }, [sessions, range, settings.dailyGoalMin]);

  if (!sessions.length) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-panel-2">
          <BarChart3 className="size-6 text-ink-2" />
        </div>
        <h2 className="text-xl font-semibold">No sessions yet</h2>
        <p className="mt-2 max-w-sm text-sm text-ink-2">
          Track a session and this page fills in with how long you held good posture, your best streaks, and when in the day you
          slouch the most.
        </p>
        <button onClick={onStart} className="mt-6 rounded-full bg-good px-5 py-2.5 text-sm font-semibold text-black hover:brightness-110">
          Go to live view
        </button>
      </div>
    );
  }

  const { cur, prev, today, daily, hourly, streak, list } = data;
  const delta = cur.pct != null && prev.pct != null ? cur.pct - prev.pct : null;
  const tracked = daily.filter((d) => d.good + d.bad > 0);
  const avgGood = tracked.length ? tracked.reduce((s, d) => s + d.good, 0) / tracked.length : 0;
  const best = hourly.filter((h) => h.pct != null && h.minutes >= 5).sort((a, b) => b.pct - a.pct);
  const fmtHour = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
  const shown = showAll ? list : list.slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your posture</h2>
          <p className="text-sm text-ink-3">How long you hold good posture, and when it slips.</p>
        </div>
        <div className="inline-flex rounded-full border bg-panel p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition",
                range === r.id ? "bg-panel-2 font-medium text-ink" : "text-ink-3 hover:text-ink"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile icon={Activity} label="Good posture" value={cur.pct == null ? "--" : `${cur.pct}%`} delta={delta} sub={delta != null ? `vs prior ${range}d` : "of tracked time"} />
        <Tile icon={Clock} label="Time in good posture" value={formatDuration(cur.good, { short: true })} sub={`of ${formatDuration(cur.good + cur.bad, { short: true })} tracked`} />
        <Tile icon={Trophy} label="Longest streak" value={formatClock(cur.longestGood)} sub="unbroken good posture" />
        <Tile icon={BellRing} label="Slouch reminders" value={cur.alerts} sub={`across ${cur.count} session${cur.count === 1 ? "" : "s"}`} />
        <GoalProgress todayGoodMin={today.good / 60} goalMin={settings.dailyGoalMin} />
        <Tile icon={Flame} label="Goal streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={`hitting ${formatDuration(settings.dailyGoalMin * 60, { short: true })} a day`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold">Good posture per day</h3>
              <p className="text-xs text-ink-3">
                {tracked.length ? `Averaging ${formatDuration(avgGood * 60, { short: true })} of good posture on days you tracked.` : "No tracked time in this range."}
              </p>
            </div>
            <Legend
              items={[
                { label: "Good", color: "var(--color-good)" },
                { label: "Slouching", color: "var(--color-bad)" },
                { label: "Daily goal", color: "var(--color-ink-2)", dashed: true },
              ]}
            />
          </div>
          <DailyBars rows={daily} goal={settings.dailyGoalMin} />
        </div>

        <div className="card min-w-0 p-5">
          <div className="mb-4">
            <h3 className="font-semibold">Good posture by time of day</h3>
            <p className="text-xs text-ink-3">
              {best.length >= 2
                ? `Best around ${fmtHour(best[0].hour)} (${best[0].pct}%), worst around ${fmtHour(best[best.length - 1].hour)} (${best[best.length - 1].pct}%).`
                : "Share of tracked time spent in good posture, by hour."}
            </p>
          </div>
          <HourBars hours={hourly} />
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Sessions</h3>
            <p className="text-xs text-ink-3">Hover a timeline to see when your posture slipped.</p>
          </div>
          <button
            onClick={() => {
              if (confirm("Delete all posture history? This can't be undone.")) onClear();
            }}
            className="text-xs text-ink-3 transition hover:text-bad"
          >
            Clear history
          </button>
        </div>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">No sessions in this range.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((s) => {
              const pct = goodPct(s.good, s.bad);
              const d = new Date(s.start);
              return (
                <li key={s.id} className="group grid items-center gap-x-5 gap-y-2 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                  <div>
                    <div className="text-sm font-medium">
                      {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-ink-3 tabular">
                      {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {formatDuration(s.good + s.bad + s.away, { short: true })}
                    </div>
                  </div>
                  <PostureStrip session={s} height={10} />
                  <div className="flex items-center gap-4 text-sm tabular">
                    <span className={cn("w-12 text-right font-semibold", pct >= 70 ? "text-good" : pct >= 50 ? "text-warn" : "text-bad")}>
                      {pct == null ? "--" : `${pct}%`}
                    </span>
                    <span className="w-24 text-right text-xs text-ink-3">best {formatClock(s.longestGood)}</span>
                    <button
                      onClick={() => onDelete(s.id)}
                      title="Delete session"
                      className="text-ink-3 opacity-0 transition hover:text-bad group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > 8 && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm text-accent hover:underline">
            {showAll ? "Show fewer" : `Show all ${list.length} sessions`}
          </button>
        )}
      </div>
    </div>
  );
}
