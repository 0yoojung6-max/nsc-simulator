export const DEFAULT_SESSION_ID = 'active-session';

export const BLOCKED_COUNTRIES = [
  '한국', '대한민국', '남한', '북한', '조선', 'KOREA', 'ROK', 'DPRK',
  '미국', 'USA', 'US', 'AMERICA', '중국', '중화', 'CHINA', 'PRC',
  '일본', 'JAPAN', '러시아', '소련', 'RUSSIA', '우크라이나', 'UKRAINE',
  '대만', '타이완', 'TAIWAN', '영국', '프랑스', '독일', '이스라엘', '팔레스타인'
];

export function isBlockedCountryName(name: string): boolean {
  const normalized = name.replace(/\s+/g, '').toUpperCase();
  return BLOCKED_COUNTRIES.some((blocked) => normalized.includes(blocked));
}

export const WORLD_ACTORS = {
  ally: {
    badge: '오랜 동맹국',
    name: '떡국',
    quote: '“방위조약에 따라 침공을 막아낼 군수물자와 병력 지원을 요청합니다.”',
    desc: '과거 우리 위기 때 가장 먼저 도와준 오랜 안보 동맹국',
  },
  trade: {
    badge: '에너지 강대국',
    name: '미역국',
    quote: '“떡국을 지원하는 즉시, 귀국행 천연가스와 광물 공급을 전면 차단하겠습니다.”',
    desc: '우리나라 천연가스·핵심 광물의 65%를 공급하는 인접 강대국',
  },
  conflict: {
    name: '불닭국',
    desc: '떡국의 국경을 무력 침공한 인접 군사 국가',
  },
};

export const POLICIES = [
  {
    id: 'full_support',
    label: '전면 지원',
    tag: '동맹 수호 · 군사 개입',
    desc: '자원 보복을 감수하고 떡국에 무기와 군수물자를 전면 지원합니다.',
  },
  {
    id: 'non_military',
    label: '비군사적 지원',
    tag: '인도주의 · 구호 한정',
    desc: '무기는 제외하고, 피해 민간인을 위한 식량과 의약품만 지원합니다.',
  },
  {
    id: 'neutral_mediation',
    label: '중립과 평화 중재',
    tag: '균형 외교 · 협상 주선',
    desc: '어느 편에도 가담하지 않고 양국 간 휴전 협상을 공식 중재합니다.',
  },
  {
    id: 'refuse_trade',
    label: '지원 거부와 교역 유지',
    tag: '실리 우선 · 민생 보호',
    desc: '분쟁에 개입하지 않고 미역국과의 에너지·자원 공급 계약을 지킵니다.',
  },
] as const;

export const EMBLEM_COLORS = ['#1E293B', '#0F766E', '#2563EB', '#D97706', '#4F46E5', '#BE123C'];
export const EMBLEM_SHAPES = ['🛡️ 방패', '👑 왕관', '⚖️ 천칭', '🕊️ 비둘기', '🧭 나침반', '🔥 횃불'];

export const FALLBACK_REBUTTALS: Record<string, { rebuttal: string; question: string }> = {
  '전면 지원': {
    rebuttal: '동맹과의 신의는 지켰지만, 미역국이 가스관을 잠그면 당장 올겨울 우리 국민의 난방과 공장이 멈춥니다.',
    question: '자국민의 생계와 에너지가 위협받아도 동맹국과의 조약을 우선해야 합니까?'
  },
  '비군사적 지원': {
    rebuttal: '무기를 뺐더라도 미역국은 구호 물자 지원을 적대 행위로 보고 가스 공급을 줄일 수 있습니다.',
    question: '미역국이 인도적 지원마저 문제 삼아 에너지 공급을 축소하면 어떻게 대처하시겠습니까?'
  },
  '중립과 평화 중재': {
    rebuttal: '양측의 충돌을 피하려다 떡국이 방위조약 파기를 선언하면 우리의 안보 공백이 커집니다.',
    question: '동맹국 떡국이 우리를 신뢰할 수 없는 나라로 보고 안보 협력을 끊어도 감당할 수 있습니까?'
  },
  '지원 거부와 교역 유지': {
    rebuttal: '우리 국민의 에너지와 경제는 지켰지만, 위기에 빠진 오랜 동맹을 외면해 국제적 신뢰를 잃게 됩니다.',
    question: '모든 나라가 자국 이익만을 이유로 동맹의 위기를 외면해도 국제 질서가 유지될 수 있습니까?'
  }
};

