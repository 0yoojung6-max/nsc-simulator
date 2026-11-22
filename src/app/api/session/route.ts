import { NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { DEFAULT_SESSION_ID, isBlockedCountryName } from '@/app/lib/constants';
import { FieldValue } from 'firebase-admin/firestore';

const TEACHER_PASSCODE = process.env.TEACHER_PASSCODE || 'ybhp';

export async function POST(req: Request) {
  try {
    const db = adminDb();
    const body = await req.json();
    const { action, groupId, payload } = body;
    const sessionCode = DEFAULT_SESSION_ID;
    const sessionRef = db.collection('sessions').doc(sessionCode);

    // 1. 교사: 세션 시작 (고정 단일 세션 생성 또는 기존 세션 이어받기)
    if (action === 'CREATE_SESSION') {
      if (payload?.passcode !== TEACHER_PASSCODE) {
        return NextResponse.json({ error: '교사 비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }

      const existing = await sessionRef.get();
      if (!existing.exists) {
        await sessionRef.set({
          createdAt: FieldValue.serverTimestamp(),
          status: 'ACTIVE',
          presenterGroup: null,
          s4Control: { command: 'PLAY', speed: 1, timestamp: Date.now() },
          timer: { endsAt: null, running: false, durationSec: 300, showToStudents: true },
          teacherSettings: {
            minReasonLength: 30,
            allowRegenerate: false,
            fallbackMode: false,
            theoryMap: { '1': '공리주의', '2': '의무론', '3': '공리주의', '4': '의무론' },
            gwanghaeSamePoints: [
              '강대국(명과 후금 / 떡국과 미역국) 사이에서 국가의 생존을 선택해야 했다.',
              '신료와 여론의 거센 반대 및 압박 속에서 외교적 결단을 내렸다.',
            ],
          },
        });

        for (let g = 1; g <= 4; g++) {
          await sessionRef.collection('groups').doc(String(g)).set({
            groupId: g,
            occupied: false,
            step: 'S0',
            indicators: { security: 50, economy: 50, reputation: 50, public_support: 50 },
            country: null,
            draft: null,
            rebuttal: null,
            rebuttalReply: null,
            final: null,
            simulation: null,
            check: null,
            compare: null,
            logs: [],
          });
        }
      }

      return NextResponse.json({ success: true, code: sessionCode });
    }

    const groupRef = groupId ? sessionRef.collection('groups').doc(String(groupId)) : null;

    // 2. 학생: 모둠 입장 (S0 -> S1)
    if (action === 'JOIN_GROUP' && groupRef) {
      const snap = await groupRef.get();
      if (!snap.exists) {
        return NextResponse.json({ error: '수업 세션이 아직 열리지 않았습니다. 교사에게 문의하세요.' }, { status: 404 });
      }
      const data = snap.data();
      if (data?.occupied && !payload?.force) {
        return NextResponse.json({ error: '이미 다른 기기가 입장 중인 모둠입니다.' }, { status: 409 });
      }
      await groupRef.update({ occupied: true, step: data?.step === 'S0' ? 'S1' : data?.step });
      return NextResponse.json({ success: true });
    }

    // 3. 학생: 건국 선포 (S1 -> S2)
    if (action === 'FOUND_COUNTRY' && groupRef) {
      const { name, intro, emblem } = payload;
      if (!name || name.trim().length === 0 || name.trim().length > 8) {
        return NextResponse.json({ error: '국가 이름은 1~8자로 입력해야 합니다.' }, { status: 400 });
      }
      if (isBlockedCountryName(name)) {
        return NextResponse.json({ error: '실제 국가명은 사용할 수 없습니다. 가상의 나라 이름을 지어 주세요.' }, { status: 400 });
      }
      await groupRef.update({
        country: { name: name.trim(), intro: (intro || '').trim().slice(0, 40), emblem },
        step: 'S2',
      });
      return NextResponse.json({ success: true });
    }

    // 4. 학생: 단계 이동
    if (action === 'SET_STEP' && groupRef) {
      await groupRef.update({ step: payload.step });
      return NextResponse.json({ success: true });
    }

    // 5. 학생: S5 검사표 제출
    if (action === 'SUBMIT_CHECK' && groupRef) {
      await groupRef.update({ check: payload.check, step: 'S5_WAIT' });
      return NextResponse.json({ success: true });
    }

    // 6. 학생: S6 광해군 비교 제출
    if (action === 'SUBMIT_COMPARE' && groupRef) {
      await groupRef.update({ compare: payload.compare, step: 'DONE' });
      return NextResponse.json({ success: true });
    }

    // 7. 교사 제어
    if (action === 'TEACHER_UPDATE') {
      if (payload?.passcode !== TEACHER_PASSCODE) {
        return NextResponse.json({ error: '교사 권한이 없습니다.' }, { status: 401 });
      }
      if (payload.sessionUpdates) {
        await sessionRef.update(payload.sessionUpdates);
      }
      if (payload.targetGroupId && payload.groupUpdates) {
        await sessionRef.collection('groups').doc(String(payload.targetGroupId)).update(payload.groupUpdates);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (err: any) {
    console.error('Session API Error:', err);
    return NextResponse.json({ error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}