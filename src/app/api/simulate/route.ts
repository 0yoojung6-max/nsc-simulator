import { NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const POLICIES = [
  "전면 지원",
  "비군사적 지원(인도적·경제)",
  "중립 선언과 중재 시도",
  "지원 거부와 교역 유지",
];

const SYSTEM = `너는 가상 국가들의 외교 상황 시뮬레이터이다. 학생 모둠의 국가 이름, 최종 정책, 이유를 읽고 그 정책이 가져올 수 있는 반응을 가상으로 만든다.
상황: 동맹국 벨라르가 분쟁국 카스벨과의 전쟁에 대한 지원을 요구하고, 교역국 노바리아는 지원하면 보복하겠다고 경고했다.
규칙:
- 지정된 JSON만 출력한다. 설명, 마크다운, 코드블록은 쓰지 않는다.
- 동맹국 성명, 교역국 대응, 국민 여론 기사는 각각 3~5문장으로 쓴다.
- 결과의 옳고 그름을 평가하거나 정답처럼 단정하지 않는다. 시뮬레이션 상의 가능한 반응으로 쓴다.
- 실제 국가, 실존 인물, 실제 방송사는 언급하지 않는다. 벨라르, 노바리아, 카스벨, 아르크24와 학생이 정한 국가 이름만 쓴다.
- 폭력과 잔혹한 묘사는 쓰지 않는다.
- 모든 정책에는 얻는 것과 잃는 것이 함께 있다. indicator_deltas 4개 중 최소 하나는 음수, 최소 하나는 양수로 하고, 전체 변화가 한쪽으로 크게 쏠리지 않게 한다.
- 동맹국과 교역국은 각자 자국 이익의 관점에서 말하고, 어느 쪽이 옳은지에 대한 판단은 덧붙이지 않는다.
- image_briefs는 사진으로 찍을 수 있는 장면을 한 문장으로 쓰되 사람 얼굴이 뚜렷하게 보이지 않는 구도로 쓴다.
JSON 형식:
{"ally_statement":{"speaker":"벨라르 정부 대변인","text":""},"trade_response":{"speaker":"노바리아 통상부","text":""},"news_article":{"headline":"","body":"","source":"아르크24"},"ticker":["",""],"indicator_deltas":{"security":0,"economy":0,"reputation":0,"public_support":0},"relations":{"ally":0,"trade":0,"conflict_tension":0},"image_briefs":{"ally":"","trade":"","news":""}}
indicator_deltas는 -30~30의 정수, relations.ally와 relations.trade는 -2~2, conflict_tension은 0~3의 정수.`;

type Sim = {
  ally_statement: { speaker: string; text: string };
  trade_response: { speaker: string; text: string };
  news_article: { headline: string; body: string; source: string };
  ticker: string[];
  indicator_deltas: { security: number; economy: number; reputation: number; public_support: number };
  relations: { ally: number; trade: number; conflict_tension: number };
  image_briefs: { ally: string; trade: string; news: string };
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clamp = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
};

function validate(raw: any): Sim | null {
  const a = str(raw?.ally_statement?.text, 500);
  const t = str(raw?.trade_response?.text, 500);
  const nb = str(raw?.news_article?.body, 600);
  const nh = str(raw?.news_article?.headline, 120);
  if (!a || !t || !nb || !nh) return null;
  const d = raw?.indicator_deltas ?? {};
  const r = raw?.relations ?? {};
  const ib = raw?.image_briefs ?? {};
  return {
    ally_statement: { speaker: str(raw.ally_statement.speaker, 40) || "벨라르 정부 대변인", text: a },
    trade_response: { speaker: str(raw.trade_response.speaker, 40) || "노바리아 통상부", text: t },
    news_article: { headline: nh, body: nb, source: "아르크24" },
    ticker: (Array.isArray(raw.ticker) ? raw.ticker : []).map((x: unknown) => str(x, 100)).filter(Boolean).slice(0, 3),
    indicator_deltas: {
      security: clamp(d.security, -30, 30),
      economy: clamp(d.economy, -30, 30),
      reputation: clamp(d.reputation, -30, 30),
      public_support: clamp(d.public_support, -30, 30),
    },
    relations: { ally: clamp(r.ally, -2, 2), trade: clamp(r.trade, -2, 2), conflict_tension: clamp(r.conflict_tension, 0, 3) },
    image_briefs: {
      ally: str(ib.ally, 200) || "정부 브리핑룸의 연단과 마이크",
      trade: str(ib.trade, 200) || "항구에 쌓인 컨테이너",
      news: str(ib.news, 200) || "거리를 걷는 시민들의 뒷모습",
    },
  };
}

// AI가 실패했을 때 쓰는 대체 결과 (정책별)
const FB = [
  { a: "“{n}의 결단에 감사합니다. 우리는 함께 대응할 것입니다.”", t: "노바리아 통상부는 {n}산 수입품에 보복 관세를 즉시 발효한다고 발표했습니다.", h: "지원 결정에 시민 의견 갈려… 물가 우려 커져", b: "{n}의 지원 결정 이후 시민들의 의견이 엇갈리고 있습니다. 교역 차질로 물가가 오를 것이라는 우려가 커지고 있습니다.", k: "노바리아, {n}에 보복 관세 발효", d: [10, -25, 5, -10], r: [2, -2, 3] },
  { a: "“인도적 지원에 감사합니다. 더 많은 참여를 기대합니다.”", t: "노바리아는 {n}과의 교역 재검토를 예고하며 추가 조치를 경고했습니다.", h: "“전쟁은 반대, 사람은 돕자”… 시민단체 환영", b: "{n}의 인도적 지원 결정을 시민단체가 환영했습니다. 다만 교역 재검토 경고로 경제계의 불안은 남아 있습니다.", k: "{n}, 인도적·경제 지원 발표", d: [3, -10, 8, 5], r: [1, -1, 2] },
  { a: "“중립 선언은 아쉽지만 중재 노력은 지켜보겠습니다.”", t: "노바리아는 {n}의 중재 제안을 환영하며 대화 의사를 밝혔습니다.", h: "중재국 자임한 {n}… “이득인가 고립인가” 논쟁", b: "{n}이 중립을 선언하고 중재를 제안했습니다. 평판이 오를 것이라는 기대와 동맹에서 고립될 수 있다는 우려가 함께 나옵니다.", k: "{n} 중립 선언·중재 제안", d: [-5, -3, 12, 2], r: [-1, 1, 2] },
  { a: "“{n}의 거부에 깊은 유감입니다. 동맹의 의미를 다시 묻게 됩니다.”", t: "노바리아는 {n}과의 교역 확대를 약속하며 환영 입장을 밝혔습니다.", h: "“우리 경제부터” vs “동맹을 저버렸다”… 여론 팽팽", b: "{n}이 지원 요청을 거부했습니다. 경제를 지켰다는 평가와 동맹을 저버렸다는 비판이 맞서고 있습니다.", k: "{n}, 지원 요청 거부 · 벨라르 유감 표명", d: [-12, 10, -15, 8], r: [-2, 2, 2] },
];

function fallbackSim(n: string, p: number): Sim {
  const f = FB[p];
  const sub = (s: string) => s.replace(/\{n\}/g, n);
  return {
    ally_statement: { speaker: "벨라르 정부 대변인", text: sub(f.a) },
    trade_response: { speaker: "노바리아 통상부", text: sub(f.t) },
    news_article: { headline: sub(f.h), body: sub(f.b), source: "아르크24" },
    ticker: [sub(f.k)],
    indicator_deltas: { security: f.d[0], economy: f.d[1], reputation: f.d[2], public_support: f.d[3] },
    relations: { ally: f.r[0], trade: f.r[1], conflict_tension: f.r[2] },
    image_briefs: {
      ally: "정부 브리핑룸의 연단과 마이크, 뒤쪽에 놓인 깃발들",
      trade: "항구에 쌓인 컨테이너와 크레인",
      news: "광장을 지나가는 시민들의 뒷모습",
    },
  };
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("timeout"), { status: 504 })), ms)
    ),
  ]);

