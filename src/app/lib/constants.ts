export const DEFAULT_SESSION_ID = 'active-session';

export const WORLD_ACTORS = {
  ally: {
    name: '떡국',
    badge: '오랜 동맹국',
    quote: '“과거에 우리가 도왔던 것처럼, 이번에는 떡국을 도와주십시오.”',
    desc: '불닭국의 공격을 받아 큰 피해를 입고 있는 동맹국입니다.',
  },
  trade: {
    name: '미역국',
    badge: '불닭국과 가까운 자원 나라',
    quote: '“떡국을 도우면 천연가스와 광물(65%) 공급을 끊겠습니다.”',
    desc: '우리 나라가 쓰는 천연가스와 핵심 광물의 65%를 공급하는 나라입니다.',
  },
  conflict: {
    name: '불닭국',
    badge: '공격한 나라',
    quote: '“다른 나라는 이 문제에 끼어들지 마십시오.”',
    desc: '떡국을 공격한 군사력이 강한 나라입니다.',
  },
};

export const ROLE_CARDS = [
  {
    id: 'president',
    icon: '🎖️',
    title: '대통령',
    focus: '나라의 결정',
    prompt: '“여러 입장을 듣고 우리 나라가 어떤 선택을 할지 결정합니다.”',
  },
  {
    id: 'entrepreneur',
    icon: '🏭',
    title: '기업가',
    focus: '공장과 무역',
    prompt: '“핵심 광물이 끊기면 공장이 멈추고, 약속을 어기면 다른 나라와의 무역도 어려워집니다.”',
  },
  {
    id: 'merchant',
    icon: '🏪',
    title: '소상공인',
    focus: '가게와 생활비',
    prompt: '“가스가 끊겨 전기·난방비와 물가가 오르면 동네 가게와 살림살이가 힘들어집니다.”',
  },
  {
    id: 'activist',
    icon: '🚑',
    title: '구호단체 활동가',
    focus: '약속과 피해자',
    prompt: '“어려울 때 도와주기로 한 약속과 전쟁으로 고통받는 사람들의 삶을 외면할 수 없습니다.”',
  },
];

export const POLICIES = [
  {
    id: 'full_support',
    tag: '약속 지키기',
    label: '전면 지원',
    desc: '약속대로 떡국에 무기와 물자를 보냅니다.',
  },
  {
    id: 'non_military',
    tag: '피해 줄이기',
    label: '비군사적 지원',
    desc: '군인이나 무기 대신 식량과 약품만 보냅니다.',
  },
  {
    id: 'neutral_mediation',
    tag: '싸움 피하기',
    label: '중립과 평화 중재',
    desc: '어느 편도 들지 않고 전쟁을 멈추자고 중재합니다.',
  },
  {
    id: 'refuse_trade',
    tag: '생활 지키기',
    label: '지원 거부와 교역 유지',
    desc: '떡국을 돕지 않고 미역국과 계속 거래합니다.',
  },
];

export const EMBLEM_COLORS = ['#0F766E', '#1E293B', '#4F46E5', '#D97706', '#BE123C'];
export const EMBLEM_SHAPES = ['🛡️ 방패', '🕊️ 비둘기', '⚖️ 천칭', '🧭 나침반', '🔥 횃불', '🌿 올리브'];

const BLOCKED_COUNTRIES = [
  '한국', '대한민국', '남한', '북한', '조선', '미국', '중국', '일본', '러시아', '우크라이나',
  '영국', '프랑스', '독일', '이스라엘', '팔레스타인', '대만', '인도', '베트남', '캐나다', '호주',
];

export function isBlockedCountryName(text: string): boolean {
  const clean = (text || '').replace(/\s+/g, '');
  return BLOCKED_COUNTRIES.some((c) => clean.includes(c));
}

