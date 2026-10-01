"use client";

import { useState, useEffect, useRef } from "react";
import { useAppLanguage } from "@/lib/app-language";
import { listen, speak, stopSpeaking, isSTTAvailable, isSpeaking, type ListenHandle } from "@/lib/speech-engine";
import { usePathname } from "next/navigation";

export function GlobalVoiceNavigator() {
  const [isMounted, setIsMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("");
  const { language } = useAppLanguage();
  const pathname = usePathname();
  const listenRef = useRef<ListenHandle | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Stop everything on route change
  useEffect(() => {
    if (isActive) {
      stopSpeaking();
      listenRef.current?.stop();
      setIsListening(false);
      readScreenContext();
    }
  }, [pathname, isActive]);

  const readScreenContext = () => {
    let textToSpeak = "You are currently on a page in BharatLink.";
    if (pathname.includes("/dashboard")) {
      textToSpeak = "You are on the dashboard. You can say 'Open Assistant', 'View Documents', or 'Scan Form'.";
    } else if (pathname.includes("/assistant")) {
      textToSpeak = "You are in the voice assistant. You can ask me anything or upload a document.";
    } else if (pathname.includes("/documents")) {
      textToSpeak = "You are in your DigiLocker. Here you can see your saved Aadhaar and forms. What would you like to open?";
    } else if (pathname.includes("/onboarding")) {
      textToSpeak = "You are in the setup process. Please follow the instructions on the screen.";
    }

    setStatusText("Speaking...");
    speak(textToSpeak, language, {
      onEnd: () => {
        setStatusText("Listening...");
        startListening();
      }
    });
  };

  const startListening = () => {
    setIsListening(true);
    listenRef.current = listen({
      lang: language,
      onInterim: (text) => setStatusText(`Hearing: ${text}`),
      onResult: (result) => {
        setIsListening(false);
        setStatusText("Thinking...");
        handleVoiceCommand(result.transcript);
      },
      onError: () => {
        setIsListening(false);
        setStatusText("Didn't catch that. Tap to retry.");
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  };

  const handleVoiceCommand = (transcript: string) => {
    const cmd = transcript.toLowerCase();
    let response = "I heard you say: " + transcript + ". This feature will route you to the correct page soon.";
    
    if (cmd.includes("dashboard") || cmd.includes("home")) {
      response = "Going to dashboard.";
      window.location.href = "/dashboard";
    } else if (cmd.includes("document") || cmd.includes("locker")) {
      response = "Opening your documents.";
      window.location.href = "/documents";
    } else if (cmd.includes("assistant") || cmd.includes("help") || cmd.includes("chat")) {
      response = "Opening assistant.";
      window.location.href = "/assistant";
    }

    setStatusText("Speaking...");
    speak(response, language, {
      onEnd: () => {
        setStatusText("Listening...");
        startListening();
      }
    });
  };

  const toggleNavigator = () => {
    if (isActive) {
      stopSpeaking();
      listenRef.current?.stop();
      setIsActive(false);
      setIsListening(false);
      setStatusText("");
    } else {
      setIsActive(true);
      readScreenContext();
    }
  };

  if (!isMounted || !isSTTAvailable()) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {isActive && statusText && (
        <div className="rounded-2xl bg-white/90 backdrop-blur-md shadow-lg px-4 py-2 border border-orange-200 text-sm font-medium text-slate-800 animate-fade-in-up max-w-[200px]">
          {statusText}
        </div>
      )}
      <button
        data-testid="global-voice-navigator-toggle"
        onClick={toggleNavigator}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          isActive
            ? "bg-gradient-to-br from-red-500 to-red-600 animate-pulse ring-4 ring-red-500/30"
            : "bg-gradient-to-br from-orange-500 to-orange-600 hover:ring-4 hover:ring-orange-500/30"
        }`}
      >
        {isActive ? (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        )}
      </button>
    </div>
  );
}
