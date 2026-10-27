import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TARGET_PORTS = [8001, 5000, 8080, 5173, 3000];
const isWindows = process.platform === "win32";

console.log("🧹 Checking for active/stale processes on development ports:", TARGET_PORTS.join(", "));

const killedPids = new Set();

for (const port of TARGET_PORTS) {
  try {
    if (isWindows) {
      // Find owning PID via netstat
      const output = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const lines = output.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && !killedPids.has(pid) && pid !== String(process.pid)) {
          console.log(`  -> Terminating process PID ${pid} listening on port ${port}...`);
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
            killedPids.add(pid);
          } catch {}
        }
      }
    } else {
      const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .split(/\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const pid of pids) {
        if (!killedPids.has(pid) && pid !== String(process.pid)) {
          console.log(`  -> Terminating process PID ${pid} on port ${port}...`);
          try {
            execSync(`kill -9 ${pid}`, { stdio: "ignore" });
            killedPids.add(pid);
          } catch {}
        }
      }
    }
  } catch {
    // Port is free or no process found
  }
}

if (killedPids.size > 0) {
  console.log(`✅ Successfully freed ${killedPids.size} process(es) holding development ports.`);
} else {
  console.log("✅ All target ports are clear or already released.");
}

// Clean stale Vite pre-bundled deps cache
try {
  const viteCache = path.join(process.cwd(), "node_modules", ".vite");
  if (fs.existsSync(viteCache)) {
    fs.rmSync(viteCache, { recursive: true, force: true });
    console.log("🧹 Cleared stale Vite pre-bundle cache (node_modules/.vite).");
  }
} catch {}
