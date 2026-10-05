import { spawn } from "child_process";

console.log("[Dev System] Starting Express Backend API (Port 5000) & Vite Web Frontend...");

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";

// Launch Express Backend Server (server.express.js)
const serverProcess = spawn("node", ["server.express.js"], {
  stdio: "inherit",
  shell: true,
});

// Launch Vite Dev Server
const viteProcess = spawn(npxCmd, ["vite", "dev"], {
  stdio: "inherit",
  shell: true,
});

function cleanup() {
  console.log("\n[Dev System] Stopping services...");
  try { serverProcess.kill(); } catch {}
  try { viteProcess.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
