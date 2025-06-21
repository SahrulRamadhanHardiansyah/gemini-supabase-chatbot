// src/app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

// Komponen Ikon sederhana untuk logo
const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8V4H8V8H4V12H8V16H4V20H8V16H12V20H16V16H20V12H16V8H12ZM16 12V8H12V12H16Z" fill="currentColor" />
  </svg>
);

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  // State untuk mengatur tema Supabase Auth UI (light/dark)
  const [authTheme, setAuthTheme] = useState("light");

  // Efek untuk mengecek sesi pengguna yang sudah ada
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/"); // Arahkan ke halaman utama setelah login berhasil
        router.refresh(); // Refresh untuk memastikan state server diperbarui
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Efek untuk mendeteksi tema sistem (light/dark)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setAuthTheme(e.matches ? "dark" : "light");
    };

    // Set tema awal saat komponen dimuat
    setAuthTheme(mediaQuery.matches ? "dark" : "light");

    // Dengarkan perubahan tema dari sistem operasi
    mediaQuery.addEventListener("change", handleThemeChange);

    // Cleanup listener saat komponen di-unmount
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center mb-8">
          <BotIcon className="w-12 h-12 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-4">Gemini Chatbot</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Masuk untuk mulai menggunakan chatbot</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} theme={authTheme} providers={["google", "github"]} socialLayout="horizontal" />
        </div>
      </div>
    </div>
  );
}
