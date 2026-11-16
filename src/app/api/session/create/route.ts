import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!process.env.TEACHER_PASSCODE || body?.passcode !== process.env.TEACHER_PASSCODE) {
    return NextResponse.json({ error: "교사 코드가 올바르지 않습니다." }, { status: 401 });
  }

  try {
    const db = adminDb();
    for (let i = 0; i < 10; i++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const ref = db.collection("sessions").doc(code);
      if ((await ref.get()).exists) continue;

      const now = new Date().toISOString();
      const batch = db.batch();
      batch.set(ref, {
        createdAt: now,
        status: "open",
        settings: { minReasonChars: 30, allowRegenerate: false, fallbackOnly: false },
        timer: { running: false, endsAt: null, presetKey: null },
        presenterGroup: null,
      });
      for (let g = 1; g <= 4; g++) {
        batch.set(ref.collection("groups").doc(String(g)), {
          occupied: false,
          step: "S0",
          country: null,
          updatedAt: now,
        });
      }
      await batch.commit();
      return NextResponse.json({ code });
    }
    return NextResponse.json({ error: "세션 코드를 만들지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
  } catch (e: any) {
    console.error("session create error:", e?.message ?? e);
    return NextResponse.json({ error: "세션을 만드는 중 오류가 발생했습니다." }, { status: 500 });
  }
}