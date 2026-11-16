import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { FALLBACK_REBUTTALS, FALLBACK_SIMULATIONS, isBlockedCountryName } from '@/app/lib/constants';
import { FieldValue } from 'firebase-admin/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function attachVideoUrls(policy: string, simData: any) {
  let allyVideo = '/videos/ally_sad.mp4';
  let tradeVideo = '/videos/gas_open.mp4';
  let cityVideo = '/videos/city_calm.mp4';

  if (policy.includes('전면 지원')) {
    allyVideo = '/videos/ally_happy.mp4';
    tradeVideo = '/videos/gas_closed.mp4';
    cityVideo = '/videos/city_crisis.mp4';
  } else if (policy.includes('비군사적')) {
    allyVideo = '/videos/aid_cargo.mp4';
    tradeVideo = '/videos/gas_closed.mp4';
    cityVideo = '/videos/city_crisis.mp4';
  }

  return {
    ...simData,
    ally_statement: {
      ...(simData.ally_statement || {}),
      videoUrl: allyVideo,
    },
    trade_response: {
      ...(simData.trade_response || {}),
      videoUrl: tradeVideo,
    },
    news_article: {
      ...(simData.news_article || {}),
      videoUrl: cityVideo,
    },
  };
}

export async function POST(req: Request) {
  try {
    const db = adminDb();
    const { action, code, groupId, payload } = await req.json();

    const sessionRef = db.collection('sessions').doc(code);
    const groupRef = sessionRef.collection('groups').doc(String(groupId));
    const [sessionSnap, groupSnap] = await Promise.all([sessionRef.get(), groupRef.get()]);

    if (!sessionSnap.exists || !groupSnap.exists) {
      return NextResponse.json({ error: '세션 또는 모둠 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const sessionData = sessionSnap.data()!;
    const groupData = groupSnap.data()!;
    
    // 🔥 모둠이 S1에서 설정한 가상 국가 이름을 정확히 가져오도록 수정
    const countryName = groupData.country?.name || groupData.draft?.countryName || '우리나라';
    
    const fallbackMode = sessionData.teacherSettings?.fallbackMode || false;
    const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

    // --- 1. S3.5: 1차 AI 개별 맞춤 반론 생성 ---
    if (action === 'GENERATE_REBUTTAL') {
      const { policy, reason, theory } = payload;

      if (isBlockedCountryName(reason)) {
        return NextResponse.json({
          error: '이유에 실제 국가명(한국, 미국, 중국, 러시아 등)이 포함되어 있습니다. 가상 이름(프렌디아, 그랜, 카스벨)만 사용해 주세요.'
        }, { status: 400 });
      }

      let rebuttalResult = FALLBACK_REBUTTALS[policy] || FALLBACK_REBUTTALS['중립과 평화 중재'];

      if (!fallbackMode && process.env.GEMINI_API_KEY) {
        try {
          const prompt = `
당신은 가상 국가 [${countryName}] 대통령을 보좌하는 수석 외교 자문위원입니다.
대통령(학생 모둠)이 선택한 정책은 "${policy}"이며, 직접 작성한 근거는 다음과 같습니다:
▶ 학생 작성 근거: "${reason}"
▶ 선택한 윤리 기준: ${theory}

[작성 규칙]
1. 교과서적 일반론이 아니라, 반드시 학생이 적은 근거("${reason}") 속 핵심 표현이나 논리를 직접 언급하며 현실적 부작용이나 논리적 허점을 찌르십시오.
2. 학생이 공리주의(실리·민생) 논리를 폈다면 의무론(동맹 신의·보편 원칙) 관점에서, 의무론(조약·의리) 논리를 폈다면 공리주의(국민 에너지·경제 피해) 관점에서 반론하십시오.
3. 정중한 표준 경어체("~하십시오", "~입니까?")를 사용하고, 반론은 2문장(95자 이내), 질문은 1문장(60자 이내)으로 작성하십시오.
4. JSON만 출력: {"rebuttal": "...", "question": "..."}
          `;
          const response = await ai.models.generateContent({ model: textModel, contents: prompt });
          const cleaned = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.rebuttal && parsed.question) rebuttalResult = parsed;
        } catch (err) {
          console.warn('1차 AI 반론 생성 실패, 대체본 전환:', err);
        }
      }

      await groupRef.update({
        draft: { policy, reason, theory },
        rebuttal: rebuttalResult,
        finalRebuttal: null,
        step: 'S3.5',
        logs: FieldValue.arrayUnion({
          type: 'REBUTTAL_1',
          at: new Date().toISOString(),
          countryName,
          input: { policy, reason, theory },
          output: rebuttalResult,
        }),
      });

      return NextResponse.json({ success: true, rebuttal: rebuttalResult });
    }

    // --- 2. S3.6: 대통령 재반박에 대한 2차 최종 반론 생성 ---
    if (action === 'GENERATE_FINAL_REBUTTAL') {
      const { rebuttalReply } = payload;

      if (isBlockedCountryName(rebuttalReply)) {
        return NextResponse.json({
          error: '재반박 내용에 실제 국가명이 포함되어 있습니다. 가상 이름(프렌디아, 그랜, 카스벨)만 사용해 주세요.'
        }, { status: 400 });
      }

      const policy = groupData.draft?.policy || '';
      const reason = groupData.draft?.reason || '';
      const firstQuestion = groupData.rebuttal?.question || '';

      let secondRebuttal = {
        rebuttal: `대통령님의 "${rebuttalReply}"라는 입장은 이해합니다만, 그 선택이 불러올 최악의 시나리오까지 감당할 수 있을지 마지막으로 점검해야 합니다.`,
        question: '국민과 국제사회 앞에서 이 결정의 모든 결과를 책임질 최종 준비가 되셨습니까?'
      };

      if (!fallbackMode && process.env.GEMINI_API_KEY) {
        try {
          const prompt = `
당신은 가상 국가 [${countryName}] 대통령을 보좌하는 수석 외교 자문위원입니다.
지금까지 대통령(학생 모둠)과 나눈 외교 검토 대화는 다음과 같습니다:
- 국가명: ${countryName}
- 선택한 정책: "${policy}"
- 초기 근거: "${reason}"
- 자문위원의 1차 질문: "${firstQuestion}"
- 대통령의 재반박: "${rebuttalReply}"

[작성 규칙 - 마지막 2차 반론]
1. 대통령의 재반박("${rebuttalReply}")을 먼저 한 줄로 정확히 짚어 인정한 뒤, 그 재반박마저 안고 있는 마지막 딜레마를 날카롭지만 정중하게 지적하십시오.
2. 학생이 모둠원들과 최종 결정을 내리기 직전 마지막으로 고민해 볼 핵심 질문을 1문장으로 던지십시오.
3. 정중한 표준 경어체("~하십시오", "~입니까?")를 사용하고, 반론은 2문장(100자 이내), 질문은 1문장(60자 이내)으로 작성하십시오.
4. JSON만 출력: {"rebuttal": "...", "question": "..."}
          `;
          const response = await ai.models.generateContent({ model: textModel, contents: prompt });
          const cleaned = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.rebuttal && parsed.question) secondRebuttal = parsed;
        } catch (err) {
          console.warn('2차 AI 반론 생성 실패, 대체본 전환:', err);
        }
      }

      await groupRef.update({
        rebuttalReply,
        finalRebuttal: secondRebuttal,
        logs: FieldValue.arrayUnion({
          type: 'REBUTTAL_2',
          at: new Date().toISOString(),
          countryName,
          input: { rebuttalReply },
          output: secondRebuttal,
        }),
      });

      return NextResponse.json({ success: true, finalRebuttal: secondRebuttal });
    }

    // --- 3. S3.6 최종 결정 -> S4 맞춤형 뉴스 시뮬레이션 ---
    if (action === 'RUN_SIMULATION') {
      const { keepOrRevise, finalPolicy, finalReason } = payload;
      const rebuttalReply = groupData.rebuttalReply || '';
      const secondQuestion = groupData.finalRebuttal?.question || '';

      let simResult = JSON.parse(
        JSON.stringify(FALLBACK_SIMULATIONS[finalPolicy] || FALLBACK_SIMULATIONS['중립과 평화 중재'])
      );

      if (!fallbackMode && process.env.GEMINI_API_KEY) {
        try {
          const prompt = `
당신은 공영방송 국제뉴스 보도국입니다.
가상 국가 [${countryName}]의 대통령이 두 차례의 자문 토론 끝에 최종적으로 "${finalPolicy}" 정책을 확정 발표했습니다.
- 국가명: ${countryName} (절대로 대한민국, 한국, 북한 등 실제 현실 국가명을 쓰지 말고 반드시 [${countryName}]으로만 지칭하십시오)
- 대통령의 최종 확정 근거: "${finalReason}"

위 내용을 반영해 직후 벌어지는 국제 반응과 국내 상황을 뉴스 속보 3장면으로 작성하십시오.

[규칙]
1. 뉴스 내용 전체에서 [${countryName}] 국가명을 정확히 사용하십시오.
2. 긍정적 성과(득)와 현실적 대가(실)의 균형을 맞추고, 각 항목의 text/body는 1~2문장(80자 이내)으로 명료하게 작성하십시오.
3. 정중한 보도 어조("~했습니다")를 사용하고 JSON만 출력하십시오:
{
  "ally_statement": {"speaker": "프렌디아 외무부 성명", "text": "80자 이내 핵심 반응"},
  "trade_response": {"speaker": "그랜 에너지부 발표", "text": "80자 이내 핵심 조치"},
  "news_article": {"headline": "38자 이내 뉴스 헤드라인", "body": "80자 이내 국내 여론", "source": "KBC 긴급특보"},
  "ticker": ["한 줄 속보 요약"]
}
          `;
          const response = await ai.models.generateContent({ model: textModel, contents: prompt });
          const cleaned = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.ally_statement && parsed.trade_response && parsed.news_article) {
            simResult = parsed;
          }
        } catch (err) {
          console.warn('AI 시뮬레이션 생성 실패, 대체본 전환:', err);
        }
      }

      simResult = attachVideoUrls(finalPolicy, simResult);

      await groupRef.update({
        final: { policy: finalPolicy, reason: finalReason, keepOrRevise },
        simulation: simResult,
        step: 'S4',
        logs: FieldValue.arrayUnion({
          type: 'SIMULATION',
          at: new Date().toISOString(),
          countryName,
          input: { finalPolicy, finalReason, rebuttalReply },
          output: { headline: simResult.news_article?.headline },
        }),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (err: any) {
    console.error('Simulate API Error:', err);
    return NextResponse.json({ error: err.message || '시뮬레이션 처리 오류' }, { status: 500 });
  }
}