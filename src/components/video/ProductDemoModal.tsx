import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  Sparkles,
  ShieldCheck,
  Video,
  Brain,
  MessageCircle,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EduSenseMark } from "@/components/brand";
import { cn } from "@/lib/utils";

interface ProductDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORYBOARD_STEPS = [
  {
    sec: "0–2s",
    title: "Logo Reveal & Brand Identity",
    desc: "EduSense AI Emblem — Intelligent RAG-Powered for Smart Learning.",
    icon: Sparkles,
    tag: "Brand Reveal",
  },
  {
    sec: "2–5s",
    title: "Landing & Syllabus Alignment",
    desc: "Learn Smarter. Adapt Faster. Achieve More.",
    icon: BookOpenIcon,
    tag: "Core Proposition",
  },
  {
    sec: "5–9s",
    title: "Grounded Agentic RAG Tutor",
    desc: "Strict syllabus citations [1][2], LaTeX equations, and Mermaid workflow diagrams.",
    icon: MessageCircle,
    tag: "Academic Integrity",
  },
  {
    sec: "9–13s",
    title: "Adaptive Learning Engine",
    desc: "Topic-level mastery modeling, diagnostic gap detection, and personalized practice quizzes.",
    icon: Brain,
    tag: "Personalization",
  },
  {
    sec: "13–16s",
    title: "Microsoft Teams Faculty Doubts",
    desc: "Direct doubt booking with automated 1-click Microsoft Teams meeting link generation.",
    icon: Video,
    tag: "Live Scheduling",
  },
  {
    sec: "16–18s",
    title: "Closing & Call to Action",
    desc: "Empowering university students, faculty, and academic leadership.",
    icon: CheckCircle2,
    tag: "Enterprise Ready",
  },
];

function BookOpenIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function ProductDemoModal({ isOpen, onClose }: ProductDemoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(18);
  const [videoError, setVideoError] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPlaying, isMuted]);

  // Simulated playback timer for interactive walkthrough if local mp4 not found
  useEffect(() => {
    let interval: any = null;
    if (isOpen && isPlaying && videoError) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 18) {
            setIsPlaying(false);
            return 18;
          }
          const next = +(prev + 0.5).toFixed(1);
          // calculate active step
          if (next <= 2) setActiveStep(0);
          else if (next <= 5) setActiveStep(1);
          else if (next <= 9) setActiveStep(2);
          else if (next <= 13) setActiveStep(3);
          else if (next <= 16) setActiveStep(4);
          else setActiveStep(5);
          return next;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isOpen, isPlaying, videoError]);

  const togglePlay = () => {
    if (videoRef.current && !videoError) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          setVideoError(true);
          setIsPlaying(true);
        });
      }
    } else {
      if (currentTime >= 18) setCurrentTime(0);
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleReplay = () => {
    if (videoRef.current && !videoError) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      setCurrentTime(0);
      setActiveStep(0);
      setIsPlaying(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <EduSenseMark size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground">
                  EduSense AI · Official Product Demo
                </h3>
                <span className="rounded-md bg-violet/15 px-2 py-0.5 text-[10px] font-bold text-violet uppercase tracking-wider">
                  18s Authentic Showcase
                </span>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Learn Smarter. Adapt Faster. Achieve More.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video / Showcase Stage (16:9 Aspect Ratio) */}
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center">
          {/* Real HTML5 Video element */}
          {!videoError ? (
            <video
              ref={videoRef}
              src="/assets/edusense-demo.mp4"
              poster="/assets/edusense-demo-poster.png"
              playsInline
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) setDuration(videoRef.current.duration || 18);
              }}
              onEnded={() => setIsPlaying(false)}
              onError={() => {
                console.warn("[Demo Video] Local MP4 file pending; switching to interactive storyboard player.");
                setVideoError(true);
              }}
              className="h-full w-full object-contain"
            />
          ) : (
            /* Interactive Storyboard Experience */
            <div className="relative h-full w-full flex flex-col items-center justify-between p-8 text-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
              {/* Animated Scene Canvas */}
              <div className="my-auto max-w-lg">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col items-center"
                  >
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet/20 border border-violet/30 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                      {activeStep === 0 ? (
                        <EduSenseMark size="lg" />
                      ) : (
                        React.createElement(STORYBOARD_STEPS[activeStep].icon, {
                          className: "h-10 w-10 text-violet-400",
                        })
                      )}
                    </div>

                    <span className="rounded-full bg-violet/20 px-3 py-1 text-[11px] font-bold text-violet-300 uppercase tracking-widest border border-violet/30">
                      {STORYBOARD_STEPS[activeStep].tag} ({STORYBOARD_STEPS[activeStep].sec})
                    </span>

                    <h4 className="mt-3 text-2xl font-black tracking-tight text-white">
                      {STORYBOARD_STEPS[activeStep].title}
                    </h4>

                    <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-md">
                      {STORYBOARD_STEPS[activeStep].desc}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Step pills */}
              <div className="flex items-center gap-2">
                {STORYBOARD_STEPS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveStep(idx);
                      setCurrentTime(idx * 3);
                    }}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      activeStep === idx ? "w-8 bg-violet-400" : "w-2 bg-slate-700 hover:bg-slate-500"
                    )}
                    title={s.title}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Large Center Play Overlay button when paused */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition group"
            >
              <span className="flex h-18 w-18 items-center justify-center rounded-full bg-violet text-white shadow-xl transition-transform duration-200 group-hover:scale-110">
                <Play className="h-8 w-8 fill-current ml-1" />
              </span>
            </button>
          )}
        </div>

        {/* Video Player Controls Bar */}
        <div className="border-t border-border/80 bg-card px-6 py-3.5">
          {/* Progress Bar */}
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              0:{Math.floor(currentTime).toString().padStart(2, "0")}
            </span>
            <div
              className="relative flex-1 h-1.5 rounded-full bg-muted cursor-pointer overflow-hidden"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const newT = pos * duration;
                setCurrentTime(newT);
                if (videoRef.current && !videoError) videoRef.current.currentTime = newT;
              }}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet to-indigo-500"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              0:{Math.floor(duration).toString().padStart(2, "0")}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet text-white shadow-xs hover:bg-violet/90 transition"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={handleReplay}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition"
                title="Replay from start"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={toggleMute}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition"
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-500" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Sound: Instrumental Music</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono">
                1080p HD
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
