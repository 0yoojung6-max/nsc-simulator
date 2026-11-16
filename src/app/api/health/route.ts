import { NextResponse } from "next/server";
import { adminDb } from "../../lib/firebaseAdmin";

export async function GET() {
  try {
    const ref = adminDb().collection("_health").doc("ping");
    await ref.set({ at: new Date().toISOString() });
    const snap = await ref.get();
    return NextResponse.json({ ok: true, data: snap.data() });
  } catch (e: any) {
    console.error("health error:", e?.message ?? e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}