async function callWithRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try {
      return await withTimeout(fn(), 15000);
    } catch (e: any) {
      const status = e?.status ?? e?.code;
      console.error("attempt", i + 1, "failed:", status, e?.message ?? e);
      if (![429, 500, 503, 504].includes(status) || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i + Math.random() * 300));
    }
  }
  throw new Error("unreachable");
}
function extractJson(text: string): any {
  const s = text.replace(/```json|```/g, "").trim();
  const start = s.indexOf("{");
  if (start < 0) throw new Error("no json");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1));
    }
  }
  throw new Error("unterminated json");
}
async function generate(ai: GoogleGenAI, model: string, prompt: string): Promise<Sim | null> {
  const res = await callWithRetry(() =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );
  const raw = res.text ?? "";
  try {
    return validate(extractJson(raw));
  } catch (e) {
    console.error("JSON parse failed. start:", raw.slice(0, 200), "| end:", raw.slice(-200));
    throw e;
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const country = str(body?.country, 8) || "하란국";
  const policy = Number(body?.policy);
  const reason = str(body?.reason, 300);
  if (!Number.isInteger(policy) || policy < 0 || policy > 3 || !reason) {
    return NextResponse.json({ error: "policy(0~3)와 reason이 필요합니다." }, { status: 400 });
  }

  // 대체본 전용 모드: .env.local에 USE_FALLBACK_ONLY=true
  if (process.env.USE_FALLBACK_ONLY === "true" || !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ simulation: fallbackSim(country, policy), source: "fallback" });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `국가 이름: ${country}\n최종 정책: ${POLICIES[policy]}\n이유: ${reason}`;
  const models = [process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash", process.env.GEMINI_FALLBACK_MODEL].filter(Boolean) as string[];

  for (const model of models) {
    try {
      const sim = await generate(ai, model, prompt);
      if (sim) return NextResponse.json({ simulation: sim, source: "ai", model });
    } catch (e: any) {
      console.error("simulate error:", model, e?.status, e?.message ?? e);
    }
  }
  return NextResponse.json({ simulation: fallbackSim(country, policy), source: "fallback" });
}
