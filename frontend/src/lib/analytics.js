// Sessions store posture as run-length segments: [state, seconds] where state
// is "g" (good), "b" (bad) or "a" (away / not in frame), back to back from the
// session's start time.

export const SCORE_SAMPLE_SEC = 5;

export function newSession() {
  return {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    start: Date.now(),
    end: Date.now(),
    good: 0,
    bad: 0,
    away: 0,
    longestGood: 0,
    alerts: 0,
    segments: [],
    scores: [],
  };
}

/** Records one second of posture into a session (returns a new object). */
export function recordSecond(session, state, scoreValue, currentGoodRun) {
  const segments = session.segments.slice();
  const last = segments[segments.length - 1];
  if (last && last[0] === state) segments[segments.length - 1] = [state, last[1] + 1];
  else segments.push([state, 1]);

  const elapsed = session.good + session.bad + session.away + 1;
  const scores = elapsed % SCORE_SAMPLE_SEC === 0 ? [...session.scores, scoreValue ?? null] : session.scores;

  return {
    ...session,
    end: Date.now(),
    good: session.good + (state === "g" ? 1 : 0),
    bad: session.bad + (state === "b" ? 1 : 0),
    away: session.away + (state === "a" ? 1 : 0),
    longestGood: Math.max(session.longestGood, currentGoodRun),
    segments,
    scores,
  };
}

export const goodPct = (good, bad) => (good + bad ? Math.round((100 * good) / (good + bad)) : null);

/** Walks a session's segments as absolute time spans. */
function* spans(session) {
  let t = session.start;
  for (const [state, sec] of session.segments) {
    yield { state, from: t, to: t + sec * 1000 };
    t += sec * 1000;
  }
}

export const startOfDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const addDays = (ms, n) => {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** Splits every span at bucket boundaries and sums good / bad seconds per bucket. */
function bucketize(sessions, bucketStart, bucketNext) {
  const out = new Map();
  for (const s of sessions) {
    for (const span of spans(s)) {
      if (span.state === "a") continue;
      let from = span.from;
      while (from < span.to) {
        const b = bucketStart(from);
        const to = Math.min(span.to, bucketNext(b));
        const row = out.get(b) ?? { good: 0, bad: 0 };
        row[span.state === "g" ? "good" : "bad"] += (to - from) / 1000;
        out.set(b, row);
        from = to;
      }
    }
  }
  return out;
}

/** Good / bad minutes per calendar day for the last `days` days (oldest first). */
export function dailyTotals(sessions, days, now = Date.now()) {
  const map = bucketize(sessions, startOfDay, (b) => addDays(b, 1));
  const today = startOfDay(now);
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const r = map.get(day) ?? { good: 0, bad: 0 };
    rows.push({ day, good: r.good / 60, bad: r.bad / 60 });
  }
  return rows;
}

/** Share of good posture by hour of day across the given sessions. */
export function hourlyGoodShare(sessions) {
  const hourStart = (ms) => {
    const d = new Date(ms);
    d.setMinutes(0, 0, 0);
    return d.getTime();
  };
  const map = bucketize(sessions, hourStart, (b) => b + 3600_000);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, good: 0, bad: 0 }));
  for (const [ts, r] of map) {
    const h = new Date(ts).getHours();
    hours[h].good += r.good;
    hours[h].bad += r.bad;
  }
  return hours.map((r) => ({ ...r, pct: goodPct(r.good, r.bad), minutes: (r.good + r.bad) / 60 }));
}

/** Totals for sessions that overlap [from, to). */
export function summarize(sessions, from, to) {
  let good = 0;
  let bad = 0;
  let alerts = 0;
  let longestGood = 0;
  let count = 0;
  for (const s of sessions) {
    if (s.end < from || s.start >= to) continue;
    count++;
    alerts += s.alerts;
    longestGood = Math.max(longestGood, s.longestGood);
    for (const span of spans(s)) {
      if (span.state === "a") continue;
      const sec = Math.max(0, (Math.min(span.to, to) - Math.max(span.from, from)) / 1000);
      if (span.state === "g") good += sec;
      else bad += sec;
    }
  }
  return { good, bad, alerts, longestGood, count, pct: goodPct(good, bad) };
}

/** Consecutive days (ending today or yesterday) that met the daily goal. */
export function goalStreak(sessions, goalMin, now = Date.now()) {
  const rows = dailyTotals(sessions, 365, now).reverse();
  let i = rows[0].good >= goalMin ? 0 : 1;
  let streak = 0;
  for (; i < rows.length && rows[i].good >= goalMin; i++) streak++;
  return streak;
}

export function formatDuration(sec, { short = false } = {}) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return short ? `${h}h ${m}m` : `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return short ? `${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export const formatClock = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};
