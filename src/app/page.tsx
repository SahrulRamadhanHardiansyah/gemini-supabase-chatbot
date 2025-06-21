// src/app/page.tsx
"use client";

import { useState, useEffect, useRef, FormEvent, FC } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

// --- Tipe Data ---
type Message = {
  id: number;
  text: string;
  from: "user" | "bot";
  type: InteractionMode;
};
type InteractionMode = "chat" | "summarize" | "vision";

// --- Ikon SVG sebagai Komponen ---
const SendIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ImageIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// --- Komponen-komponen Kecil untuk UI ---

// Komponen untuk Bubble Chat dengan kode yang lebih bersih
const ChatBubble: FC<{ message: Message }> = ({ message }) => {
  const isUser = message.from === "user";

  // --- Abstraksi Kelas-kelas Tailwind ---

  // 1. Definisikan semua kelas untuk tipografi Markdown dalam satu konstanta.
  //    Ini membuat JSX di bawah lebih bersih dan mudah dibaca.
  const proseClasses = [
    "prose",
    "prose-base",
    "dark:prose-invert",
    "max-w-none", // Menonaktifkan batas lebar default dari 'prose'
    "prose-p:leading-relaxed", // Jarak antar baris di paragraf
    "prose-headings:font-medium", // Style untuk judul
    "prose-a:text-blue-500", // Style untuk link
    "prose-a:font-medium",
    "hover:prose-a:underline",
    "prose-ul:my-4", // Jarak untuk list
    "prose-ol:my-4",
    "prose-li:my-2",
  ].join(" "); // Menggabungkan semua kelas menjadi satu string

  // 2. Definisikan kelas dasar dan kondisional untuk bubble
  const bubbleBaseClasses = "max-w-2xl rounded-2xl shadow";
  const userBubbleClasses = "bg-blue-600 text-white";
  const botBubbleClasses = "bg-white dark:bg-slate-700";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Terapkan kelas yang sudah kita siapkan */}
      <div className={`${bubbleBaseClasses} ${isUser ? userBubbleClasses : botBubbleClasses}`}>
        <div className="px-4 py-3">
          {/* JSX sekarang terlihat sangat bersih hanya dengan memanggil variabel */}
          <div className={proseClasses}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
          <span className="text-xs opacity-60 capitalize block mt-2 pt-2 border-t border-black/10 dark:border-white/10">{message.type}</span>
        </div>
      </div>
    </div>
  );
};

// Komponen untuk Indikator Loading
const LoadingBubble: FC = () => (
  <div className="flex justify-start">
    <div className="max-w-lg lg:max-w-2xl px-4 py-3 rounded-2xl shadow bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
      <div className="flex items-center space-x-2">
        <span className="text-sm">Thinking</span>
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  </div>
);

export default function Home() {
  // --- State dan Hooks ---
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mode, setMode] = useState<InteractionMode>("chat");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- useEffect Hooks ---
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
      }
    };
    checkUser();
  }, [router, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // --- Fungsi Handler ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (mode === "vision" && !imageFile) {
      alert("Please upload an image for vision mode.");
      return;
    }

    const userMessage: Message = { id: Date.now(), text: input, from: "user", type: mode };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setInput("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const formData = new FormData();
    formData.append("prompt", input);
    formData.append("mode", mode);
    if (imageFile && mode === "vision") {
      formData.append("image", imageFile);
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const botMessage: Message = { id: Date.now() + 1, text: data.text, from: "bot", type: mode };
      setMessages((prev) => [...prev, botMessage]);

      if (user) {
        await supabase.from("conversations").insert({
          user_id: user.id,
          prompt: input,
          response: data.text,
          type: mode,
        });
      }
    } catch (error) {
      console.error("Failed to get response:", error);
      const errorMessage: Message = { id: Date.now() + 1, text: "Maaf, terjadi kesalahan. Silakan coba lagi.", from: "bot", type: mode };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Placeholder Text Helper ---
  const placeholderText: Record<InteractionMode, string> = {
    chat: "Ketik pesan Anda...",
    summarize: "Tempel teks atau link untuk diringkas...",
    vision: "Jelaskan gambar atau ajukan pertanyaan...",
  };

  // --- Render Logic ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <h1 className="text-xl font-bold">Gemini Chatbot</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:inline">{user.email}</span>
          <button onClick={handleSignOut} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
            Sign Out
          </button>
        </div>
      </header>

      {/* Chat Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <LoadingBubble />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Footer / Input Area */}
      <footer className="bg-white dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto">
          {/* Mode Selector */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {(["chat", "summarize", "vision"] as InteractionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                  mode === m ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Vision Mode File Input */}
          {mode === "vision" && (
            <div className="mb-3">
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center gap-2 w-full cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
                <span>{imageFile ? imageFile.name : "Upload Image"}</span>
              </label>
              <input id="file-upload" type="file" accept="image/*" ref={fileInputRef} onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
            </div>
          )}

          {/* Main Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholderText[mode]}
              className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              aria-label="Send message"
            >
              <SendIcon className="w-6 h-6" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
