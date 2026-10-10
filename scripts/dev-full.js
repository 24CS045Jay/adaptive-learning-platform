import { spawn } from "child_process";
import path from "path";

console.log("==================================================================");
console.log("🚀 Starting Full University Agentic RAG Platform Services:");
console.log("  [1] Python Agentic RAG Service  --> http://localhost:8001");
console.log("  [2] Express Backend API        --> http://localhost:5000");
console.log("  [3] Vite React Web Frontend    --> http://localhost:5173 (or :3000)");
console.log("==================================================================");

const isWindows = process.platform === "win32";
const pythonCmd = isWindows ? "python" : "python3";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const ragServiceDir = path.join(process.cwd(), "rag_service");

// 1. Launch Python Agentic RAG Service (Port 8001)
const ragProcess = spawn(
  pythonCmd,
  ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload", "--reload-dir", "app"],
  {
    cwd: ragServiceDir,
    stdio: "inherit",
    shell: true,
  }
);

// 2. Launch Express Backend Server (Port 5000)
const serverProcess = spawn("node", ["server.express.js"], {
  stdio: "inherit",
  shell: true,
});

// 3. Launch Vite Dev Server
const viteProcess = spawn(npxCmd, ["vite", "dev"], {
  stdio: "inherit",
  shell: true,
});

function cleanup() {
  console.log("\n[Dev System] Stopping all services...");
  try { ragProcess.kill(); } catch {}
  try { serverProcess.kill(); } catch {}
  try { viteProcess.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
