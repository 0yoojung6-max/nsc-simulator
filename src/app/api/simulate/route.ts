import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("key loaded:", !!apiKey);
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY를 읽지 못했습니다." },
      { status: 500 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash",
      contents: "외교 위기 상황 시뮬레이터 연동 테스트입니다. 한 문장으로 인사해 주세요.",
    });
    const text = response.text ?? "";
    return NextResponse.json({ text, result: text });
  } catch (e: any) {
    console.error("simulate error:", e?.status, e?.message ?? e);
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
