import { useLayoutEffect, useRef, useState } from "react";
import { formatClock, formatDuration } from "@/lib/analytics";
import { GOOD_THRESHOLD } from "@/lib/posture";

const STATE_COLOR = { g: "var(--color-good)", b: "var(--color-bad)", a: "var(--color-away)" };
const STATE_LABEL = { g: "Good posture", b: "Slouching", a: "Out of frame" };

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function Tooltip({ x, y, width, children }) {
  if (x == null) return null;
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-panel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  );
}

const Swatch = ({ color, dashed }) =>
  dashed ? (
    <span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: color }} />
  ) : (
    <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} />
  );

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <Swatch color={it.color} dashed={it.dashed} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Live score line for the current session, with the good-posture threshold. */
export function ScoreTimeline({ points, height = 160 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const n = points.length;
  const span = Math.max(n - 1, 60);
  const x = (i) => pad.l + (iw * i) / span;
  const y = (v) => pad.t + ih * (1 - v / 100);

  let path = "";
  let area = "";
  let runStart = null;
  points.forEach((p, i) => {
    if (p.score == null) {
      if (runStart != null) area += `L${x(i - 1)},${y(0)}Z`;
      runStart = null;
      return;
    }
    if (runStart == null) {
      path += `M${x(i)},${y(p.score)}`;
      area += `M${x(i)},${y(0)}L${x(i)},${y(p.score)}`;
      runStart = i;
    } else {
      path += `L${x(i)},${y(p.score)}`;
      area += `L${x(i)},${y(p.score)}`;
    }
  });
  if (runStart != null) area += `L${x(n - 1)},${y(0)}Z`;

  const ticks = [];
  const step = span <= 120 ? 30 : span <= 600 ? 120 : span <= 1800 ? 300 : 900;
  for (let t = 0; t <= span; t += step) ticks.push(t);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.l) / iw) * span);
    if (i < 0 || i >= n) return setHover(null);
    setHover(i);
  };

  const hp = hover != null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full min-w-0 select-none">
      {width > 0 && (
        <svg className="block" width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Posture score over this session">
          <defs>
            <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="fill-ink-3 text-[10px] tabular">
                {v}
              </text>
            </g>
          ))}
          <rect x={pad.l} y={y(GOOD_THRESHOLD)} width={iw} height={y(0) - y(GOOD_THRESHOLD)} fill="var(--color-bad)" opacity="0.05" />
          <line x1={pad.l} x2={width - pad.r} y1={y(GOOD_THRESHOLD)} y2={y(GOOD_THRESHOLD)} stroke="var(--color-good)" strokeDasharray="4 4" opacity="0.7" />
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={height - 4} textAnchor={t === 0 ? "start" : x(t) > width - pad.r - 16 ? "end" : "middle"} className="fill-ink-3 text-[10px] tabular">
              {formatClock(t)}
            </text>
          ))}
          <path d={area} fill="url(#scoreFill)" />
          <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hp && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="var(--color-ink-3)" strokeDasharray="2 3" />
              {hp.score != null && <circle cx={x(hover)} cy={y(hp.score)} r="4.5" fill="var(--color-accent)" stroke="var(--color-panel)" strokeWidth="2" />}
            </g>
          )}
          {n > 0 && points[n - 1].score != null && (
            <circle cx={x(n - 1)} cy={y(points[n - 1].score)} r="4" fill="var(--color-accent)" stroke="var(--color-panel)" strokeWidth="2" />
          )}
        </svg>
      )}
      {hp && (
        <Tooltip x={x(hover)} y={hp.score != null ? y(hp.score) : y(50)} width={width}>
          <div className="text-ink-3 tabular">{formatClock(hover)} into session</div>
          <div className="mt-0.5 font-medium text-ink">{hp.score != null ? `Score ${hp.score}` : "Out of frame"}</div>
        </Tooltip>
      )}
    </div>
  );
}

