let ctx = null;

/** A short, soft chime generated in the browser (no audio files to ship). */
export function chime(kind = "alert") {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const notes = kind === "break" ? [523.25, 659.25, 783.99] : [659.25, 523.25];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {
    // Audio unavailable; the on-screen and system notifications still fire.
  }
}

/** System notification, only when the tab isn't in front of the user. */
export function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  try {
    new Notification(title, { body, tag: "lockedin", silent: true });
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