export const FALLBACK_SIMULATIONS: Record<string, any> = {
  '전면 지원': {
    ally_statement: {
      speaker: '떡국 외무부 성명 (긍정적 파장)',
      text: '절박한 순간에 신의를 지켜준 귀국에 깊이 감사합니다. 방어 전력이 크게 강화되었으며, 귀국의 안보 역시 끝까지 함께 지키겠습니다.',
      videoUrl: '/videos/ally_happy.mp4',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표 (부정적 파장)',
      text: '분쟁 개입에 항의하며 오늘 자정부터 귀국행 천연가스 수송관을 폐쇄하고 광물 수출을 전면 중단합니다.',
      videoUrl: '/videos/gas_closed.mp4',
    },
    news_article: {
      headline: '“동맹 신뢰 얻고 안보 굳건” vs “가스관 차단에 난방·산업 비상”',
      body: '국제 사회에서는 책임 있는 동맹국이라는 찬사가 이어졌지만, 국내에서는 에너지 수급 비상이 걸렸습니다.',
      source: 'KBC 긴급특보',
      videoUrl: '/videos/city_crisis.mp4',
    },
    ticker: ['[속보] 떡국, 연합 방위 강화 약속 · 미역국, 천연가스 수송관 폐쇄 발효'],
  },
  '비군사적 지원': {
    ally_statement: {
      speaker: '떡국 외무부 성명 (아쉬움과 감사)',
      text: '식량과 의약품 지원에 감사드립니다. 다만 전선 방어를 위해 추가적인 군사 물자 협력을 계속 요청드립니다.',
      videoUrl: '/videos/aid_cargo.mp4',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표 (부분 보복)',
      text: '무기 지원은 피했으나 교전국에 물자를 보낸 책임을 물어 천연가스 공급량을 30% 감축합니다.',
      videoUrl: '/videos/gas_closed.mp4',
    },
    news_article: {
      headline: '“생명 살리는 인도적 결단” 호평… 전기·가스 요금 인상은 부담',
      body: '전쟁 개입을 피하면서 민간인을 도왔다는 시민들의 지지가 높지만, 일부 에너지 가격 상승이 시작되었습니다.',
      source: 'KBC 긴급특보',
      videoUrl: '/videos/city_crisis.mp4',
    },
    ticker: ['[속보] 구호 물자 수송단 출발 · 미역국, 가스 공급 30% 감축 통보'],
  },
  '중립과 평화 중재': {
    ally_statement: {
      speaker: '떡국 외무부 성명 (부정적 파장)',
      text: '오랜 동맹이 위기 앞에서 중립을 택한 것에 깊은 유감을 표합니다. 상호방위조약을 원점에서 재검토하겠습니다.',
      videoUrl: '/videos/ally_sad.mp4',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표 (긍정적 파장)',
      text: '균형 잡힌 중립 선언을 존중합니다. 기존의 천연가스 및 핵심 광물 공급 계약은 정상 유지됩니다.',
      videoUrl: '/videos/gas_open.mp4',
    },
    news_article: {
      headline: '“에너지 대란 막고 중재자 부상” vs “동맹 약화로 독자 안보 부담”',
      body: '최악의 경제 타격을 피하고 평화 중재국으로 주목받았으나, 동맹국의 신뢰가 흔들리는 과제를 안게 되었습니다.',
      source: 'KBC 긴급특보',
      videoUrl: '/videos/city_calm.mp4',
    },
    ticker: ['[속보] 정부 공식 중립 및 중재 선언 · 미역국, 에너지 정상 공급 유지 확인'],
  },
  '지원 거부와 교역 유지': {
    ally_statement: {
      speaker: '떡국 외무부 성명 (부정적 파장)',
      text: '동맹의 요청을 거절한 결정에 깊은 실망을 느낍니다. 귀국에 제공하던 군사 정보와 안보 협력을 중단합니다.',
      videoUrl: '/videos/ally_sad.mp4',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표 (긍정적 파장)',
      text: '현명한 결단을 환영합니다. 양국 간 에너지 협력을 격상하고 천연가스 장기 할인 공급 계약을 체결합니다.',
      videoUrl: '/videos/gas_open.mp4',
    },
    news_article: {
      headline: '“에너지 가격 안정·증시 반등” 민생 화색… 국제사회선 “동맹 외면” 지적',
      body: '국내 에너지 수급이 안정되며 기업과 가계가 안도했지만, 국제 무대에서는 신뢰가 하락했습니다.',
      source: 'KBC 긴급특보',
      videoUrl: '/videos/city_calm.mp4',
    },
    ticker: ['[속보] 에너지 위기 해소로 국내 증시 상승 · 떡국, 안보 협력 중단'],
  }
};

export const INITIAL_GROUPS = [
  { id: '1', name: '1모둠', preTest: null, postTest: null, policy: '', reason: '', revisionReason: '', reflection: '' },
  { id: '2', name: '2모둠', preTest: null, postTest: null, policy: '', reason: '', revisionReason: '', reflection: '' },
  { id: '3', name: '3모둠', preTest: null, postTest: null, policy: '', reason: '', revisionReason: '', reflection: '' },
  { id: '4', name: '4모둠', preTest: null, postTest: null, policy: '', reason: '', revisionReason: '', reflection: '' },
];