/** Horizontal good / slouching / away strip for one session. */
export function PostureStrip({ session, height = 14, interactive = true }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const total = session.segments.reduce((s, [, d]) => s + d, 0) || 1;
  let acc = 0;
  const rects = session.segments.map(([state, d]) => {
    const r = { state, start: acc, d };
    acc += d;
    return r;
  });
  return (
    <div ref={ref} className="relative w-full min-w-0" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-hidden rounded-full" role="img" aria-label="Posture over the session">
          <rect width={width} height={height} fill="var(--color-panel-2)" />
          {rects.map((r, i) => (
            <rect
              key={i}
              x={(r.start / total) * width}
              width={Math.max((r.d / total) * width, 0.75)}
              height={height}
              fill={STATE_COLOR[r.state]}
              opacity={hover == null || hover === i ? 1 : 0.55}
              onMouseEnter={interactive ? () => setHover(i) : undefined}
            />
          ))}
        </svg>
      )}
      {interactive && hover != null && rects[hover] && (
        <Tooltip x={((rects[hover].start + rects[hover].d / 2) / total) * width} y={0} width={width}>
          <div className="flex items-center gap-1.5 font-medium text-ink">
            <Swatch color={STATE_COLOR[rects[hover].state]} />
            {STATE_LABEL[rects[hover].state]} for {formatDuration(rects[hover].d)}
          </div>
          <div className="text-ink-3 tabular">
            from {new Date(session.start + rects[hover].start * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

const niceMax = (v) => {
  if (v <= 10) return 10;
  const steps = [15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 120) * 120;
};

/** Stacked minutes of good vs slouching posture per day. */
export function DailyBars({ rows, goal, height = 220 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 34, r: 8, t: 12, b: 24 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(goal || 0, ...rows.map((r) => r.good + r.bad)) * 1.05);
  const y = (v) => pad.t + ih * (1 - v / max);
  const band = iw / rows.length;
  const bw = Math.max(4, Math.min(36, band * 0.62));
  const ticks = [0, max / 2, max];
  const labelEvery = rows.length > 14 ? 5 : 1;
  const fmtMin = (m) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}h` : `${Math.round(m)}m`);

  return (
    <div ref={ref} className="relative w-full min-w-0 select-none" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg className="block" width={width} height={height} role="img" aria-label="Minutes of good and slouching posture per day">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-3 text-[10px] tabular">
                {fmtMin(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = pad.l + band * i + band / 2;
            const gH = y(0) - y(r.good);
            const bH = y(0) - y(r.bad);
            const dim = hover != null && hover !== i;
            const d = new Date(r.day);
            return (
              <g key={r.day} onMouseEnter={() => setHover(r.good + r.bad > 0 ? i : null)}>
                <rect x={cx - band / 2} y={pad.t} width={band} height={ih} fill="transparent" />
                <g opacity={dim ? 0.45 : 1}>
                {r.good > 0 && <rect x={cx - bw / 2} y={y(r.good)} width={bw} height={gH} rx={r.bad > 0 ? 0 : 4} fill="var(--color-good)" />}
                {r.bad > 0 && (
                  <rect
                    x={cx - bw / 2}
                    y={y(r.good + r.bad)}
                    width={bw}
                    height={Math.max(0, bH - (r.good > 0 ? 2 : 0))}
                    rx={3}
                    fill="var(--color-bad)"
                  />
                )}
                </g>
                {(i % labelEvery === 0 || i === rows.length - 1) && (
                  <text x={cx} y={height - 6} textAnchor="middle" className="fill-ink-3 text-[10px]">
                    {rows.length > 7 ? `${d.getMonth() + 1}/${d.getDate()}` : d.toLocaleDateString([], { weekday: "short" })}
                  </text>
                )}
              </g>
            );
          })}
          {goal > 0 && (
            <g>
              <line x1={pad.l} x2={width - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--color-ink-2)" strokeDasharray="4 4" />
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <Tooltip x={pad.l + band * hover + band / 2} y={y(rows[hover].good + rows[hover].bad)} width={width}>
          <div className="mb-1 font-medium text-ink">
            {new Date(rows[hover].day).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <div className="flex items-center gap-1.5 text-ink-2">
            <Swatch color="var(--color-good)" /> Good <span className="ml-auto pl-3 text-ink tabular">{formatDuration(rows[hover].good * 60, { short: true })}</span>
          </div>
          <div className="flex items-center gap-1.5 text-ink-2">
            <Swatch color="var(--color-bad)" /> Slouching <span className="ml-auto pl-3 text-ink tabular">{formatDuration(rows[hover].bad * 60, { short: true })}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/** Good-posture share by hour of day. */
export function HourBars({ hours, height = 180 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 34, r: 8, t: 12, b: 22 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const y = (v) => pad.t + ih * (1 - v / 100);
  const band = iw / 24;
  const bw = Math.max(3, band - 3);
  const fmtHour = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

  return (
    <div ref={ref} className="relative w-full min-w-0 select-none" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg className="block" width={width} height={height} role="img" aria-label="Share of good posture by hour of day">
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-3 text-[10px] tabular">
                {t}%
              </text>
            </g>
          ))}
          {hours.map((h, i) => {
            const x = pad.l + band * i + (band - bw) / 2;
            const has = h.pct != null && h.minutes >= 0.5;
            return (
              <g key={h.hour} onMouseEnter={() => setHover(has ? i : null)} opacity={hover != null && hover !== i ? 0.45 : 1}>
                <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
                {has ? (
                  <rect x={x} y={y(h.pct)} width={bw} height={Math.max(2, y(0) - y(h.pct))} rx={Math.min(4, bw / 2)} fill="var(--color-accent)" />
                ) : (
                  <rect x={x} y={y(0) - 2} width={bw} height={2} rx={1} fill="var(--color-line)" />
                )}
                {i % 6 === 0 && (
                  <text x={pad.l + band * i + band / 2} y={height - 6} textAnchor="middle" className="fill-ink-3 text-[10px]">
                    {fmtHour(h.hour)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <Tooltip x={pad.l + band * hover + band / 2} y={y(hours[hover].pct)} width={width}>
          <div className="font-medium text-ink">
            {fmtHour(hours[hover].hour)}: {hours[hover].pct}% good
          </div>
          <div className="text-ink-3 tabular">{formatDuration(hours[hover].minutes * 60, { short: true })} tracked</div>
        </Tooltip>
      )}
    </div>
  );
}
