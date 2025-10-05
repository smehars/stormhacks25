import React from "react";

export default function PostureOverlay({ postureData, canvasSize }) {
  if (!postureData || postureData.state === "good_posture") return null;

  const getOverlayInstructions = () => {
    const angle = postureData.angle_deg;

    if (angle >= 15) {
      return {
        arrow: "⬆️",
        direction: "Pull chin back significantly",
        color: "text-red-400",
        intensity: "high",
      };
    } else if (angle >= 10) {
      return {
        arrow: "↗️",
        direction: "Lift head slightly",
        color: "text-yellow-400",
        intensity: "medium",
      };
    }

    return null;
  };

  const instructions = getOverlayInstructions();
  if (!instructions) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Center guidance */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className={`${instructions.color} text-center animate-pulse`}>
          <div className="text-4xl mb-2">{instructions.arrow}</div>
          <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
            <p className="text-white text-sm font-medium">{instructions.direction}</p>
          </div>
        </div>
      </div>

      {/* Ideal posture guide lines */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ transform: "scaleX(-1)" }} // Mirror to match video
      >
        {/* Ideal head position guide */}
        <defs>
          <pattern id="guideline" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="2" height="2" fill="rgba(34, 197, 94, 0.3)" />
          </pattern>
        </defs>

        {/* Vertical alignment guide */}
        <line x1="50%" y1="20%" x2="50%" y2="80%" stroke="url(#guideline)" strokeWidth="2" strokeDasharray="5,5" />

        {/* Ideal head zone */}
        <circle cx="50%" cy="25%" r="40" fill="none" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="2" strokeDasharray="3,3" />

        <text x="50%" y="15%" textAnchor="middle" fill="rgba(34, 197, 94, 0.8)" fontSize="12" className="font-medium">
          Ideal Head Position
        </text>
      </svg>
    </div>
  );
}
