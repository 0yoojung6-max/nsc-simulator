import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/app/lib/firebaseAdmin';
import {
  DEFAULT_SESSION_ID,
  FALLBACK_REBUTTALS,
  FALLBACK_SIMULATIONS,
  WORLD_ACTORS,
  isBlockedCountryName,
} from '@/app/lib/constants';
import { FieldValue } from 'firebase-admin/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const ALLY_NAME = WORLD_ACTORS.ally.name; // 떡국
const TRADE_NAME = WORLD_ACTORS.trade.name; // 미역국
const CONFLICT_NAME = WORLD_ACTORS.conflict.name; // 불닭국

function checkInvalidText(text: string): string | null {
  const trimmed = (text || '').trim();
  if (/^[ㄱ-ㅎㅏ-ㅣ\s!?.,~]+$/.test(trimmed)) {
    return '초성이나 기호만으로는 제출할 수 없습니다. 문장으로 다시 작성해 주세요.';
  }
  if (/(.)\1{3,}/.test(trimmed.replace(/\s/g, ''))) {
    return '같은 글자를 반복하지 말고 내용을 구체적으로 다시 적어 주세요.';
  }
  const badWords = ['시발', '씨발', '병신', '개새끼', '존나', '미친놈', '꺼져', '닥쳐', '좆'];
  if (badWords.some((w) => trimmed.includes(w))) {
    return '부적절한 표현이 포함되어 있습니다. 바른 표현으로 다시 작성해 주세요.';
  }
  return null;
}

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

    const sessionId = code || DEFAULT_SESSION_ID;
    const sessionRef = db.collection('sessions').doc(sessionId);
    const groupRef = sessionRef.collection('groups').doc(String(groupId));
    const [sessionSnap, groupSnap] = await Promise.all([sessionRef.get(), groupRef.get()]);

    if (!sessionSnap.exists || !groupSnap.exists) {
      return NextResponse.json({ error: '세션 또는 모둠 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const sessionData = sessionSnap.data()!;
    const groupData = groupSnap.data()!;

    const countryName = groupData.country?.name || groupData.draft?.countryName || '우리 나라';
    const fallbackMode = sessionData.teacherSettings?.fallbackMode || false;
    const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

    // --- 1. 첫 번째 AI 외교 자문위원 반론 ---
    if (action === 'GENERATE_REBUTTAL') {
      const { policy, reason, theory, preTest } = payload;

      const invalidMsg = checkInvalidText(reason);
      if (invalidMsg) {
        return NextResponse.json({ error: invalidMsg }, { status: 400 });
      }

      if (isBlockedCountryName(reason)) {
        return NextResponse.json(
          {
            error: `이유에 실제 나라 이름(한국, 미국, 중국, 러시아 등)이 들어 있습니다. 가상 이름(${ALLY_NAME}, ${TRADE_NAME}, ${CONFLICT_NAME})만 사용해 주세요.`,
          },
          { status: 400 }
        );
      }

      let rebuttalResult = FALLBACK_REBUTTALS[policy] || FALLBACK_REBUTTALS['중립과 평화 중재'];

      if (!fallbackMode && process.env.GEMINI_API_KEY) {
        try {
          const prompt = `
당신은 가상 나라 [${countryName}]의 외교 결정을 돕는 AI 외교 자문위원입니다.
현재 상황:
- [${countryName}]과 [${ALLY_NAME}]은 서로 공격을 받으면 돕기로 약속한 오랜 동맹국입니다.
- 군사력이 강한 [${CONFLICT_NAME}]이 [${ALLY_NAME}]을 공격했습니다.
- [${CONFLICT_NAME}]과 가까운 자원 나라 [${TRADE_NAME}]은 "[${ALLY_NAME}]을 도우면 [${countryName}]에 보내는 천연가스와 핵심 광물(65%)을 끊겠다"고 압박하고 있습니다.
- 모둠(대통령·기업가·소상공인·구호단체 역할)이 고른 방법: "${policy}"
- 모둠이 적은 이유: "${reason}"
- 선택의 성격: ${theory}

[작성 규칙]
1. 문체는 반말이나 가벼운 말투가 아니라, 중학교 사회·도덕 교과서처럼 단정하고 이해하기 쉬운 표준 존댓말("~합니다", "~입니까?")을 사용하십시오. 어려운 한자어나 과장된 표현은 쓰지 마십시오.
2. 만약 학생의 이유("${reason}")가 위 상황(${ALLY_NAME}, ${TRADE_NAME}, ${CONFLICT_NAME})과 전혀 상관없는 딴소리이거나 성의 없는 장난이라면, 반론에 "현재 상황과 맞지 않거나 내용이 부족합니다. 이전 단계로 돌아가 구체적인 이유를 다시 적어 주십시오."라고 안내하십시오.
3. 정상적인 이유라면 학생이 적은 말("${reason}") 속 핵심 내용을 직접 언급하면서, 그 선택으로 생길 현실적인 문제나 놓친 점을 짚어 주십시오.
4. 학생이 생활과 이익(공리주의)을 앞세웠다면 동맹 약속과 사람 목숨(의무론) 쪽에서 반론하고, 약속과 생명을 앞세웠다면 가스 차단과 가게·공장 피해(공리주의) 쪽에서 반론하십시오.
5. 반론은 2문장(95자 이내), 질문은 1문장(60자 이내)으로 짧고 분명하게 작성하십시오.
6. JSON만 출력: {"rebuttal": "...", "question": "..."}
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
        draft: { policy, reason, theory, preTest: preTest || null },
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

    // --- 2. 두 번째 AI 외교 자문위원 반론 ---
    if (action === 'GENERATE_FINAL_REBUTTAL') {
      const { rebuttalReply } = payload;

      const invalidMsg = checkInvalidText(rebuttalReply);
      if (invalidMsg) {
        return NextResponse.json({ error: invalidMsg }, { status: 400 });
      }

      if (isBlockedCountryName(rebuttalReply)) {
        return NextResponse.json(
          {
            error: `답변에 실제 나라 이름이 들어 있습니다. 가상 이름(${ALLY_NAME}, ${TRADE_NAME}, ${CONFLICT_NAME})만 사용해 주세요.`,
          },
          { status: 400 }
        );
      }

      const policy = groupData.draft?.policy || '';
      const reason = groupData.draft?.reason || '';
      const firstQuestion = groupData.rebuttal?.question || '';

      let secondRebuttal = {
        rebuttal: `모둠에서 "${rebuttalReply}"라고 답한 뜻은 알겠지만, 그 선택 때문에 생길 가장 큰 어려움도 끝까지 감당할 수 있어야 합니다.`,
        question: '국민과 다른 나라들 앞에서 이 결정의 결과를 책임질 준비가 되어 있습니까?',
      };

      if (!fallbackMode && process.env.GEMINI_API_KEY) {
        try {
          const prompt = `
당신은 가상 나라 [${countryName}]의 외교 결정을 돕는 AI 외교 자문위원입니다.
현재 상황:
- 공격한 나라 [${CONFLICT_NAME}]과 가까운 자원 나라 [${TRADE_NAME}]이 동맹국 [${ALLY_NAME}] 지원 시 천연가스와 광물(65%) 공급을 끊겠다고 경고한 상황입니다.
- 나라 이름: ${countryName}
- 고른 방법: "${policy}"
- 처음 이유: "${reason}"
- AI 자문위원의 첫 번째 질문: "${firstQuestion}"
- 모둠의 답변: "${rebuttalReply}"

[작성 규칙 - 마지막 두 번째 반론]
1. 중학교 사회·도덕 교과서처럼 쉽고 분명한 표준 존댓말("~합니다", "~입니까?")을 사용하십시오. 어려운 한자어나 추상적인 표현은 쓰지 마십시오.
2. 만약 모둠의 답변("${rebuttalReply}")이 상황과 전혀 무관한 딴소리이거나 장난이라면, "상황과 맞지 않는 답변입니다. 외교 선택에 대한 이유를 다시 분명하게 적어 주십시오."라고 지적하십시오.
3. 정상적인 답변이라면 모둠의 답변("${rebuttalReply}")을 먼저 한 문장으로 받아 준 뒤, 그 답변에도 여전히 남아 있는 현실적 어려움을 한 가지 더 짚어 주십시오.
4. 모둠원(대통령·기업가·소상공인·구호단체 역할)이 최종 결정을 내리기 전에 마지막으로 생각해 볼 질문을 1문장으로 던지십시오.
5. 반론은 2문장(100자 이내), 질문은 1문장(60자 이내)으로 작성하십시오.
6. JSON만 출력: {"rebuttal": "...", "question": "..."}
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

    // --- 3. 최종 결정 -> 맞춤형 뉴스 특보 ---
    if (action === 'RUN_SIMULATION') {
      const { keepOrRevise, finalPolicy, finalReason } = payload;

      const invalidMsg = checkInvalidText(finalReason);
      if (invalidMsg) {
        return NextResponse.json({ error: invalidMsg }, { status: 400 });
      }

      const rebuttalReply = groupData.rebuttalReply || '';

      let simResult = JSON.parse(
        JSON.stringify(FALLBACK_SIMULATIONS[finalPolicy] || FALLBACK_SIMULATIONS['중립과 평화 중재'])
      );

      if (!fallbackMode && process.env.GEMINI_API_KEY) {
        try {
          const prompt = `
당신은 공영방송 국제뉴스 보도국입니다.
가상 나라 [${countryName}]이 두 차례의 검토 끝에 최종적으로 "${finalPolicy}" 방법을 선택해 발표했습니다.
- 상황: 공격한 나라 [${CONFLICT_NAME}]과 가까운 자원 나라 [${TRADE_NAME}]이 동맹국 [${ALLY_NAME}] 지원 시 천연가스와 광물 차단을 경고한 위기입니다.
- 나라 이름: ${countryName} (절대로 한국, 대한민국, 북한 등 실제 나라 이름을 쓰지 말고 반드시 [${countryName}]으로만 쓰십시오)
- 관련 나라: 동맹국 [${ALLY_NAME}], 자원 나라 [${TRADE_NAME}], 공격한 나라 [${CONFLICT_NAME}]
- 최종 선택 이유: "${finalReason}"

위 내용을 바탕으로 발표 직후의 국제 반응과 국내 상황을 뉴스 속보 3장면으로 작성하십시오.

[규칙]
1. 중학교 교과서나 학생 뉴스처럼 이해하기 쉬운 표준 보도 문장("~했습니다")을 사용하고 어려운 한자어는 피하십시오.
2. 긍정적인 결과(얻은 점)와 부정적인 결과(잃은 점)가 모두 드러나게 쓰고, 각 항목의 text/body는 1~2문장(80자 이내)으로 짧게 작성하십시오.
3. JSON만 출력하십시오:
{
  "ally_statement": {"speaker": "${ALLY_NAME} 외무부 발표", "text": "80자 이내 핵심 반응"},
  "trade_response": {"speaker": "${TRADE_NAME} 에너지부 발표", "text": "80자 이내 핵심 조치"},
  "news_article": {"headline": "38자 이내 뉴스 제목", "body": "80자 이내 국내 상황", "source": "KBC 긴급특보"},
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