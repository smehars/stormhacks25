# LockedIn

## Posture coach
Ever been working on a project for hours, glanced at a mirror, and seen yourself looking like a goblin?
LockedIn watches your posture through your webcam, nudges you when you slouch, and shows you how long you actually hold good posture.

- **Live coaching**: a posture score, a good-posture streak timer, and a specific tip for what's off (slouching, leaning in, uneven shoulders, tilted head).
- **Reminders that reach you**: a soft chime plus a desktop notification when you've slouched past your limit, and optional stand-up break reminders. The tab title and icon turn red too, so you can see it from any tab.
- **Analytics**: good vs. slouching minutes per day against a daily goal, your best time of day, longest streaks, and a timeline of every session.
- **Private by design**: pose detection runs in your browser with [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). No video or data leaves your machine; history is kept in your browser's local storage.

## How it works
1. **Calibrate** once: sit the way you'd like to sit all day for about 5 seconds. LockedIn saves that as your baseline.
2. LockedIn compares each frame to the baseline using head-to-shoulder distance, shoulder width (leaning in), shoulder tilt and head tilt, all measured relative to your shoulder width so it doesn't matter how far you sit from the camera.
3. That becomes a 0 to 100 score. Below 70 counts as slouching. Sensitivity is adjustable in Settings.

Tracking keeps running while the tab is in the background, so you can leave it open next to your work.

## Run it
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:5173 and allow camera access. Or run `docker compose up` from the repo root.
