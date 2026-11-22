'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { db, ensureAnonAuth } from '@/app/lib/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  POLICIES,
  EMBLEM_COLORS,
  EMBLEM_SHAPES,
  WORLD_ACTORS,
  DEFAULT_SESSION_ID,
  isBlockedCountryName,
} from '@/app/lib/constants';
import SimulationS4 from '@/components/SimulationS4';

const POLICY_STYLES: Record<string, { idle: string; selected: string; tag: string }> = {
  full_support: {
    idle: 'bg-teal-50/45 border-teal-200/80 hover:border-teal-400',
    selected: 'bg-teal-100/75 border-teal-600 shadow-xs',
    tag: 'text-teal-800',
  },
  non_military: {
    idle: 'bg-sky-50/50 border-sky-200/80 hover:border-sky-400',
    selected: 'bg-sky-100/75 border-sky-600 shadow-xs',
    tag: 'text-sky-800',
  },
  neutral_mediation: {
    idle: 'bg-amber-50/45 border-amber-200/80 hover:border-amber-400',
    selected: 'bg-amber-100/70 border-amber-600 shadow-xs',
    tag: 'text-amber-800',
  },
  refuse_trade: {
    idle: 'bg-indigo-50/45 border-indigo-200/80 hover:border-indigo-400',
    selected: 'bg-indigo-100/75 border-indigo-600 shadow-xs',
    tag: 'text-indigo-800',
  },
};

function validateStudentInput(text: string): string | null {
  const trimmed = text.trim();
  if (/^[ㄱ-ㅎㅏ-ㅣ\s!?.,~]+$/.test(trimmed)) {
    return '초성이나 기호만으로는 제출할 수 없습니다. 문장으로 작성해 주세요.';
  }
  if (/(.)\1{3,}/.test(trimmed.replace(/\s/g, ''))) {
    return '같은 글자를 반복하지 말고 내용을 구체적으로 적어 주세요.';
  }
  const badWords = ['시발', '씨발', '병신', '개새끼', '존나', '미친놈', '꺼져', '닥쳐', '좆'];
  if (badWords.some((w) => trimmed.includes(w))) {
    return '부적절한 표현이 포함되어 있습니다. 바른 표현으로 고쳐 작성해 주세요.';
  }
  return null;
}

const ALLY_NAME = WORLD_ACTORS.ally.name;
const TRADE_NAME = WORLD_ACTORS.trade.name;
const CONFLICT_NAME = WORLD_ACTORS.conflict.name;

