/**
 * callLLM — reusable Gemini → Groq fallback helper.
 *
 * Tries the Gemini API first; if it throws or returns a non-ok response,
 * transparently retries the same prompt against Groq.
 *
 * Returns: { text: string, provider: "gemini" | "groq" }
 */

export async function callLLM(systemPrompt, userPrompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GROQ_API_KEY   = process.env.GROQ_API_KEY;

  const GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

  // ── Try Gemini ─────────────────────────────────────────────────────────────
  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes("your_")) {
    try {
      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      };

      const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        if (text) {
          return { text, provider: "gemini" };
        }
      } else {
        const errBody = await res.text();
        console.warn(
          `[LLM] Gemini returned ${res.status}: ${errBody.slice(0, 200)} — falling back to Groq`
        );
      }
    } catch (err) {
      console.warn("[LLM] Gemini call failed:", err.message, "— falling back to Groq");
    }
  } else {
    console.warn("[LLM] GEMINI_API_KEY not set — skipping Gemini, trying Groq");
  }

  // ── Fallback: Groq ─────────────────────────────────────────────────────────
  if (!GROQ_API_KEY) {
    throw new Error("Neither GEMINI_API_KEY nor GROQ_API_KEY is configured.");
  }

  const groqBody = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 1024,
  };

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(groqBody),
    signal: AbortSignal.timeout(8000),
  });

  if (!groqRes.ok) {
    const errBody = await groqRes.text();
    throw new Error(`Groq API error ${groqRes.status}: ${errBody.slice(0, 400)}`);
  }

  const groqData = await groqRes.json();
  const text = groqData?.choices?.[0]?.message?.content?.trim() ?? "";
  return { text, provider: "groq" };
}
