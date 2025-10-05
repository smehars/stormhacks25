// PostureCoach.jsx
import React, { useCallback, useMemo, useState } from "react";
import MediaPipePose from "./MediaPipePose.jsx";
import { runGeminiText } from "@/gemini/gemini"; // <- your saved function
import { Button } from "./ui/button";

function secureRandomInt(maxExclusive) {
  // Cryptographically strong random int in [0, maxExclusive)
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Number(buf[0] % maxExclusive);
}

function randomChoice(arr) {
  return arr[secureRandomInt(arr.length)];
}

function buildRandomPrompt(analysis) {
  const tones = [
    "friendly coach",
    "physio with concise guidance",
    "motivational fitness trainer",
    "ergonomics expert with short tips",
    "calm yoga instructor"
  ];

  const formats = [
    "Give exactly 4 concise suggestions.",
    "Return exactly 3 short bullet points.",
    "Provide 5 ultra-brief, practical tips."
  ];

  // Optional: include hints from backend if present
  const hint =
    analysis?.issues?.join?.(", ") ||
    analysis?.reason ||
    analysis?.label ||
    "";

  // Ask Gemini for JSON so we can render reliably
  const jsonConstraint = `Respond ONLY as JSON: {"suggestions": ["tip1","tip2", ...]}. No prose.`;

  const baseGoal =
    "User shows signs of forward-head or rounded-shoulder posture from webcam landmarks.";

  return `
Act as a ${randomChoice(tones)}.
Context: ${baseGoal}
${hint ? `Backend hint: ${hint}` : ""}

${randomChoice(formats)}
Make each tip < 90 characters, actionable, safe for general audiences.
Avoid medical claims or diagnosis.
${jsonConstraint}
`.trim();
}

function parseSuggestionsFromModel(text) {
  // Prefer JSON
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
      return data.suggestions.slice(0, 8);
    }
  } catch (_) {
    // Fallback: split lines
  }
  // Fallback: parse bullets or newlines
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.replace(/^[\s*\-\d\.\)]*\s*/, "").trim())
    .filter(Boolean);
  return lines.slice(0, 6);
}

export default function PostureCoach() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");

  const handleBadPosture = useCallback(async (analysis) => {
    setError("");
    setLoading(true);
    try {
      const prompt = buildRandomPrompt(analysis);
      const text = await runGeminiText(prompt); // uses your saved API wrapper
      const tips = parseSuggestionsFromModel(text);

      if (!tips.length) {
        throw new Error("Empty suggestions from model");
      }
      setSuggestions(tips);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      setError("Couldn’t generate tips. Try again.");
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // simple modal
  return (
    <div className="relative w-full h-full">
      <MediaPipePose onBadPostureDetected={handleBadPosture} />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setModalOpen(false)}
          />
          {/* card */}
          <div className="relative z-10 w-[min(92vw,560px)] max-h-[80vh] overflow-auto rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Quick Posture Tips</h2>
              <Button
                onClick={() => setModalOpen(false)}
                className="bg-slate-800 text-white hover:bg-slate-700"
              >
                Close
              </Button>
            </div>

            {loading && (
              <p className="text-slate-500">Generating suggestions…</p>
            )}

            {!loading && error && (
              <p className="text-red-600">{error}</p>
            )}

            {!loading && !error && (
              <ul className="mt-2 space-y-2">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"
                  >
                    • {s}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  // Re-roll with a new random prompt
                  handleBadPosture({});
                }}
                className="bg-teal-600 text-white hover:bg-teal-700"
              >
                New Suggestions
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-slate-300 hover:bg-slate-100"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