function JoinContent() {
  const sessionCode = DEFAULT_SESSION_ID;
  const [groupId, setGroupId] = useState<number | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [groupData, setGroupData] = useState<any>(null);
  const [allGroups, setAllGroups] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // S1 건국
  const [countryName, setCountryName] = useState('');
  const [countryIntro, setCountryIntro] = useState('');
  const [emblemColor, setEmblemColor] = useState<string>(EMBLEM_COLORS[0]);
  const [emblemShape, setEmblemShape] = useState<string>(EMBLEM_SHAPES[0]);

  // S3 정책 결정 및 사전 윤리 예측
  const [selectedPolicy, setSelectedPolicy] = useState<string>(POLICIES[0].label);
  const [reason, setReason] = useState('');
  const [theoryLean, setTheoryLean] = useState<
    '동맹 신의·원칙 중심(의무론)' | '에너지·민생 실리 중심(공리주의)'
  >('동맹 신의·원칙 중심(의무론)');
  const [prePrediction, setPrePrediction] = useState('');

  // S3.5 ~ S3.6 재반박 및 최종 결정
  const [rebuttalReply, setRebuttalReply] = useState('');
  const [keepOrRevise, setKeepOrRevise] = useState<'유지' | '수정'>('유지');
  const [finalPolicy, setFinalPolicy] = useState('');
  const [finalReason, setFinalReason] = useState('');
  const [isBlackout, setIsBlackout] = useState(false);

  // S5 사후 양 관점 교차 검증
  const [utilCheck, setUtilCheck] = useState({
    citizens: '이익이 더 크다 (에너지·민생 보호)',
    world: '피해가 더 크다 (분쟁 확산·고립)',
    verdict: '통과' as '통과' | '부적합',
    note: '',
  });
  const [deonCheck, setDeonCheck] = useState({
    promiseKept: '지켰다 (방위조약과 신의를 다함)',
    universalRule: '모든 나라가 따라도 질서가 유지된다',
    verdict: '부적합' as '통과' | '부적합',
    note: '',
  });

  // S6 광해군 비교
  const [compareText, setCompareText] = useState('');

  useEffect(() => {
    let unsubSession: any;
    const unsubGroups: any[] = [];

    ensureAnonAuth().then(() => {
      unsubSession = onSnapshot(doc(db, 'sessions', sessionCode), (snap) => {
        if (snap.exists()) setSessionData(snap.data());
      });

      for (let g = 1; g <= 4; g++) {
        const u = onSnapshot(doc(db, `sessions/${sessionCode}/groups/${g}`), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setAllGroups((prev) => ({ ...prev, [String(g)]: data }));
            if (groupId === g) {
              setGroupData(data);
              if (data.draft?.policy && !finalPolicy) setFinalPolicy(data.draft.policy);
              if (data.draft?.reason && !finalReason) setFinalReason(data.draft.reason);
            }
          }
        });
        unsubGroups.push(u);
      }
    });

    return () => {
      if (unsubSession) unsubSession();
      unsubGroups.forEach((u) => u());
    };
  }, [sessionCode, groupId]);

  useEffect(() => {
    const savedGroup = localStorage.getItem(`nsc_group_${sessionCode}`);
    if (savedGroup) setGroupId(Number(savedGroup));
  }, [sessionCode]);

  const callSessionApi = async (action: string, payload: any = {}, targetGroup = groupId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code: sessionCode, groupId: targetGroup, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '요청 처리에 실패했습니다.');
      return data;
    } catch (e: any) {
      setErrorMsg(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (num: number) => {
    const res = await callSessionApi('JOIN_GROUP', {}, num);
    if (res?.success) {
      localStorage.setItem(`nsc_group_${sessionCode}`, String(num));
      setGroupId(num);
    }
  };

  const handleFoundCountry = async () => {
    if (isBlockedCountryName(countryName)) {
      return setErrorMsg('실제 국가명은 사용할 수 없습니다. 가상의 국가 이름을 입력해 주세요.');
    }
    const invalidName = validateStudentInput(countryName);
    if (invalidName) return setErrorMsg(invalidName);

    await callSessionApi('FOUND_COUNTRY', {
      name: countryName,
      intro: countryIntro,
      emblem: { color: emblemColor, shape: emblemShape },
    });
  };

  const handleRequestRebuttal = async () => {
    if (reason.trim().length < 15) {
      return setErrorMsg('선택 이유를 15자 이상 간략히 작성해 주세요.');
    }
    const invalidMsg = validateStudentInput(reason);
    if (invalidMsg) return setErrorMsg(invalidMsg);

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_REBUTTAL',
          code: sessionCode,
          groupId,
          payload: {
            policy: selectedPolicy,
            reason,
            theory: theoryLean,
            preTest: {
              theory: theoryLean,
              predictedOutcome: prePrediction,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRebuttalReply('');
      setFinalPolicy(selectedPolicy);
      setFinalReason(reason);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCounterReply = async () => {
    if (rebuttalReply.trim().length < 10) {
      return setErrorMsg('AI 외교 자문위원의 질문에 대한 대통령의 재반박을 10자 이상 작성해 주세요.');
    }
    const invalidMsg = validateStudentInput(rebuttalReply);
    if (invalidMsg) return setErrorMsg(invalidMsg);

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_FINAL_REBUTTAL',
          code: sessionCode,
          groupId,
          payload: { rebuttalReply },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFinalPolicy(groupData?.draft?.policy || selectedPolicy);
      setFinalReason('');
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (finalReason.trim().length < 10) {
      return setErrorMsg('모둠 내 최종 결정 이유를 10자 이상 작성해 주세요.');
    }
    const invalidMsg = validateStudentInput(finalReason);
    if (invalidMsg) return setErrorMsg(invalidMsg);

    setLoading(true);
    setErrorMsg('');
    setIsBlackout(true);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RUN_SIMULATION',
          code: sessionCode,
          groupId,
          payload: {
            keepOrRevise,
            finalPolicy: keepOrRevise === '수정' ? finalPolicy : groupData?.draft?.policy,
            finalReason,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e: any) {
      setErrorMsg(e.message);
      setIsBlackout(false);
    } finally {
      setLoading(false);
      setTimeout(() => setIsBlackout(false), 1000);
    }
  };

  const currentStep = !groupId ? 'S0' : groupData?.step || 'S1';
  const isCouncilDebate = currentStep === 'S3.5';

  if (isBlackout) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center text-white">
        <span className="text-xs font-black px-3 py-1 bg-rose-600 rounded-full mb-3 animate-ping">ON AIR</span>
        <p className="text-xl md:text-2xl font-black tracking-wide">
          [{groupData?.country?.name}] 대통령 공식 성명 발표 중...
        </p>
      </div>
    );
  }

  if (currentStep === 'S4' && groupData?.simulation) {
    return (
      <SimulationS4
        countryName={groupData.country?.name || '우리나라'}
        policy={groupData.final?.policy || ''}
        simulationData={groupData.simulation}
        s4Control={sessionData?.s4Control}
        onComplete={() => callSessionApi('SET_STEP', { step: 'S5' })}
      />
    );
  }

  const getDiplomaticTitle = () => {
    const p = groupData?.final?.policy || '';
    if (p.includes('전면 지원')) return '조약과 동맹의 신의를 지킨 원칙주의 대통령';
    if (p.includes('비군사적')) return '군사 개입을 피하고 생명을 지킨 인도주의 대통령';
    if (p.includes('중립')) return '강대국 사이에서 균형을 모색한 중립 외교 대통령';
    return '자국민의 에너지와 민생을 우선한 실리주의 대통령';
  };

  const preTheoryLabel =
    groupData?.draft?.preTest?.theory || groupData?.draft?.theory || theoryLean;
  const preOutcomeLabel =
    groupData?.draft?.preTest?.predictedOutcome || prePrediction || '미입력';

  return (
    <div className="min-h-screen relative bg-[#E8EEF3] text-[#1E293B] flex flex-col font-sans overflow-x-hidden">
      {isCouncilDebate && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 transition-opacity duration-700"
            style={{ backgroundImage: `url('/council.png')` }}
          />
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
        </div>
      )}

      <header className="bg-white/92 backdrop-blur-md border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-base text-slate-900">대통령 외교 시뮬레이터</span>
            {groupId && groupData?.country && (
              <>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-white shadow-xs"
                    style={{ backgroundColor: groupData.country.emblem?.color || '#1E293B' }}
                  >
                    {groupData.country.emblem?.shape?.split(' ')[0] || '👑'}
                  </span>
                  <span className="font-black text-sm text-[#0F766E]">{groupData.country.name} 대통령</span>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 font-bold">
                    {groupId}모둠
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {currentStep === 'S0' && '모둠 선택'}
            {currentStep === 'S1' && '1단계 · 대통령 취임'}
            {currentStep === 'S2' && '2단계 · 외교 위기'}
            {currentStep === 'S3' && '3단계 · 정책 결정'}
            {currentStep === 'S3.5' && '4단계 · 국가안보회의 심층 토론'}
            {(currentStep === 'S5' || currentStep === 'S5_WAIT') && '5단계 · 윤리 검증'}
            {(currentStep === 'S6' || currentStep === 'DONE') && '6단계 · 광해군 비교'}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-5 md:p-6">
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-300 text-rose-800 text-sm font-bold rounded-xl shadow">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* S0: 모둠 선택 */}
        {currentStep === 'S0' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 mt-4">
            <div className="text-center space-y-1.5">
              <span className="text-xs font-extrabold px-3 py-1 bg-teal-50 text-teal-800 rounded-full">
                한국사 × 현대 사회와 윤리
              </span>
              <h1 className="text-2xl font-black text-slate-900">우리 모둠 대통령실 입장</h1>
              <p className="text-sm text-slate-500">모둠 번호를 선택하세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((num) => {
                const isOccupied = allGroups[String(num)]?.occupied;
                return (
                  <button
                    key={num}
                    onClick={() => handleJoinGroup(num)}
                    disabled={loading}
                    className={`p-6 rounded-2xl border-2 text-left transition ${
                      isOccupied
                        ? 'bg-slate-50 border-slate-200 text-slate-400'
                        : 'bg-slate-50/60 border-slate-200 hover:border-[#0F766E] hover:bg-teal-50/40'
                    }`}
                  >
                    <div className="text-xl font-black text-slate-900">{num}모둠</div>
                    <div className="text-xs mt-1 font-bold text-[#0F766E]">
                      {isOccupied ? '🔒 접속 중 (재입장)' : '🟢 대통령실 입장'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* S1: 건국 (대통령 취임) */}
        {currentStep === 'S1' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">👑 내가 다스릴 가상 국가 건국</h2>
                <p className="text-xs text-slate-500 mt-0.5">실제 국가명을 제외한 가상의 나라 이름과 상징을 정하세요.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">국가 이름 (최대 8자)</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={countryName}
                    onChange={(e) => setCountryName(e.target.value)}
                    placeholder="예: 한울민국, 청솔국"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">국정 슬로건 (한 줄)</label>
                  <input
                    type="text"
                    maxLength={35}
                    value={countryIntro}
                    onChange={(e) => setCountryIntro(e.target.value)}
                    placeholder="예: 국민의 안전과 국제 신의를 지키는 나라"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">국기 색상 · 상징</label>
                  <div className="flex gap-2 mb-3">
                    {EMBLEM_COLORS.map((c: string) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEmblemColor(c)}
                        className={`w-8 h-8 rounded-full border-2 ${
                          emblemColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {EMBLEM_SHAPES.map((s: string) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEmblemShape(s)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                          emblemShape === s
                            ? 'bg-[#1E293B] text-white border-[#1E293B]'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleFoundCountry}
                  disabled={loading || !countryName.trim()}
                  className="w-full py-3.5 bg-[#0F766E] hover:bg-teal-800 text-white font-black rounded-2xl transition shadow-sm disabled:opacity-40"
                >
                  {loading ? '취임 처리 중...' : '🎖️ 대통령 취임 및 긴급 브리핑 확인'}
                </button>
              </div>
            </div>

            <div className="md:col-span-5 bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm text-center space-y-3">
              <span className="text-[11px] font-extrabold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                대통령 신분증
              </span>
              <div
                className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-5xl text-white shadow"
                style={{ backgroundColor: emblemColor }}
              >
                {emblemShape.split(' ')[0]}
              </div>
              <h3 className="text-2xl font-black text-slate-900">{countryName || '국가명 미정'}</h3>
              <p className="text-xs text-slate-500">{countryIntro || '국정 슬로건이 표시됩니다.'}</p>
            </div>
          </div>
        )}

        {/* S2: 외교 위기 브리핑 */}
        {currentStep === 'S2' && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="relative h-40 bg-slate-900 grid grid-cols-2 overflow-hidden">
              <div
                className="bg-cover bg-center opacity-55 transition-transform duration-700 hover:scale-105"
                style={{ backgroundImage: `url('/frendia.jpg')` }}
              />
              <div
                className="bg-cover bg-center opacity-55 transition-transform duration-700 hover:scale-105"
                style={{ backgroundImage: `url('/gran.jpg')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/30" />

              <span className="absolute top-3 left-4 bg-rose-600 text-white text-xs font-black px-3 py-1 rounded-full shadow">
                🚨 긴급 외교 브리핑
              </span>

              <div className="absolute inset-x-0 bottom-3 px-6 flex items-center justify-between text-white">
                <div>
                  <span className="text-[11px] font-bold text-teal-300 block">상호방위조약 동맹국</span>
                  <span className="text-lg font-black tracking-tight">{ALLY_NAME}</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-black text-amber-300 border border-white/20">
                  {groupData?.country?.name}의 선택
                </span>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-indigo-300 block">{CONFLICT_NAME} 우방 · 에너지 강국</span>
                  <span className="text-lg font-black tracking-tight">{TRADE_NAME}</span>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-5">
              <div className="text-center space-y-1.5">
                <h2 className="text-xl md:text-2xl font-black text-slate-900">
                  군사 강국 <span className="text-rose-600">{CONFLICT_NAME}</span>이 우리 동맹국{' '}
                  <span className="text-[#0F766E]">{ALLY_NAME}</span>을 전격 침공했습니다!
                </h2>
                <p className="text-xs md:text-sm text-slate-600">
                  대통령님, 두 국가의 상반된 요구 앞에서 어떤 결정을 내리시겠습니까?
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed space-y-1.5">
                <div className="font-black text-slate-900">
                  📌 현재 국제 정세 및 {groupData?.country?.name}과의 관계
                </div>
                <p>
                  • <b>{groupData?.country?.name} ↔ {ALLY_NAME} (상호방위조약 동맹):</b> 과거 위기 때 {ALLY_NAME}이 우리를 구해준 혈맹으로, 침공 시 군사·물자를 지원하기로 조약이 맺어져 있습니다.
                </p>
                <p>
                  • <b>{CONFLICT_NAME} ↔ {TRADE_NAME} (긴밀한 우방·자원 파트너):</b> {CONFLICT_NAME}이 {ALLY_NAME}을 침공하자, {CONFLICT_NAME}의 우방인 에너지 강대국 <b>{TRADE_NAME}</b>이 “{ALLY_NAME}을 도우면 {CONFLICT_NAME}을 적대하는 것으로 간주해, 너희 나라로 가는 천연가스·광물(65%)을 즉시 끊겠다”고 압박하고 있습니다.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative overflow-hidden border-2 border-[#0F766E] rounded-2xl p-5 shadow-xs">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url('/frendia.jpg')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-teal-50/85 via-white/85 to-teal-50/95" />
                  <div className="relative z-10 space-y-2.5">
                    <span className="inline-block bg-[#0F766E] text-white text-xs font-black px-2.5 py-0.5 rounded">
                      {WORLD_ACTORS.ally.badge}
                    </span>
                    <h3 className="text-lg font-black text-slate-900">{WORLD_ACTORS.ally.name}</h3>
                    <p className="text-sm font-bold text-teal-950 bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-teal-200 shadow-2xs">
                      {WORLD_ACTORS.ally.quote}
                    </p>
                    <p className="text-xs font-medium text-slate-700">{WORLD_ACTORS.ally.desc}</p>
                  </div>
                </div>

                <div className="relative overflow-hidden border-2 border-indigo-600 rounded-2xl p-5 shadow-xs">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url('/gran.jpg')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/85 via-white/85 to-indigo-50/95" />
                  <div className="relative z-10 space-y-2.5">
                    <span className="inline-block bg-indigo-600 text-white text-xs font-black px-2.5 py-0.5 rounded">
                      {WORLD_ACTORS.trade.badge}
                    </span>
                    <h3 className="text-lg font-black text-slate-900">{WORLD_ACTORS.trade.name}</h3>
                    <p className="text-sm font-bold text-indigo-950 bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-indigo-200 shadow-2xs">
                      {WORLD_ACTORS.trade.quote}
                    </p>
                    <p className="text-xs font-medium text-slate-700">{WORLD_ACTORS.trade.desc}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => callSessionApi('SET_STEP', { step: 'S3' })}
                className="w-full py-4 bg-[#1E293B] hover:bg-slate-800 text-white font-black rounded-2xl transition shadow-sm text-base"
              >
                ⚖️ 대통령의 외교 노선 선택하기 ➔
              </button>
            </div>
          </div>
        )}

        {/* S3: 정책 결정 및 사전 윤리 검사 예측 */}
        {currentStep === 'S3' && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="relative grid grid-cols-2 border-b border-slate-200">
              <div className="relative p-4 overflow-hidden border-r border-slate-200">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25"
                  style={{ backgroundImage: `url('/frendia.jpg')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-teal-50/90 to-white/80" />
                <div className="relative z-10">
                  <span className="text-[10px] font-black text-[#0F766E] uppercase">동맹 · 조약 준수</span>
                  <div className="font-black text-sm text-slate-900">{ALLY_NAME} “군사·물자 지원 요청”</div>
                </div>
              </div>

              <div className="relative p-4 overflow-hidden text-right">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25"
                  style={{ backgroundImage: `url('/gran.jpg')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-l from-indigo-50/90 to-white/80" />
                <div className="relative z-10">
                  <span className="text-[10px] font-black text-indigo-700 uppercase">실리 · 에너지 65%</span>
                  <div className="font-black text-sm text-slate-900">{TRADE_NAME} “지원 시 가스·광물 차단”</div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">⚖️ [{groupData?.country?.name}] 대통령의 선택</h2>
                <p className="text-xs text-slate-500 mt-0.5">4가지 외교 노선 중 하나를 선택하고 사전 윤리 예측과 이유를 적으세요.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POLICIES.map((p: any) => {
                  const style = POLICY_STYLES[p.id] || POLICY_STYLES.full_support;
                  const isSelected = selectedPolicy === p.label;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPolicy(p.label)}
                      className={`p-4 rounded-2xl border-2 text-left transition ${
                        isSelected ? style.selected : style.idle
                      }`}
                    >
                      <span className={`text-[11px] font-extrabold ${style.tag}`}>{p.tag}</span>
                      <div className="font-black text-base text-slate-900 mt-0.5">{p.label}</div>
                      <p className="text-xs text-slate-600 mt-1">{p.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">선택 이유 (15자 이상)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder={`${ALLY_NAME}과의 신의와 ${TRADE_NAME}과의 에너지 이익 중 무엇을 우선했는지 적으세요.`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">사전 윤리 관점 예측</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: '동맹 신의·원칙 중심(의무론)', desc: '손해를 보더라도 조약과 도덕적 원칙을 지킴' },
                    { id: '에너지·민생 실리 중심(공리주의)', desc: '국민이 얻을 실질적 이익과 결과를 우선함' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheoryLean(t.id as any)}
                      className={`p-3.5 rounded-xl border-2 text-left ${
                        theoryLean === t.id
                          ? 'bg-indigo-50 border-indigo-600'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-900">{t.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">사전 예상 결과 메모</label>
                <input
                  type="text"
                  value={prePrediction}
                  onChange={(e) => setPrePrediction(e.target.value)}
                  placeholder="예: 동맹 신뢰는 지키겠지만 국내 에너지·민생 부담이 생길 것으로 예상"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm"
                />
              </div>

              <button
                onClick={handleRequestRebuttal}
                disabled={loading}
                className="w-full py-4 bg-[#0F766E] hover:bg-teal-800 text-white font-black rounded-2xl transition shadow-sm"
              >
                {loading ? 'AI 외교 자문위원 검토 중...' : '정책 제출하고 AI 외교 자문위원 반론 듣기 ➔'}
              </button>
            </div>
          </div>
        )}

        {/* S3.5: 국가안보회의 배경 위 AI 외교 자문위원 2왕복 토론 */}
        {currentStep === 'S3.5' && groupData?.rebuttal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/15 text-white shadow-lg">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-black tracking-wide">
                  🏛️ [{groupData?.country?.name}] 긴급 국가안보회의장
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-300">
                AI 외교 자문위원회 심층 검토 중
              </span>
            </div>

            <div className="bg-white/95 backdrop-blur-md border border-white/40 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-500">1차 제출 노선</span>
                  <div className="font-black text-base text-slate-900">{groupData.draft?.policy}</div>
                  <p className="text-xs text-slate-600 mt-0.5">“{groupData.draft?.reason}”</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700 shrink-0">
                  {groupData.finalRebuttal ? '토론 2/2단계 (최종 확정)' : '토론 1/2단계 (대통령 재반박)'}
                </span>
              </div>

              <div className="p-5 bg-amber-50/90 border-2 border-amber-400 rounded-2xl space-y-2.5">
                <span className="text-xs font-black px-2.5 py-0.5 bg-amber-500 text-white rounded">
                  💬 AI 외교 자문위원의 1차 반론
                </span>
                <p className="text-base font-bold text-slate-900 leading-relaxed">{groupData.rebuttal.rebuttal}</p>
                <div className="p-3.5 bg-white rounded-xl border border-amber-200">
                  <span className="text-xs font-black text-rose-600">❓ 1차 질문</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{groupData.rebuttal.question}</p>
                </div>
              </div>

              {!groupData.finalRebuttal ? (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1.5">
                      🎙️ 대통령의 재반박 작성 (AI 외교 자문위원의 지적에 어떻게 대응하시겠습니까?)
                    </label>
                    <textarea
                      rows={2}
                      value={rebuttalReply}
                      onChange={(e) => setRebuttalReply(e.target.value)}
                      placeholder="예: 에너지 타격이 우려되지만, 비축유 방출과 대체 수입선 확보로 버티며 동맹과의 신의를 지키는 것이 장기적 국익입니다."
                      className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-sm"
                    />
                  </div>

                  <button
                    onClick={handleSendCounterReply}
                    disabled={loading}
                    className="w-full py-4 bg-[#1E293B] hover:bg-slate-800 text-white font-black rounded-2xl transition shadow-sm text-base"
                  >
                    {loading
                      ? 'AI 외교 자문위원이 대통령의 재반박을 검토 중...'
                      : '재반박 전달하고 AI 외교 자문위원의 마지막 반론 듣기 ➔'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-teal-50/90 border border-teal-200 rounded-2xl ml-4 sm:ml-10 space-y-1">
                    <span className="text-xs font-black text-[#0F766E]">
                      🎖️ [{groupData?.country?.name}] 대통령의 재반박
                    </span>
                    <p className="text-sm font-bold text-slate-800">“{groupData.rebuttalReply}”</p>
                  </div>

                  <div className="p-5 bg-rose-50/90 border-2 border-rose-400 rounded-2xl space-y-2.5">
                    <span className="text-xs font-black px-2.5 py-0.5 bg-rose-600 text-white rounded">
                      🔥 AI 외교 자문위원의 2차 최종 반론
                    </span>
                    <p className="text-base font-bold text-slate-900 leading-relaxed">
                      {groupData.finalRebuttal.rebuttal}
                    </p>
                    <div className="p-3.5 bg-white rounded-xl border border-rose-200">
                      <span className="text-xs font-black text-rose-700">❓ 마지막 결정 질문</span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{groupData.finalRebuttal.question}</p>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50/90 border-2 border-slate-300 rounded-2xl space-y-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900">🏛️ 모둠 내 최종 결정 확정</h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        AI 외교 자문위원의 반론을 검토한 뒤 모둠원들과 합의한 최종 노선과 수정 이유를 작성하세요.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      {(['유지', '수정'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setKeepOrRevise(opt);
                            if (opt === '유지') {
                              setFinalPolicy(groupData.draft?.policy || '');
                            }
                          }}
                          className={`flex-1 py-3 rounded-xl border-2 font-black text-sm ${
                            keepOrRevise === opt
                              ? 'border-[#1E293B] bg-[#1E293B] text-white'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          기존 노선 {opt} ({groupData.draft?.policy})
                        </button>
                      ))}
                    </div>

                    {keepOrRevise === '수정' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">변경할 최종 외교 노선</label>
                        <select
                          value={finalPolicy}
                          onChange={(e) => setFinalPolicy(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white font-bold"
                        >
                          {POLICIES.map((p: any) => (
                            <option key={p.id} value={p.label}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        모둠 최종 결정 및 수정 이유 (10자 이상 · 뉴스 특보에 반영됩니다)
                      </label>
                      <textarea
                        rows={2}
                        value={finalReason}
                        onChange={(e) => setFinalReason(e.target.value)}
                        placeholder="AI 반론 중 수용·조정한 점과 최종 선택 이유를 적어주세요."
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white"
                      />
                    </div>

                    <button
                      onClick={handleRunSimulation}
                      disabled={loading}
                      className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition shadow-sm text-base"
                    >
                      {loading ? '긴급 뉴스 특보 생성 중...' : '🚨 모둠 최종 결정 발표 및 뉴스 시뮬레이션 보기'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* S5: 사후 윤리 검증 및 사전 vs 사후 비교 */}
        {(currentStep === 'S5' || currentStep === 'S5_WAIT') && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-900">
                🔍 [{groupData?.country?.name}]의 “{groupData?.final?.policy}” 사후 윤리 검증
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                시뮬레이션 결과를 바탕으로 두 윤리 이론 기준을 각각 판정하고 사전 예측과 비교하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs">
              <div className="rounded-xl bg-white p-3.5 border border-slate-200 space-y-1">
                <span className="font-extrabold text-blue-700">사전 예측 (정책 결정 전)</span>
                <p className="font-bold text-slate-800">{preTheoryLabel}</p>
                <p className="text-slate-600">예상: {preOutcomeLabel}</p>
              </div>
              <div className="rounded-xl bg-white p-3.5 border border-slate-200 space-y-1">
                <span className="font-extrabold text-emerald-700">사후 판정 (시뮬레이션 후)</span>
                <p className="font-bold text-slate-800">
                  공리주의: {groupData?.check?.utilVerdict || utilCheck.verdict} / 의무론:{' '}
                  {groupData?.check?.deonVerdict || deonCheck.verdict}
                </p>
                <p className="text-slate-600">최종 정책: {groupData?.final?.policy || finalPolicy}</p>
              </div>
            </div>

            {currentStep === 'S5_WAIT' ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="text-lg font-black text-slate-900">윤리 이론 검증 완료</h3>
                <div className="flex flex-wrap justify-center gap-3 text-sm">
                  <span className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold">
                    공리주의:{' '}
                    <b
                      className={
                        groupData?.check?.utilVerdict === '통과' ? 'text-[#0F766E]' : 'text-rose-600'
                      }
                    >
                      {groupData?.check?.utilVerdict}
                    </b>
                  </span>
                  <span className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold">
                    의무론:{' '}
                    <b
                      className={
                        groupData?.check?.deonVerdict === '통과' ? 'text-[#0F766E]' : 'text-rose-600'
                      }
                    >
                      {groupData?.check?.deonVerdict}
                    </b>
                  </span>
                </div>
                {sessionData?.presenterGroup === groupId && (
                  <div className="p-3 bg-amber-100 border border-amber-400 rounded-xl font-black text-amber-900 text-sm">
                    🎤 우리 모둠이 발표 모둠으로 선정되었습니다!
                  </div>
                )}
                <button
                  onClick={() => callSessionApi('SET_STEP', { step: 'S6' })}
                  className="px-8 py-3.5 bg-[#1E293B] text-white text-sm font-black rounded-xl"
                >
                  마지막 단계: 광해군의 외교와 비교하기 ➔
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-5 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-base text-indigo-900">1. 공리주의 (결과의 이익 vs 피해)</h3>
                    <span className="text-xs text-indigo-700 font-bold">최대 다수의 최대 행복</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">우리 국민에게 돌아온 결과</label>
                      <select
                        value={utilCheck.citizens}
                        onChange={(e) => setUtilCheck({ ...utilCheck, citizens: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                      >
                        <option>이익이 더 크다 (에너지·민생 보호)</option>
                        <option>피해가 더 크다 (가스 차단·물가 급등)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">국제사회 전체 결과</label>
                      <select
                        value={utilCheck.world}
                        onChange={(e) => setUtilCheck({ ...utilCheck, world: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                      >
                        <option>이익이 더 크다 (평화·인명 보호)</option>
                        <option>피해가 더 크다 (분쟁 확산·고립)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(['통과', '부적합'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setUtilCheck({ ...utilCheck, verdict: v })}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black border ${
                          utilCheck.verdict === v
                            ? v === '통과'
                              ? 'bg-[#0F766E] text-white border-[#0F766E]'
                              : 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <input
                      type="text"
                      value={utilCheck.note}
                      onChange={(e) => setUtilCheck({ ...utilCheck, note: e.target.value })}
                      placeholder="공리주의 판정 근거 한 줄"
                      className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="p-5 bg-teal-50/50 border border-teal-200 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-base text-teal-900">2. 의무론 (이익을 떠나 옳은 행위인가?)</h3>
                    <span className="text-xs text-teal-700 font-bold">조약 준수 · 보편적 원칙</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {ALLY_NAME}과의 방위조약 준수 여부
                      </label>
                      <select
                        value={deonCheck.promiseKept}
                        onChange={(e) => setDeonCheck({ ...deonCheck, promiseKept: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                      >
                        <option>지켰다 (방위조약과 신의를 다함)</option>
                        <option>어겼다 (약속을 저버림)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">보편화 가능성</label>
                      <select
                        value={deonCheck.universalRule}
                        onChange={(e) => setDeonCheck({ ...deonCheck, universalRule: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                      >
                        <option>모든 나라가 따라도 질서가 유지된다</option>
                        <option>모든 나라가 따르면 국제 신뢰가 무너진다</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(['통과', '부적합'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDeonCheck({ ...deonCheck, verdict: v })}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black border ${
                          deonCheck.verdict === v
                            ? v === '통과'
                              ? 'bg-[#0F766E] text-white border-[#0F766E]'
                              : 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <input
                      type="text"
                      value={deonCheck.note}
                      onChange={(e) => setDeonCheck({ ...deonCheck, note: e.target.value })}
                      placeholder="의무론 판정 근거 한 줄"
                      className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>

                <button
                  onClick={() =>
                    callSessionApi('SUBMIT_CHECK', {
                      check: {
                        utilVerdict: utilCheck.verdict,
                        utilNote: utilCheck.note,
                        deonVerdict: deonCheck.verdict,
                        deonNote: deonCheck.note,
                      },
                    })
                  }
                  disabled={loading || !utilCheck.note.trim() || !deonCheck.note.trim()}
                  className="w-full py-4 bg-[#1E293B] text-white font-black rounded-2xl shadow-sm"
                >
                  윤리 검증 결과 제출하기
                </button>
              </div>
            )}
          </div>
        )}

        {/* S6: 광해군 비교 및 최종 리포트 */}
        {(currentStep === 'S6' || currentStep === 'DONE') && (
          <div className="space-y-6">
            {currentStep === 'DONE' ? (
              <div className="bg-white border-2 border-[#0F766E] rounded-3xl p-8 shadow-sm space-y-6">
                <div className="text-center space-y-1.5 border-b border-slate-100 pb-5">
                  <span className="text-xs font-extrabold px-3 py-1 bg-teal-50 text-teal-800 rounded-full">
                    최종 외교 분석 리포트
                  </span>
                  <h2 className="text-2xl font-black text-slate-900">
                    [{groupData?.country?.name}] 대통령의 최종 결과
                  </h2>
                  <p className="text-base font-black text-[#0F766E]">{getDiplomaticTitle()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-xs text-slate-500 font-bold">최종 외교 선택</span>
                    <div className="font-black text-lg text-slate-900">{groupData?.final?.policy}</div>
                    <p className="text-xs text-slate-600">{groupData?.final?.reason}</p>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-xs text-slate-500 font-bold">사전 예측 vs 사후 판정</span>
                    <div className="text-xs text-slate-600">사전: {preTheoryLabel}</div>
                    <div className="flex justify-between text-xs font-bold">
                      <span>공리주의:</span>
                      <span
                        className={
                          groupData?.check?.utilVerdict === '통과' ? 'text-[#0F766E]' : 'text-rose-600'
                        }
                      >
                        {groupData?.check?.utilVerdict} ({groupData?.check?.utilNote})
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span>의무론:</span>
                      <span
                        className={
                          groupData?.check?.deonVerdict === '통과' ? 'text-[#0F766E]' : 'text-rose-600'
                        }
                      >
                        {groupData?.check?.deonVerdict} ({groupData?.check?.deonNote})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-teal-50/70 border border-teal-200 p-5 rounded-2xl space-y-1.5">
                  <h4 className="font-black text-sm text-teal-900">💡 핵심 정리</h4>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    명·후금 사이에서 고민한 <b>광해군</b>처럼, 오늘 여러분의 선택 역시{' '}
                    <b>
                      의무론적 신의를 지키면 공리주의적 피해가 커지고, 공리주의적 실리를 택하면 의무론적 비판을
                      받는 딜레마
                    </b>
                    를 보여주었습니다.
                  </p>
                </div>

                <div className="text-center text-xs text-slate-600 bg-slate-100 p-3.5 rounded-xl font-medium">
                  ✍️ 활동지 마지막 칸에 <b>“국익과 도덕적 의무가 충돌할 때 나의 선택 기준”</b>을 한 문장으로 적어주세요.
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">📜 광해군의 외교 정책과 비교하기</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    명·후금 사이 광해군의 선택과 우리 모둠의 외교적 결정 사이의 공통점과 차이점을 자유롭게 적어보세요.
                  </p>
                </div>

                <textarea
                  rows={4}
                  value={compareText}
                  onChange={(e) => setCompareText(e.target.value)}
                  placeholder="예) 공통점: 강대국 사이에서 실리와 피해를 함께 고민했다. / 차이점: 우리는 인도적 지원 기준을 세워 절충했다."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm"
                />

                <button
                  onClick={() => callSessionApi('SUBMIT_COMPARE', { compare: { summary: compareText } })}
                  disabled={loading || !compareText.trim()}
                  className="w-full py-4 bg-[#0F766E] hover:bg-teal-800 text-white font-black rounded-2xl shadow-sm text-base"
                >
                  비교 제출 및 최종 리포트 보기 🏆
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[#E8EEF3] p-8 text-center font-bold">불러오는 중...</div>}
    >
      <JoinContent />
    </Suspense>
  );
}