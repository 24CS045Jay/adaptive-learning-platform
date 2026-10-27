import { spawn, execSync } from "child_process";
import path from "path";
import http from "http";
import net from "net";

console.log("==================================================================");
console.log("🚀 Starting Full University Agentic RAG Platform Services:");
console.log("  [1] Python Agentic RAG Service  --> http://127.0.0.1:8001");
console.log("  [2] Express Backend API        --> http://localhost:5000");
console.log("  [3] Vite React Web Frontend    --> http://localhost:8080 (or :5173)");
console.log("==================================================================");

const isWindows = process.platform === "win32";
const pythonCmd = isWindows ? "python" : "python3";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const ragServiceDir = path.join(process.cwd(), "rag_service");

let ragProcess = null;
let serverProcess = null;
let viteProcess = null;
let isShuttingDown = false;

// Quick TCP port check to prevent Errno 10048 / EADDRINUSE conflicts
function checkTcpPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function checkService(port, checkPath = "/health", timeout = 3500) {
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port, path: checkPath, timeout }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// 1. Launch Python Agentic RAG Service (Port 8001)
async function initRag() {
  const tcpActive = await checkTcpPort(8001);
  if (tcpActive) {
    const isHealthy = await checkService(8001, "/health");
    if (isHealthy) {
      console.log("  ✅ Python Agentic RAG Service is ALREADY running & healthy on http://127.0.0.1:8001");
    } else {
      console.log("  ℹ️ Port 8001 is already bound by an active process. Reusing existing instance.");
    }
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

  ragProcess.on("exit", async (code) => {
    if (isShuttingDown) return;
    if (code !== 0) {
      const portInUse = await checkTcpPort(8001);
      if (portInUse) {
        console.log("  ℹ️ Port 8001 is active. Skipping restart loop.");
        return;
      }
      console.warn(`[Dev System] RAG service exited with code ${code}. Auto-restarting in 2s...`);
      setTimeout(startRag, 2000);
    }
  });
}

// 2. Launch Express Backend Server (Port 5000)
async function initServer() {
  const tcpActive = await checkTcpPort(5000);
  if (tcpActive) {
    const isHealthy = await checkService(5000, "/api/health");
    if (isHealthy) {
      console.log("  ✅ Express Backend Server is ALREADY running & healthy on http://localhost:5000");
    } else {
      console.log("  ℹ️ Port 5000 is already bound by an active process. Reusing existing instance.");
    }
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

  serverProcess.on("exit", async (code) => {
    if (isShuttingDown) return;
    if (code !== 0) {
      const portInUse = await checkTcpPort(5000);
      if (portInUse) {
        console.log("  ℹ️ Port 5000 is active. Skipping restart loop.");
        return;
      }
      console.warn(`[Dev System] Express server exited with code ${code}. Auto-restarting in 2s...`);
      setTimeout(startServer, 2000);
    }
  });
}

// 3. Launch Vite Dev Server
async function startVite() {
  if (isShuttingDown) return;
  const is8080Active = await checkTcpPort(8080);
  const is5173Active = await checkTcpPort(5173);
  if (is8080Active || is5173Active) {
    const port = is8080Active ? 8080 : 5173;
    console.log(`  ✅ Vite Dev Server is ALREADY running on http://localhost:${port}`);
    return;
  }

  viteProcess = spawn(npxCmd, ["vite", "dev", "--force"], {
    stdio: "inherit",
    shell: true,
  });
}

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (isWindows) {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
    } else {
      proc.kill("SIGTERM");
    }
  } catch {}
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  const spawnedAny = ragProcess || serverProcess || viteProcess;
  if (spawnedAny) {
    console.log("\n[Dev System] Stopping services spawned in this session...");
    killProcessTree(ragProcess);
    killProcessTree(serverProcess);
    killProcessTree(viteProcess);
  } else {
    console.log("\n[Dev System] Exiting monitor. Services remain running in the background.");
    console.log("💡 To stop all background services, run: npm run clean:ports");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

async function main() {
  if (process.argv.includes("--restart") || process.argv.includes("-r")) {
    console.log("🔄 --restart flag detected. Clearing development ports first...");
    try {
      execSync("node scripts/kill-ports.js", { stdio: "inherit" });
    } catch {}
  }

  await initRag();
  await initServer();
  await startVite();

  console.log("\n==================================================================");
  console.log("✨ University Agentic RAG Platform is ACTIVE & READY:");
  console.log("  🌐 Web Frontend:        http://localhost:8080");
  console.log("  ⚙️ Express Backend API: http://localhost:5000 (Health: /api/health)");
  console.log("  🧠 Python Agentic RAG:  http://127.0.0.1:8001 (Health: /health)");
  console.log("==================================================================");
  console.log("🟢 Dev session running. Press [Ctrl + C] to stop services.");
  console.log("💡 To restart fresh or free locked ports, run: npm run clean:ports\n");

  // Keep event loop alive and monitor services health every 15s
  setInterval(async () => {
    if (isShuttingDown) return;
    const [ragOk, serverOk, vite8080Ok, vite5173Ok] = await Promise.all([
      checkTcpPort(8001),
      checkTcpPort(5000),
      checkTcpPort(8080),
      checkTcpPort(5173),
    ]);
    if (!ragOk) console.warn("⚠️ [Dev System] Python Agentic RAG (8001) is unreachable.");
    if (!serverOk) console.warn("⚠️ [Dev System] Express Backend API (5000) is unreachable.");
    if (!vite8080Ok && !vite5173Ok) console.warn("⚠️ [Dev System] Vite Dev Server (8080) is unreachable.");
  }, 15000);
}

main();
