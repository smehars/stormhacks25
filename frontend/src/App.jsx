import { useState } from "react";
import MediaPipePose from "./components/MediaPipePose.jsx";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";

function App() {
  const [showPose, setShowPose] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">StormHacks 2025</h1>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Pose Detection System
          </Badge>
        </div>

        <div className="text-center mb-8">
          <Button onClick={() => setShowPose(!showPose)} size="lg" variant={showPose ? "destructive" : "default"}>
            {showPose ? "Hide" : "Show"} Pose Detection
          </Button>
        </div>

        {showPose && <MediaPipePose />}
      </div>
    </div>
  );
}

export default App;