export const FALLBACK_REBUTTALS: Record<string, { rebuttal: string; question: string }> = {
  '전면 지원': {
    rebuttal: '떡국과의 약속을 지키는 선택이지만, 미역국이 가스와 광물을 끊으면 당장 겨울 난방과 공장 가동이 어려워집니다.',
    question: '가게와 기업의 피해를 감수하고도 지원을 보낼 만한 이유가 충분한가요?',
  },
  '비군사적 지원': {
    rebuttal: '무기 대신 구호품을 보내는 방법이지만, 미역국은 이마저도 불닭국에 맞서는 행동으로 보고 자원 공급을 줄일 수 있습니다.',
    question: '도움을 다 주지도 못하면서 에너지 손해를 입을 수 있는데 괜찮겠습니까?',
  },
  '중립과 평화 중재': {
    rebuttal: '전쟁에 휘말리지 않으려는 선택이지만, 공격을 받는 떡국 입장에서는 도움을 받지 못해 큰 실망을 할 수 있습니다.',
    question: '지금 떡국을 돕지 않으면, 나중에 우리가 위기에 처했을 때 도움을 받을 수 있을까요?',
  },
  '지원 거부와 교역 유지': {
    rebuttal: '당장 필요한 가스와 물가를 지키는 선택이지만, 동맹국 떡국과의 약속을 어기게 됩니다.',
    question: '약속을 어기더라도 우리 나라의 당장 이익을 지키는 것이 옳은 선택일까요?',
  },
};

export const FALLBACK_SIMULATIONS: Record<string, any> = {
  '전면 지원': {
    ally_statement: {
      speaker: '떡국 외무부 발표',
      text: '어려울 때 약속을 지켜 주어 고맙습니다. 떡국 국민은 이 도움을 잊지 않겠습니다.',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표',
      text: '말한 대로 천연가스와 광물 공급을 끊습니다. 그에 따른 결과는 귀국이 책임져야 합니다.',
    },
    news_article: {
      headline: '떡국 지원 결정에 가스 공급 중단…국내 난방·공장 비상',
      body: '약속은 지켰지만 가스 공급이 끊기면서 가게와 공장의 어려움이 커지고 있습니다.',
      source: 'KBC 긴급특보',
    },
    ticker: ['떡국 전면 지원 결정', '미역국 가스·광물 공급 중단', '국내 에너지 공급 차질'],
  },
  '비군사적 지원': {
    ally_statement: {
      speaker: '떡국 외무부 발표',
      text: '식량과 약품 지원은 고맙지만, 지금 당장은 공격을 막을 장비와 물자가 더 필요합니다.',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표',
      text: '구호 물자 지원도 반대 행동으로 봅니다. 다음 달부터 자원 공급량을 줄이겠습니다.',
    },
    news_article: {
      headline: '식량·약품 지원 결정…피해는 줄이려 했지만 자원 감축 예고',
      body: '직접 싸움에 뛰어들지는 않았지만 미역국의 자원 감축과 떡국의 추가 요청이 이어지고 있습니다.',
      source: 'KBC 긴급특보',
    },
    ticker: ['떡국에 식량·약품 지원', '미역국 자원 공급 축소 예고', '국내 물가·수급 불안'],
  },
  '중립과 평화 중재': {
    ally_statement: {
      speaker: '떡국 외무부 발표',
      text: '공격받은 나라와 공격한 나라를 똑같이 대하는 중립 결정에 크게 실망했습니다.',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표',
      text: '끼어들지 않겠다는 결정을 받아들이며, 천연가스와 광물은 계속 공급하겠습니다.',
    },
    news_article: {
      headline: '중립 선언으로 가스 공급 유지…떡국에서는 아쉬움 목소리',
      body: '가스와 광물은 계속 들어오지만, 동맹국을 돕지 않았다는 비판도 나오고 있습니다.',
      source: 'KBC 긴급특보',
    },
    ticker: ['중립 및 평화 중재 선택', '미역국 가스·광물 공급 유지', '떡국, 외교적 실망 표명'],
  },
  '지원 거부와 교역 유지': {
    ally_statement: {
      speaker: '떡국 외무부 발표',
      text: '가장 어려울 때 약속을 지키지 않은 나라와는 앞으로 함께하기 어렵습니다.',
    },
    trade_response: {
      speaker: '미역국 에너지부 발표',
      text: '우리와 거래를 이어가기로 한 결정을 환영하며, 자원을 계속 공급하겠습니다.',
    },
    news_article: {
      headline: '가스·물가는 지켰지만…약속 위반 논란 속 의견 엇갈려',
      body: '가게와 공장은 한숨 돌렸지만, 동맹과의 약속을 어겼다는 지적도 이어지고 있습니다.',
      source: 'KBC 긴급특보',
    },
    ticker: ['지원 거부 및 교역 유지 결정', '국내 가스·물가 안정 유지', '약속 위반 논란 확산'],
  },
};