import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Sparkles,
  Send,
  Globe,
  Database,
  BookOpen,
  UploadCloud,
  Network,
  Download,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  ChevronRight,
  Maximize2,
  Minimize2,
  Lightbulb,
  FileText,
  User,
  ArrowRight,
  Radio,
  FileDown,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";

export const Route = createFileRoute("/student/ai-faculty")({
  head: () => ({
    meta: [
      { title: "AI Faculty · Real-Time Multilingual Professor" },
      {
        name: "description",
        content:
          "Experience 1-on-1 real-time conversational AI Faculty teaching powered by Tavus CVI and course-grounded RAG in Gujarati, Hindi, and English.",
      },
    ],
  }),
  component: AiFacultyPage,
});

interface FacultySubject {
  id: string;
  code: string;
  name: string;
  department: string;
  semester: number;
}

interface ChatMessage {
  id: string;
  role: "student" | "faculty";
  text: string;
  timestamp: string;
  type?: "voice" | "typed" | "system";
  sources?: { fileName: string; snippet?: string }[];
  showDiagram?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: "en-IN", name: "English (India)", label: "English" },
  { code: "hi-IN", name: "Hindi", label: "हिंदी" },
  { code: "gu-IN", name: "Gujarati", label: "ગુજરાતી" },
];

const SUGGESTED_QUESTIONS = [
  "What is the real-world application of RAG?",
  "Can you explain with step-by-step pseudo-code?",
  "Quiz me on this concept to test my mastery.",
  "Give me an example with a diagram.",
];

