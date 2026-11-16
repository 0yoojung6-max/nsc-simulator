import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { stage, choice, history } = await req.json();

    const systemInstruction = `
      당신은 NSC(국가안전보장회의) 시뮬레이션의 엄격하고 날카로운 AI 조력자이자 심판관입니다.
      현재 시뮬레이션 단계: ${stage}
      현재 모둠의 정책/의견: ${choice}
      이전 대화 맥락: ${JSON.stringify(history || [])}
      
      단계별 지침:
      - S1_FOUNDING 또는 S1_REBUTTAL인 경우: 초기 외교/건국 정책에 대한 냉혹한 분석, 반론, 그리고 다음 위기 상황(S2)을 JSON으로 반환.
      - S2_CRISIS_ACTION인 경우: 경제·안보 위기 대책에 대한 심판, 그리고 최종 결말(S3 엔딩 및 생존 여부)을 JSON으로 반환.
      
      반드시 아래 JSON 형식으로만 순수하게 응답해주세요 (마크다운 코드블록 없이):
      {
        "phase": "${stage}",
        "analysis": "현실적이고 냉혹한 분석 내용",
        "feedback": "심판관의 날카로운 반론 및 평가",
        "next_situation": "다음 단계에 직면할 위기 상황 또는 최종 엔딩 리포트"
      }
    `;

    const primaryModel = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

    let responseText = '';

    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: systemInstruction,
      });
      responseText = response.text || '';
    } catch {
      const fallbackResponse = await ai.models.generateContent({
        model: fallbackModel,
        contents: systemInstruction,
      });
      responseText = fallbackResponse.text || '';
    }

    return NextResponse.json({ success: true, result: responseText });
  } catch (error: any) {
    console.error('Scenario API Error:', error);
    return NextResponse.json(
      { success: false, error: '시나리오 처리 중 오류가 발생했습니다: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}