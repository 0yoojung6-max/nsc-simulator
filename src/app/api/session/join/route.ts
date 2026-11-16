import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const code = String(body?.code ?? "");
  const group = Number(body?.group);
  const clientId = String(body?.clientId ?? "");
  if (!/^\d{6}$/.test(code) || ![1, 2, 3, 4].includes(group) || clientId.length < 8) {
    return NextResponse.json({ error: "입장 정보가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const db = adminDb();
    const sref = db.collection("sessions").doc(code);
    const gref = sref.collection("groups").doc(String(group));
    const result = await db.runTransaction(async (tx) => {
      const [s, g] = await Promise.all([tx.get(sref), tx.get(gref)]);
      if (!s.exists || !g.exists) return "nosession";
      const d = g.data() as any;
      if (d.occupied && d.occupiedBy !== clientId) return "taken";
      tx.update(gref, { occupied: true, occupiedBy: clientId, updatedAt: new Date().toISOString() });
      return "ok";
    });
    if (result === "nosession") return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    if (result === "taken") return NextResponse.json({ error: "이미 다른 기기가 선택한 모둠입니다." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("join error:", e?.message ?? e);
    return NextResponse.json({ error: "입장 중 오류가 발생했습니다." }, { status: 500 });
  }
}