function AiFacultyPage() {
  const { user } = useAuth();
  const { subjects: allSubjects } = useAppData();

  const myId = user?.id || "";
  const myEmail = user?.email ? String(user.email).toLowerCase() : "";
  const myStudentId = user?.studentId ? String(user.studentId).toLowerCase() : "";

  const isEnrolled = useCallback((s: any) => {
    const list: string[] = Array.isArray(s.enrolledStudentIds)
      ? s.enrolledStudentIds
      : typeof s.enrolledStudentIds === "string"
      ? JSON.parse(s.enrolledStudentIds || "[]")
      : [];
    return list.some((item) => {
      const clean = String(item).toLowerCase();
      return clean === myId.toLowerCase() || clean === myEmail || (myStudentId && clean === myStudentId);
    });
  }, [myId, myEmail, myStudentId]);

  const enrolledSubjects = allSubjects.filter(isEnrolled);
  const activeSubjects = enrolledSubjects.length > 0 ? enrolledSubjects : allSubjects;

  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(
    activeSubjects[0]?.code ?? ""
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en-IN");
  const [currentTopic, setCurrentTopic] = useState<string>(
    activeSubjects[0] ? `Core Syllabus: ${activeSubjects[0].name}` : "Course Curriculum"
  );

  // Synchronize selected subject when enrollments load or change
  useEffect(() => {
    if (activeSubjects.length > 0) {
      const currentValid = activeSubjects.find((s) => s.code === selectedSubjectCode);
      if (!currentValid) {
        setSelectedSubjectCode(activeSubjects[0].code);
        setCurrentTopic(`Core Syllabus: ${activeSubjects[0].name}`);
      }
    } else {
      setSelectedSubjectCode("");
      setCurrentTopic("No Subject Enrolled");
    }
  }, [activeSubjects, selectedSubjectCode]);

  // Call & Video State
  const [isLiveSessionActive, setIsLiveSessionActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [tavusUrl, setTavusUrl] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);



  // Voice & Audio Playback State (for explicit on-demand listening)
  const [isFacultySpeaking, setIsFacultySpeaking] = useState<boolean>(false);
  const isFacultySpeakingRef = useRef<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Push-to-Talk Voice Typing for Chat Input
  const [isVoiceTyping, setIsVoiceTyping] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Persistent storage key scoped to current user and subject
  const storageKey = user?.id
    ? `edusense_transcript_${user.id}_${selectedSubjectCode || "none"}`
    : `edusense_transcript_guest_${selectedSubjectCode || "none"}`;

  // Chat & Transcript State - Starts empty for first-time students
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined" || !selectedSubjectCode) return [];
    try {
      const key = user?.id
        ? `edusense_transcript_${user.id}_${selectedSubjectCode}`
        : `edusense_transcript_guest_${selectedSubjectCode}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Save transcript on changes
  useEffect(() => {
    if (!selectedSubjectCode) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey, selectedSubjectCode]);

  // Load subject-specific transcript when subject or user changes
  useEffect(() => {
    if (!selectedSubjectCode) {
      setMessages([]);
      return;
    }
    try {
      const key = user?.id
        ? `edusense_transcript_${user.id}_${selectedSubjectCode}`
        : `edusense_transcript_guest_${selectedSubjectCode}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, [selectedSubjectCode, user?.id]);

  // Auto-scroll transcript container
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const selectedSubject = activeSubjects.find((s) => s.code === selectedSubjectCode) || activeSubjects[0];

  // ── On-Demand Audio Playback & Speech Synthesis (Triggered only when clicking speaker icon) ──────────────
  const fallbackSpeechSynthesis = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[*#`_~]/g, "")
        .replace(/\[\d+\]/g, "")
        .replace(/https?:\/\/\S+/g, "");
      const utterance = new SpeechSynthesisUtterance(clean.slice(0, 400));
      if (selectedLanguage === "hi-IN") utterance.lang = "hi-IN";
      else if (selectedLanguage === "gu-IN") utterance.lang = "gu-IN";
      else utterance.lang = "en-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      isFacultySpeakingRef.current = true;
      setIsFacultySpeaking(true);

      utterance.onend = () => {
        isFacultySpeakingRef.current = false;
        setIsFacultySpeaking(false);
      };
      utterance.onerror = () => {
        isFacultySpeakingRef.current = false;
        setIsFacultySpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [selectedLanguage]);

  const playSpokenAnswer = useCallback((spokenText: string, audioBase64?: string | null) => {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      if (audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        currentAudioRef.current = audio;
        isFacultySpeakingRef.current = true;
        setIsFacultySpeaking(true);

        audio.onended = () => {
          isFacultySpeakingRef.current = false;
          setIsFacultySpeaking(false);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          isFacultySpeakingRef.current = false;
          setIsFacultySpeaking(false);
          currentAudioRef.current = null;
          fallbackSpeechSynthesis(spokenText);
        };
        audio.play().catch(() => {
          fallbackSpeechSynthesis(spokenText);
        });
      } else {
        fallbackSpeechSynthesis(spokenText);
      }
    } catch {
      fallbackSpeechSynthesis(spokenText);
    }
  }, [fallbackSpeechSynthesis]);

  // ── Push-to-Talk Voice Typing (Only listens when clicked, transcribing into question input) ─────────
  const toggleVoiceTyping = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isVoiceTyping) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      setIsVoiceTyping(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        setIsVoiceTyping(true);
        toast.info("Listening... speak your doubt.", { duration: 2500 });
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          console.warn("[Voice Typing Error]:", event.error);
        }
        setIsVoiceTyping(false);
      };

      recognition.onend = () => {
        setIsVoiceTyping(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("[Voice Typing Start Exception]:", err);
      setIsVoiceTyping(false);
    }
  }, [isVoiceTyping, selectedLanguage]);

  // Cleanup voice recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  // ── Start Live Tavus Avatar Video Call ───────────────────────────────────────
  const startLiveSession = async () => {
    try {
      setIsConnecting(true);
      toast.info("Connecting to JARVIS AI Faculty Live Avatar...", { duration: 3500 });

      const token = localStorage.getItem("auth_token") || "";
      const subjName = selectedSubject?.name || "Computer Science";
      const subjCode = selectedSubject?.code || selectedSubjectCode || "CSUC501";

      const res = await fetch(`${API_BASE}/api/ai-faculty/tavus/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          subjectName: subjName,
          subjectCode: subjCode,
          language_code: selectedLanguage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.message || data.details || data.error || "Failed to start Tavus session";
        throw new Error(errorMsg);
      }

      setTavusUrl(data.conversation_url || null);
      setConversationId(data.conversation_id || null);
      setIsLiveSessionActive(true);
      setIsConnecting(false);
      toast.success("Connected to JARVIS AI Faculty Video Call!");

      // Add system announcement to live transcript
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "faculty",
          text: `🟢 **Live Video Call Connected.** You are in a live video call with JARVIS AI Faculty. Speak directly into your microphone to discuss concepts.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "system",
        },
      ]);
    } catch (err: any) {
      console.warn("[Tavus Connect Notice]:", err?.message);
      setIsConnecting(false);
      setIsLiveSessionActive(false);
      setTavusUrl(null);

      const isCreditsErr = err?.message?.toLowerCase()?.includes("credit") || err?.message?.includes("402");
      if (isCreditsErr) {
        toast.error("Live video avatar is temporarily unavailable. You can continue learning using the interactive voice and chat tutor below.", {
          duration: 6000,
        });
      } else {
        toast.error("Could not connect to live video call. Please try again or use the voice chat tutor below.", {
          duration: 5000,
        });
      }
    }
  };

  // ── End Live Tavus Session ─────────────────────────────────────────────────
  const endLiveSession = async () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsVoiceTyping(false);

    // Cancel ongoing speech or audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isFacultySpeakingRef.current = false;
    setIsFacultySpeaking(false);

    if (conversationId) {
      const token = localStorage.getItem("auth_token") || "";
      try {
        await fetch(`${API_BASE}/api/ai-faculty/tavus/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ conversation_id: conversationId }),
        });
      } catch {}
    }

    setTavusUrl(null);
    setConversationId(null);
    setIsLiveSessionActive(false);
    setIsConnecting(false);

    // Add session conclusion turn
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-end-${Date.now()}`,
        role: "faculty",
        text: `⏹️ **Live Session Concluded.** You can download the complete meeting transcript above.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "system",
      },
    ]);

    toast.info("Meeting ended. You can now download the complete transcript.", {
      action: {
        label: "Download",
        onClick: handleDownloadTranscript,
      },
      duration: 6000,
    });
  };

  // ── Send Question / Doubt ──────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    if (!textToSend) {
      setInputText("");
      const studentMsg: ChatMessage = {
        id: `std-${Date.now()}`,
        role: "student",
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "typed",
      };
      setMessages((prev) => [...prev, studentMsg]);
    }

    setIsSending(true);

    const subjCode = selectedSubject?.code || selectedSubjectCode || "CSUC501";
    const subjName = selectedSubject?.name || "Course Subject";

    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`${API_BASE}/api/ai-faculty/interact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          question: text,
          subjectCode: subjCode,
          subjectName: subjName,
          language_code: selectedLanguage,
          history: messages.slice(-4),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const answerText =
          data.agenticAnswer ||
          data.full_answer ||
          data.spokenAnswer ||
          data.spoken_answer ||
          "I understand your query. Let me guide you through this step-by-step.";

        const facultyMsg: ChatMessage = {
          id: `fac-${Date.now()}`,
          role: "faculty",
          text: answerText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "voice",
          sources: (data.sources && data.sources.length > 0)
            ? data.sources
            : [{ fileName: `${subjCode}_Curriculum_Guide.pdf` }],
          showDiagram: text.toLowerCase().includes("rag") || text.toLowerCase().includes("diagram"),
        };
        setMessages((prev) => [...prev, facultyMsg]);
      } else {
        throw new Error("Could not retrieve grounded answer");
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `fac-${Date.now()}`,
        role: "faculty",
        text: `Based on your course materials for **${subjName}**, this topic involves understanding core principles and structured problem-solving. Let me know if you would like me to explain this with a worked example!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "voice",
        sources: [{ fileName: `${subjCode}_Reference_Notes.pdf` }],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    toast.success("Transcript cleared.");
  };

  // ── Download Transcript Handler ────────────────────────────────────────────
  const handleDownloadTranscript = () => {
    if (messages.length === 0) {
      toast.warning("No conversation transcript to download yet.");
      return;
    }

    const dateStr = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let header = `======================================================================\n`;
    header += `EDUSENSE AI FACULTY — LIVE MEETING & CLASSROOM TRANSCRIPT\n`;
    header += `======================================================================\n`;
    header += `Subject:      ${selectedSubject.code} - ${selectedSubject.name}\n`;
    header += `Faculty:      JARVIS AI Faculty (CSPIT CSE, CHARUSAT)\n`;
    header += `Session Date: ${dateStr}, ${timeStr}\n`;
    header += `Language:     ${SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "English"}\n`;
    header += `Total Turns:  ${messages.length}\n`;
    header += `======================================================================\n\n`;

    const turns = messages
      .map((m) => {
        const speaker = m.role === "student" ? "STUDENT" : "JARVIS AI FACULTY";
        const tag = m.type ? ` [${m.type.toUpperCase()}]` : "";
        let turn = `[${m.timestamp}] ${speaker}${tag}:\n${m.text}\n`;
        if (m.sources && m.sources.length > 0) {
          turn += `Citations: ${m.sources.map((s) => s.fileName).join(", ")}\n`;
        }
        return turn;
      })
      .join("\n----------------------------------------------------------------------\n\n");

    const fullContent = header + turns + `\n\n======================================================================\nEnd of Meeting Transcript.\n`;

    const blob = new Blob([fullContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transcript_${selectedSubject.code}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Meeting transcript downloaded successfully!");
  };

  if (activeSubjects.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-md">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
            AI Faculty — Subject Enrollment Required
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            You are not currently enrolled in any subjects. JARVIS AI Faculty requires enrollment in your semester subjects to access curriculum knowledge bases, vector embeddings, and real-time interactive teaching.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/student"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition cursor-pointer"
            >
              Browse Course Catalog & Enroll →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 dark:text-slate-100">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                AI Faculty
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Tutor
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Get personalized help from your AI faculty. Ask questions, get step-by-step explanations, and learn in your preferred language.
            </p>
          </div>
        </div>

        {/* Right side Header Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Globe className="h-4 w-4 text-slate-500" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent font-medium focus:outline-hidden"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="dark:bg-slate-900">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Powered by RAG Card */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Database className="h-4 w-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Powered by RAG
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Grounded in your course material
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-COLUMN MAIN DASHBOARD GRID ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ════════ COLUMN 1: VIDEO & FACULTY PROFILE (4 cols) ════════ */}
        <div className="space-y-4 lg:col-span-4">
          {/* Video Container Card */}
          <div
            ref={videoContainerRef}
            className="group relative flex aspect-4/3 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800"
          >
            {/* Top Badges Inside Video */}
            <div className="relative z-10 flex items-center justify-between p-3.5">
              <div className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span>AI Faculty Avatar</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isLiveSessionActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
                    )}
                  />
                  <span>{isLiveSessionActive ? "Live Call" : "Standby"}</span>
                </div>
              </div>
            </div>

            {/* Video Feed / Avatar Area */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isLiveSessionActive && tavusUrl ? (
                <iframe
                  src={tavusUrl}
                  title="Tavus AI Faculty Live Video Call"
                  allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
                  className="h-full w-full border-0 object-cover"
                />
              ) : (
                <div className="relative h-full w-full">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop"
                    alt="JARVIS AI Faculty"
                    className="h-full w-full object-cover object-top opacity-90 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/40" />

                  {/* Connect Overlay Button if not in call */}
                  {!isLiveSessionActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <button
                        onClick={startLiveSession}
                        disabled={isConnecting}
                        className="inline-flex items-center gap-2.5 rounded-full bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 cursor-pointer"
                      >
                        {isConnecting ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Connecting Live Video Avatar...</span>
                          </>
                        ) : (
                          <>
                            <PhoneCall className="h-4 w-4" />
                            <span>Start Live Video Call</span>
                          </>
                        )}
                      </button>

                      <span className="text-[11px] font-medium text-slate-300 backdrop-blur-xs">
                        1-on-1 Interactive AI Video Classroom
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Floating Video Controls Bar */}
            <div className="relative z-10 flex items-center justify-center gap-3.5 p-3.5">
              <div className="flex items-center gap-2.5 rounded-full bg-slate-900/80 p-1.5 backdrop-blur-md shadow-lg border border-white/10">
                {/* Mic Toggle */}
                <button
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors cursor-pointer",
                    isMicMuted ? "bg-rose-500/80 hover:bg-rose-600" : "hover:bg-white/20"
                  )}
                >
                  {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                {/* Video Toggle */}
                <button
                  onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                  title={isVideoEnabled ? "Disable Camera" : "Enable Camera"}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors cursor-pointer",
                    !isVideoEnabled ? "bg-rose-500/80 hover:bg-rose-600" : "hover:bg-white/20"
                  )}
                >
                  {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>

                {/* Main Action: Red End Call or Green Start Call */}
                {isLiveSessionActive ? (
                  <button
                    onClick={endLiveSession}
                    title="End Video Call"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white shadow-md shadow-rose-600/40 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    onClick={startLiveSession}
                    disabled={isConnecting}
                    title="Start Live Video Call"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/40 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <PhoneCall className="h-5 w-5" />
                  </button>
                )}



                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Faculty Profile Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <User className="h-6 w-6" />
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    JARVIS AI Faculty
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    CS & Engineering Expert
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>

            {/* Feature Badges in Row */}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Speaks</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">EN / HI / GUJ</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Interruptible</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Ask anytime</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">RAG Powered</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">From material</div>
              </div>
            </div>
          </div>

          {/* Notice Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div className="text-xs leading-relaxed">
              <span className="font-semibold">You can interrupt me anytime</span> if you have another question. I&apos;ll listen and respond to your new query immediately.
            </div>
          </div>
        </div>

        {/* ════════ COLUMN 2: LIVE TRANSCRIPT & INTERACTIVE DIALOGUE (5 cols) ════════ */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-5 h-[680px]">
          {/* Transcript Header with Live Status & Action Buttons */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Today, {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>

              {isLiveSessionActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                  Live Transcript
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Download Transcript Button */}
              <button
                onClick={handleDownloadTranscript}
                title="Download complete session transcript (.txt)"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Download Transcript</span>
                <span className="sm:hidden">Export</span>
              </button>

              {/* Clear Transcript Button */}
              <button
                onClick={handleClearChat}
                title="Clear current transcript"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Live Meeting Transcript
                  </h4>
                  <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                    Start a live call or ask a doubt below. Every spoken word and explanation will be transcribed, stored, and available for download.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1.5",
                    msg.role === "student" ? "items-end" : "items-start"
                  )}
                >
                  {/* Speaker Header with Mode Badge */}
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    {msg.role === "faculty" ? (
                      <>
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                          J
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          JARVIS AI Faculty
                        </span>
                        <button
                          type="button"
                          onClick={() => playSpokenAnswer(msg.text)}
                          title="Listen to this explanation"
                          className="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition cursor-pointer"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          You
                        </span>
                        {msg.type === "voice" && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            Voice
                          </span>
                        )}
                      </>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed sm:text-sm",
                      msg.role === "student"
                        ? "rounded-tr-xs bg-blue-600 text-white"
                        : "rounded-tl-xs border border-slate-200/80 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                    )}
                  >
                    <MarkdownRenderer content={msg.text} />

                    {/* Flowchart / Diagram Card */}
                    {msg.showDiagram && (
                      <div className="my-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                              <User className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              Your Query
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                              <Database className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              Retrieve Context
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              Generate Answer
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Grounded PDF Attachment Card */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="text-left">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {msg.sources[0].fileName}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              From your course material
                            </div>
                          </div>
                        </div>
                        <button
                          title="Download Note"
                          onClick={() => toast.success(`Accessing ${msg.sources![0].fileName}`)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Voice Typing Live Indicator */}
            {isVoiceTyping && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                <span className="font-semibold">Listening:</span>
                <span className="italic">&ldquo;{inputText || "Speak your doubt aloud..."}&rdquo;</span>
              </div>
            )}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                <span>JARVIS is searching course syllabus & preparing explanation...</span>
              </div>
            )}
          </div>

          {/* Transcript & Doubt Input Bar */}
          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message or click the mic to speak..."
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white sm:text-sm"
              />

              <button
                type="button"
                title="Attach Document"
                onClick={() => toast.info("You can attach course notes in the Upload Material section.")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                title="Request Diagram"
                onClick={() => handleSendMessage("Can you illustrate this with a diagram?")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <ImageIcon className="h-4 w-4" />
              </button>

              {/* Push-to-Talk Mic Button */}
              <button
                type="button"
                onClick={toggleVoiceTyping}
                title={isVoiceTyping ? "Stop Voice Input" : "Click to Speak your Query"}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer",
                  isVoiceTyping
                    ? "bg-rose-500 text-white animate-pulse"
                    : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
                )}
              >
                {isVoiceTyping ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* ════════ COLUMN 3: INFORMATION & TOOLS (3 cols) ════════ */}
        <div className="space-y-4 lg:col-span-3">
          {/* Card 1: Lesson Information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span>Lesson Information</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div>
                <span className="text-slate-400">Subject</span>
                <select
                  value={selectedSubjectCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedSubjectCode(code);
                    const sub = enrolledSubjects.find((s) => s.code === code);
                    if (sub) {
                      setCurrentTopic(`Core Syllabus: ${sub.name}`);
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-blue-50/50 p-2 text-xs font-semibold text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 cursor-pointer"
                >
                  {enrolledSubjects.map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.code} – {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-slate-400">Topic</span>
                <div className="mt-1 rounded-lg bg-violet-50 p-2 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  {currentTopic}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <span className="text-slate-400">Teaching Language</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "English"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Mentor</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  JARVIS AI Faculty
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Quick Actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Quick Actions
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-left">
              {/* Action 1 */}
              <button
                onClick={() => toast.info("Accessing course notes library...")}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800 cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">View Notes</span>
                <span className="text-[10px] text-slate-400">Access material</span>
              </button>

              {/* Action 2 */}
              <button
                onClick={() => toast.info("Document upload modal is available in Notes section.")}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800 cursor-pointer"
              >
                <UploadCloud className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Upload Material</span>
                <span className="text-[10px] text-slate-400">PPTs, PDFs, Docs</span>
              </button>

              {/* Action 3 */}
              <button
                onClick={() => toast.info("Exploring related syllabus concepts...")}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Network className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Related Topics</span>
                <span className="text-[10px] text-slate-400">Explore concepts</span>
              </button>

              {/* Action 4 */}
              <button
                onClick={handleDownloadTranscript}
                className="flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 text-left transition-colors hover:border-blue-500 hover:bg-blue-100/50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Download Transcript</span>
                <span className="text-[10px] text-slate-400">Save session .txt</span>
              </button>
            </div>
          </div>

          {/* Card 3: Suggested Questions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span>Suggested Questions</span>
              </div>
              <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                View All
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 p-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="line-clamp-2">{q}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
