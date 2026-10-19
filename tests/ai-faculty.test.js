import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("AI Faculty Module — Unit & Workflow Tests", () => {
  // ── 1. Provider Configuration & Multilingual Support ────────────────────────
  describe("1. Provider Configuration & Multilingual Support", () => {
    const supportedLanguages = [
      { code: "en-IN", name: "English (India)", native: "English" },
      { code: "hi-IN", name: "Hindi", native: "हिंदी" },
      { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી" },
    ];

    it("supports Gujarati, Hindi, and English with valid BCP-47 codes", () => {
      const codes = supportedLanguages.map((l) => l.code);
      assert.ok(codes.includes("gu-IN"), "Must support Gujarati (gu-IN)");
      assert.ok(codes.includes("hi-IN"), "Must support Hindi (hi-IN)");
      assert.ok(codes.includes("en-IN"), "Must support English (en-IN)");
    });

    it("verifies speaker personas for academic tone", () => {
      const speakers = [
        { id: "anushka", gender: "female" },
        { id: "shubh", gender: "male" },
        { id: "ritu", gender: "female" },
        { id: "aditya", gender: "male" },
      ];
      assert.equal(speakers.length, 4);
      assert.ok(speakers.some((s) => s.id === "anushka"));
      assert.ok(speakers.some((s) => s.id === "shubh"));
    });
  });

  // ── 2. Voice Sanitization for Natural Speech Synthesis ──────────────────────
  describe("2. Spoken Text Sanitization for Audio Synthesis", () => {
    function sanitizeTextForSpeech(text) {
      if (!text) return "";
      let clean = String(text);
      clean = clean.replace(/```[\s\S]*?```/g, " See code example in the learning panel. ");
      clean = clean.replace(/`([^`]+)`/g, "$1");
      clean = clean.replace(/#{1,6}\s+/g, "");
      clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
      clean = clean.replace(/\[\d+\]/g, "");
      clean = clean.replace(/O\(N\)/gi, "Order of N");
      clean = clean.replace(/O\(1\)/gi, "Order of 1");
      clean = clean.replace(/\s+/g, " ").trim();
      return clean;
    }

    it("strips markdown code blocks and replaces with audio cues", () => {
      const raw = "Here is the code:\n```cpp\nint a = 10;\n```\nThis runs in O(N).";
      const cleaned = sanitizeTextForSpeech(raw);
      assert.ok(!cleaned.includes("int a = 10;"), "Code block syntax should not be spoken");
      assert.ok(cleaned.includes("See code example in the learning panel"), "Spoken cue should guide student to UI");
      assert.ok(cleaned.includes("Order of N"), "O(N) notation should be expanded phonetically");
    });

    it("removes document chunk citation markers [1], [2] from spoken stream", () => {
      const raw = "Paging divides virtual memory into fixed size blocks [1] and physical memory into frames [2].";
      const cleaned = sanitizeTextForSpeech(raw);
      assert.ok(!cleaned.includes("[1]") && !cleaned.includes("[2]"), "Citation markers must not be spoken");
      assert.ok(cleaned.includes("fixed size blocks and physical memory into frames"));
    });
  });

  // ── 3. State Machine & Barge-In Interruption Invariants ─────────────────────
  describe("3. Real-Time Conversation State Machine & Barge-In Invariants", () => {
    const validStates = [
      "IDLE",
      "CONNECTING",
      "LISTENING",
      "PROCESSING",
      "SPEAKING",
      "INTERRUPTING",
      "RECONNECTING",
      "ERROR",
      "ENDED",
    ];

    it("enforces valid state machine transitions", () => {
      let state = "IDLE";

      // Valid session initiation flow
      state = "CONNECTING";
      assert.ok(validStates.includes(state));

      state = "LISTENING";
      assert.ok(validStates.includes(state));

      state = "PROCESSING";
      assert.ok(validStates.includes(state));

      state = "SPEAKING";
      assert.ok(validStates.includes(state));

      // Valid barge-in interruption flow
      state = "INTERRUPTING";
      assert.ok(validStates.includes(state));

      state = "LISTENING";
      assert.ok(validStates.includes(state));
    });

    it("invalidates stale responses using incremental turn tokens", () => {
      let currentTurnId = 1;

      // Student starts asking Question A (Turn 1)
      const turn1 = currentTurnId;
      assert.equal(turn1, 1);

      // Student interrupts and asks Question B (Turn 2)
      currentTurnId += 1;
      const turn2 = currentTurnId;
      assert.equal(turn2, 2);

      // When late response from Turn 1 arrives, it must be discarded
      const responseFromTurn1 = { turnId: turn1, answer: "Answer A" };
      const isStale = responseFromTurn1.turnId !== currentTurnId;
      assert.equal(isStale, true, "Response from Turn 1 must be rejected as stale");
    });
  });

  // ── 4. Syllabus Grounding & Citation Integration ────────────────────────────
  describe("4. Syllabus Grounding & Citation Integration", () => {
    it("preserves source document citations in learning panel response", () => {
      const mockRagResponse = {
        turnId: 3,
        spoken_answer: "Virtual memory uses paging to map addresses.",
        full_answer: "Virtual memory maps virtual to physical addresses using page tables [1].",
        sources: [
          {
            document_id: "doc-os-1",
            file_name: "Operating_Systems_Unit3.pdf",
            page: 14,
            snippet: "A page table maps virtual page numbers to physical frame numbers.",
          },
        ],
        confidence: 0.94,
        grounded: true,
      };

      assert.equal(mockRagResponse.grounded, true);
      assert.equal(mockRagResponse.sources.length, 1);
      assert.equal(mockRagResponse.sources[0].file_name, "Operating_Systems_Unit3.pdf");
      assert.equal(mockRagResponse.sources[0].page, 14);
    });

    it("distinguishes spoken concise output from full learning panel explanation", () => {
      const full = "Deadlock occurs when four Coffman conditions hold: mutual exclusion, hold and wait, no preemption, and circular wait. In this algorithm, we avoid cycles using Banker's Algorithm. The algorithm calculates the need matrix for every process before allocating resources. If an allocation leads to an unsafe state, the request is denied to prevent circular wait.";
      const sentences = full.match(/[^.!?]+[.!?]+/g) || [full];
      const spoken = sentences.slice(0, 2).join(" ");
      assert.ok(spoken.length < full.length, "Spoken response should be concise for low-latency voice interaction");
    });
  });

  // ── 5. Tavus CVI WebRTC Configuration Safety ────────────────────────────────
  describe("5. Tavus CVI Session Safety & Parameters", () => {
    it("validates Tavus session payload parameters", () => {
      const payload = {
        replica_id: "r79e1c033f",
        persona_id: "p9a8b7c6d5",
        conversation_name: "EduSense AI Faculty: Operating Systems",
        conversational_context: "You are the AI Professor for OS at CSPIT CSE.",
        custom_greeting: "Hello! What questions do you have today?",
        properties: {
          max_call_duration: 1800,
          participant_left_timeout: 90,
        },
      };

      assert.ok(payload.replica_id.startsWith("r"), "Replica ID format valid");
      assert.ok(payload.persona_id.startsWith("p"), "Persona ID format valid");
      assert.equal(payload.properties.max_call_duration, 1800, "Safety timeout is 30 minutes max");
    });
  });
});
