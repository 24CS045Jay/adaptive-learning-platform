import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language?: string;
  disabled?: boolean;
}

// Map app language code to BCP-47 speech recognition language tag
const LANG_MAP: Record<string, string> = {
  en: "en-US",
  gu: "gu-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  es: "es-ES",
  fr: "fr-FR",
};

export function VoiceInputButton({
  onTranscript,
  language = "en",
  disabled = false,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API availability
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LANG_MAP[language] || "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[VoiceInput] Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. You can continue typing your question.");
        } else if (event.error === "no-speech") {
          toast.info("No speech detected. Try speaking closer to the microphone.");
        } else if (event.error !== "aborted") {
          toast.error(`Voice recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("[VoiceInput] Failed to initialize SpeechRecognition:", err);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [language, onTranscript]);

  const toggleListening = () => {
    if (!isSupported) {
      toast.info("Voice input is not supported in this browser. Please use Google Chrome, Edge, or Safari.");
      return;
    }

    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = LANG_MAP[language] || "en-US";
        recognitionRef.current.start();
        toast.info("Listening... Speak your question now.");
      } catch (err: any) {
        console.warn("[VoiceInput] Start failed:", err);
        // If already started, stop then restart
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Speech recognition not supported in this browser"
        className="rounded-xl p-2 text-muted-foreground/40 cursor-not-allowed transition-colors"
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      title={isListening ? "Stop voice recording" : "Speak question (Voice input)"}
      className={`relative rounded-xl p-2 transition-all ${
        isListening
          ? "bg-red-500/20 text-red-500 ring-2 ring-red-500/50 animate-pulse"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {isListening ? (
        <span className="flex items-center gap-1">
          <Mic className="h-4 w-4 text-red-500" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        </span>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
