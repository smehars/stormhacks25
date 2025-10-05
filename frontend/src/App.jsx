import { useState, useEffect } from "react";
import { runGeminiText } from "@/gemini/gemini";
import MediaPipePose from "./components/MediaPipePose.jsx";

function App() {
  const [showPose, setShowPose] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const answer = await runGeminiText("Say hi");
        console.log("Gemini response:", answer);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <MediaPipePose />
    </div>
  );
}

export default App;
