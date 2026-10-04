// Posture scoring from MediaPipe pose landmarks.
//
// A front-facing webcam can't see the spine, but slouching shows up clearly in
// how the head and shoulders move relative to an upright baseline:
//   - neck:     vertical gap between ears and shoulders (shrinks when you slump
//               or push your head forward)
//   - lean:     shoulder width on screen (grows when you lean into the screen)
//   - shoulder: tilt of the shoulder line
//   - roll:     sideways tilt of the head
// Every metric is measured in shoulder widths or degrees so it doesn't depend on
// how far you sit from the camera, then compared with a calibrated baseline.

export const LM = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
};

const VIS = 0.5;

const visible = (p) => p && (p.visibility ?? 1) >= VIS;

const angleDeg = (a, b) => {
  let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  // Normalise so a level line reads 0 regardless of left/right order.
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
};

/**
 * Turns one frame of landmarks into scale-free posture metrics.
 * Returns null when the head and shoulders aren't clearly in view.
 */
export function measure(landmarks, width, height) {
  if (!landmarks) return null;
  const px = (i) => {
    const p = landmarks[i];
    if (!visible(p)) return null;
    return { x: p.x * width, y: p.y * height };
  };
  const ls = px(LM.LEFT_SHOULDER);
  const rs = px(LM.RIGHT_SHOULDER);
  if (!ls || !rs) return null;

  const le = px(LM.LEFT_EAR);
  const re = px(LM.RIGHT_EAR);
  const nose = px(LM.NOSE);
  const ears = [le, re].filter(Boolean);
  const head = ears.length
    ? { x: ears.reduce((s, p) => s + p.x, 0) / ears.length, y: ears.reduce((s, p) => s + p.y, 0) / ears.length }
    : nose;
  if (!head) return null;

  const sw = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  if (sw < 20) return null;
  const mid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };

  return {
    neck: (mid.y - head.y) / sw,
    width: sw / width,
    shoulder: angleDeg(ls, rs),
    roll: le && re ? angleDeg(le, re) : 0,
    offset: (head.x - mid.x) / sw,
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Builds a baseline from the frames captured while the user sat upright. */
export function buildBaseline(samples) {
  if (samples.length < 5) return null;
  const keys = ["neck", "width", "shoulder", "roll", "offset"];
  const base = { createdAt: Date.now() };
  for (const k of keys) base[k] = median(samples.map((s) => s[k]));
  return base;
}

export const SENSITIVITY = {
  relaxed: { label: "Relaxed", k: 1.5 },
  balanced: { label: "Balanced", k: 1 },
  strict: { label: "Strict", k: 0.7 },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const ISSUES = {
  slouch: {
    label: "Slouching",
    tip: "Lift your chest and grow tall through the crown of your head.",
  },
  lean: {
    label: "Leaning in",
    tip: "Sit back so your shoulders rest over your hips, then bring the screen closer if you need to.",
  },
  shoulders: {
    label: "Uneven shoulders",
    tip: "Drop the higher shoulder and spread your weight evenly on both hips.",
  },
  tilt: {
    label: "Head tilted",
    tip: "Level your head so your eyes sit on a horizontal line.",
  },
};

/**
 * Scores a frame against the baseline. 100 is identical to your calibrated
 * upright posture; anything below the threshold counts as bad posture.
 */
export function score(m, base, sensitivity = "balanced") {
  const k = SENSITIVITY[sensitivity]?.k ?? 1;
  const neckDrop = (base.neck - m.neck) / Math.max(base.neck, 0.2);
  const lean = m.width / base.width - 1;
  const shoulder = Math.abs(m.shoulder - base.shoulder);
  const roll = Math.abs(m.roll - base.roll);

  const parts = {
    slouch: clamp01((neckDrop - 0.03 * k) / (0.15 * k)),
    lean: clamp01((lean - 0.06 * k) / (0.22 * k)),
    shoulders: clamp01((shoulder - 3 * k) / (9 * k)),
    tilt: clamp01((roll - 6 * k) / (14 * k)),
  };
  const penalty = clamp01(parts.slouch * 0.8 + parts.lean * 0.6 + parts.shoulders * 0.4 + parts.tilt * 0.35);

  let issue = null;
  let worst = 0.12;
  for (const [key, v] of Object.entries(parts)) {
    if (v > worst) {
      worst = v;
      issue = key;
    }
  }
  return { score: Math.round(100 * (1 - penalty)), issue, parts };
}

export const GOOD_THRESHOLD = 70;
