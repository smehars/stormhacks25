// Serves MediaPipe's WASM runtime from this app instead of a CDN, so the
// runtime always matches the installed @mediapipe/tasks-vision version.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = resolve(root, "public/mediapipe");
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
