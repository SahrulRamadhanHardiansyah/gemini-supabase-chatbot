import { NextResponse } from "next/server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", safetySettings });

// --- Helper Function ---
async function fileToGenerativePart(file: File) {
  const base64EncodedData = await file.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer).toString("base64"));
  return {
    inlineData: { data: base64EncodedData, mimeType: file.type },
  };
}

// --- API Route Handler ---
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt") as string;
    const mode = formData.get("mode") as "chat" | "summarize" | "vision";

    if (!prompt || !mode) {
      return NextResponse.json({ error: "Prompt and mode are required" }, { status: 400 });
    }

    // Untuk mode VISION, kita perlu menyertakan gambar
    if (mode === "vision") {
      const imageFile = formData.get("image") as File | null;
      if (!imageFile) {
        return NextResponse.json({ error: "Image file is required for vision mode" }, { status: 400 });
      }
      const imagePart = await fileToGenerativePart(imageFile);
      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      return NextResponse.json({ text });
    }

    // --- Perbaikan: Logika penolakan link untuk mode summarize ---
    if (mode === "summarize") {
      // Regex sederhana untuk mendeteksi keberadaan link
      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

      if (urlRegex.test(prompt)) {
        // Jika input adalah link, kembalikan pesan error yang ramah sebagai respons bot
        console.log("Link detected in summarize mode, returning user-friendly error.");
        const friendlyErrorText = "Maaf, untuk saat ini fitur summarize hanya dapat meringkas teks. Mohon jangan masukkan link, tetapi salin dan tempel teks lengkap dari artikel yang ingin diringkas.";
        return NextResponse.json({ text: friendlyErrorText });
      }
    }

    // Untuk mode CHAT dan SUMMARIZE (yang sudah dipastikan berupa teks)
    let fullPrompt = prompt;

    if (mode === "summarize") {
      fullPrompt = `Ringkas konten berikut secara padat dalam bahasa Indonesia:\n\n${prompt}`;
    }

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Error in generate API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate response";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
