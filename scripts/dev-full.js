import { spawn } from "child_process";
import path from "path";
import http from "http";

console.log("==================================================================");
console.log("🚀 Starting Full University Agentic RAG Platform Services:");
console.log("  [1] Python Agentic RAG Service  --> http://127.0.0.1:8001");
console.log("  [2] Express Backend API        --> http://localhost:5000");
console.log("  [3] Vite React Web Frontend    --> http://localhost:5173 (or :3000)");
console.log("==================================================================");

const isWindows = process.platform === "win32";
const pythonCmd = isWindows ? "python" : "python3";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const ragServiceDir = path.join(process.cwd(), "rag_service");

let ragProcess = null;
let serverProcess = null;
let viteProcess = null;
let isShuttingDown = false;

function checkService(port, checkPath = "/health") {
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port, path: checkPath, timeout: 1200 }, (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// 1. Launch Python Agentic RAG Service (Port 8001) with auto-recovery & 127.0.0.1 bind
async function initRag() {
  const isRunning = await checkService(8001, "/health");
  if (isRunning) {
    console.log("  ✅ Python Agentic RAG Service is ALREADY running & healthy on http://127.0.0.1:8001");
    return;
  }
  startRag();
}

function startRag() {
  if (isShuttingDown) return;
  ragProcess = spawn(
    pythonCmd,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
    {
      cwd: ragServiceDir,
      stdio: "inherit",
      shell: true,
    }
  );

  ragProcess.on("exit", (code) => {
    if (!isShuttingDown && code !== 0) {
      console.warn(`[Dev System] RAG service exited with code ${code}. Auto-restarting in 2s...`);
      setTimeout(startRag, 2000);
    }
  });
}

// 2. Launch Express Backend Server (Port 5000) with auto-recovery
async function initServer() {
  const isRunning = await checkService(5000, "/api/health");
  if (isRunning) {
    console.log("  ✅ Express Backend Server is ALREADY running on http://localhost:5000");
    return;
  }
  startServer();
}

function startServer() {
  if (isShuttingDown) return;
  serverProcess = spawn("node", ["server.express.js"], {
    stdio: "inherit",
    shell: true,
  });

  serverProcess.on("exit", (code) => {
    if (!isShuttingDown && code !== 0) {
      console.warn(`[Dev System] Express server exited with code ${code}. Auto-restarting in 2s...`);
      setTimeout(startServer, 2000);
    }
  });
}

// 3. Launch Vite Dev Server
function startVite() {
  if (isShuttingDown) return;
  viteProcess = spawn(npxCmd, ["vite", "dev"], {
    stdio: "inherit",
    shell: true,
  });
}

initRag();
initServer();
startVite();

function cleanup() {
  isShuttingDown = true;
  console.log("\n[Dev System] Stopping all services...");
  try { ragProcess?.kill(); } catch {}
  try { serverProcess?.kill(); } catch {}
  try { viteProcess?.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
