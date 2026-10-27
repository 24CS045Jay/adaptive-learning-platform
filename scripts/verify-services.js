import http from "http";

async function checkUrl(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const elapsed = Date.now() - start;
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, data: json, elapsed });
        } catch {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, raw: data.slice(0, 100), elapsed });
        }
      });
    });
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout after 12000ms" });
    });
  });
}

async function verifyAll() {
  console.log("🔍 Checking status of all local platform services...\n");

  const [rag, express, vite] = await Promise.all([
    checkUrl("http://127.0.0.1:8001/health"),
    checkUrl("http://127.0.0.1:5000/api/health"),
    checkUrl("http://127.0.0.1:8080/"),
  ]);

  console.log("--------------------------------------------------");
  if (rag.ok) {
    console.log(`[RAG Service]     🟢 ONLINE (Port 8001, ${rag.elapsed}ms)`);
    console.log(`                   Vector DB: ${rag.data?.vector_store_mode || "Chroma Cloud"}`);
    console.log(`                   Collection: ${rag.data?.collection}`);
    console.log(`                   Indexed Chunks: ${rag.data?.chunk_count}`);
    console.log(`                   Chroma Connected: ${rag.data?.chroma_connected}`);
    console.log(`                   LLMs: ${rag.data?.llm_providers_configured?.join(", ")}`);
  } else {
    console.log(`[RAG Service]     🔴 OFFLINE / UNREACHABLE:`, rag.error || rag.status);
  }

  console.log("--------------------------------------------------");
  if (express.ok) {
    console.log(`[Express API]     🟢 ONLINE (Port 5000, ${express.elapsed}ms)`);
    console.log(`                   Service: ${express.data?.service}`);
    console.log(`                   Configured RAG URL: ${express.data?.rag_service}`);
  } else {
    console.log(`[Express API]     🔴 OFFLINE / UNREACHABLE:`, express.error || express.status);
  }

  console.log("--------------------------------------------------");
  if (vite.ok) {
    console.log(`[Vite Web App]    🟢 ONLINE (Port 8080, ${vite.elapsed}ms)`);
  } else {
    console.log(`[Vite Web App]    🔴 OFFLINE / UNREACHABLE:`, vite.error || vite.status);
  }
  console.log("--------------------------------------------------\n");

  const allHealthy = rag.ok && express.ok && vite.ok;
  console.log(allHealthy ? "🎉 ALL SERVICES ARE UP, HEALTHY, AND REACHABLE!" : "⚠️ Some services could not be reached.");
}

verifyAll();
