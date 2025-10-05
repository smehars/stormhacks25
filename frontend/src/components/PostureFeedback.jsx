import React, { useState, useEffect } from "react";
import { runGeminiText } from "@/gemini/gemini";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";

export default function PostureFeedback({ postureData, isVisible, isEmbedded = false }) {
  const [feedback, setFeedback] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const generatePostureFeedback = async (data) => {
    if (!data || isGenerating) return;

    setIsGenerating(true);

    const prompt = `
    You are a professional posture coach. Analyze this posture data and provide specific, actionable feedback.
    
    Posture Analysis Data:
    - Forward head angle: ${data.angle_deg}° (threshold: 10°)
    - Raw angle: ${data.raw_angle_deg}°
    - Current state: ${data.state}
    - Issue reason: ${data.reason}
    - Shoulder level difference: ${data.shoulder_level_diff}
    
    Based on this data, provide:
    1. A brief assessment (1-2 sentences)
    2. ONE specific instruction to improve posture (be very specific about body positioning)
    3. Keep total response under 50 words
    
    Format your response as: "Assessment | Instruction"
    
    Example: "Your head is tilted forward, creating neck strain. | Pull your chin back and imagine a string pulling the top of your head toward the ceiling."
    `;

    try {
      const aiResponse = await runGeminiText(prompt);
      const [assessment, instruction] = aiResponse.split("|").map((s) => s.trim());

      setFeedback({
        assessment: assessment || "Analyzing your posture...",
        instruction: instruction || "Maintain your current position.",
        severity: data.state === "bad_posture" ? "warning" : "good",
        angle: data.angle_deg,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Failed to generate posture feedback:", error);
      setFeedback({
        assessment: "Unable to analyze posture at the moment.",
        instruction: "Keep your head aligned with your shoulders.",
        severity: "neutral",
        angle: data.angle_deg,
        timestamp: Date.now(),
      });
    } finally {
      setIsGenerating(false);
      setLastUpdate(Date.now());
    }
  };

  useEffect(() => {
    if (postureData && isVisible) {
      // Only generate new feedback every 5 seconds to avoid API spam
      const timeSinceLastUpdate = Date.now() - lastUpdate;
      if (timeSinceLastUpdate > 5000) {
        generatePostureFeedback(postureData);
      }
    }
  }, [postureData, isVisible]);

  const getFeedbackStyle = () => {
    switch (feedback.severity) {
      case "warning":
        return "border-red-500/50 bg-red-500/10 text-red-100";
      case "good":
        return "border-green-500/50 bg-green-500/10 text-green-100";
      default:
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-100";
    }
  };

  if (!isVisible || !feedback) return null;

  return (
    <div className="space-y-3">
      {/* Feedback Alert */}
      <Alert className={`${getFeedbackStyle()} border backdrop-blur-sm ${isEmbedded ? 'text-xs' : ''}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <AlertTitle className={`${isEmbedded ? 'text-xs' : 'text-sm'} font-medium`}>
          {feedback.assessment}
        </AlertTitle>
        <AlertDescription className={`${isEmbedded ? 'text-xs' : 'text-xs'} mt-1 leading-relaxed`}>
          💡 {feedback.instruction}
        </AlertDescription>
      </Alert>

      {/* Loading Indicator */}
      {isGenerating && (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
          <span className="text-white/60 text-xs">Analyzing posture...</span>
        </div>
      )}
    </div>
  );
}
