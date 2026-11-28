'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { db, ensureAnonAuth } from '@/app/lib/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  POLICIES,
  EMBLEM_COLORS,
  EMBLEM_SHAPES,
  WORLD_ACTORS,
  ROLE_CARDS,
  DEFAULT_SESSION_ID,
  isBlockedCountryName,
} from '@/app/lib/constants';
import SimulationS4 from '@/components/SimulationS4';

const POLICY_STYLES: Record<string, { idle: string; selected: string; tag: string }> = {
  full_support: {
    idle: 'bg-white border-slate-200 hover:border-teal-600',
    selected: 'bg-teal-50/70 border-teal-700 ring-1 ring-teal-700',
    tag: 'text-teal-700',
  },
  non_military: {
    idle: 'bg-white border-slate-200 hover:border-sky-600',
    selected: 'bg-sky-50/70 border-sky-700 ring-1 ring-sky-700',
    tag: 'text-sky-700',
  },
  neutral_mediation: {
    idle: 'bg-white border-slate-200 hover:border-amber-600',
    selected: 'bg-amber-50/70 border-amber-700 ring-1 ring-amber-700',
    tag: 'text-amber-700',
  },
  refuse_trade: {
    idle: 'bg-white border-slate-200 hover:border-indigo-600',
    selected: 'bg-indigo-50/70 border-indigo-700 ring-1 ring-indigo-700',
    tag: 'text-indigo-700',
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

  const [countryName, setCountryName] = useState('');
  const [emblemColor, setEmblemColor] = useState<string>(EMBLEM_COLORS[0]);
  const [emblemShape, setEmblemShape] = useState<string>(EMBLEM_SHAPES[0]);

  const [selectedPolicy, setSelectedPolicy] = useState<string>(POLICIES[0].label);
  const [reason, setReason] = useState('');

  const [rebuttalReply, setRebuttalReply] = useState('');
  const [keepOrRevise, setKeepOrRevise] = useState<'유지' | '수정'>('유지');
  const [finalPolicy, setFinalPolicy] = useState('');
  const [finalReason, setFinalReason] = useState('');
  const [isBlackout, setIsBlackout] = useState(false);

  const [utilVerdict, setUtilVerdict] = useState<'충족' | '미흡'>('충족');
  const [deonVerdict, setDeonVerdict] = useState<'충족' | '미흡'>('미흡');
  const [ethicsNote, setEthicsNote] = useState('');

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
      return setErrorMsg('실제 나라 이름은 사용할 수 없습니다. 가상의 나라 이름을 입력해 주세요.');
    }
    const invalidName = validateStudentInput(countryName);
    if (invalidName) return setErrorMsg(invalidName);

    await callSessionApi('FOUND_COUNTRY', {
      name: countryName,
      intro: '',
      emblem: { color: emblemColor, shape: emblemShape },
    });
  };

  const handleRequestRebuttal = async () => {
    if (reason.trim().length < 10) {
      return setErrorMsg('우리 모둠이 이 선택을 한 이유를 10자 이상 적어 주세요.');
    }
    const invalidMsg = validateStudentInput(reason);
    if (invalidMsg) return setErrorMsg(invalidMsg);

    const inferredTheory =
      selectedPolicy === '전면 지원' || selectedPolicy === '비군사적 지원'
        ? '약속과 생명 중시(의무론)'
        : '국민 생활과 이익 중시(공리주의)';

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
            theory: inferredTheory,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRebuttalReply('');
      setFinalPolicy(selectedPolicy);
      setFinalReason('');
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCounterReply = async () => {
    if (rebuttalReply.trim().length < 10) {
      return setErrorMsg('AI 외교 자문위원의 질문에 대한 답을 10자 이상 적어 주세요.');
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
      return setErrorMsg('최종 결정을 내린 이유를 10자 이상 적어 주세요.');
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

  const rawStep = !groupId ? 'S0' : groupData?.step || 'S1';
  const currentStep = rawStep === 'S2' || rawStep === 'S3' ? 'S2_S3' : rawStep;
  const isCouncilDebate = currentStep === 'S3.5';

  if (isBlackout) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center text-white">
        <span className="font-mono text-xs font-bold px-3 py-1 bg-rose-600 rounded mb-3 tracking-widest animate-pulse">
          LIVE BROADCAST
        </span>
        <p className="text-xl md:text-2xl font-bold tracking-tight">
          [{groupData?.country?.name}] 정부 공식 발표 중...
        </p>
      </div>
    );
  }

  if (currentStep === 'S4' && groupData?.simulation) {
    return (
      <SimulationS4
        countryName={groupData.country?.name || '우리 나라'}
        policy={groupData.final?.policy || ''}
        simulationData={groupData.simulation}
        s4Control={sessionData?.s4Control}
        onComplete={() => callSessionApi('SET_STEP', { step: 'S5' })}
      />
    );
  }

  const getDiplomaticTitle = () => {
    const p = groupData?.final?.policy || '';
    if (p.includes('전면 지원')) return '동맹국과의 약속을 지킨 선택';
    if (p.includes('비군사적')) return '전쟁 참여는 피하고 구호품을 보낸 선택';
    if (p.includes('중립')) return '어느 편도 들지 않고 평화를 중재한 선택';
    return '우리 국민의 난방과 생활을 지킨 선택';
  };

  return (
    <div className="min-h-screen relative bg-[#F1F5F9] text-slate-900 flex flex-col overflow-x-hidden">
      {isCouncilDebate && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 transition-opacity duration-700"
            style={{ backgroundImage: `url('/council.png')` }}
          />
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]" />
        </div>
      )}

      {/* 상단 상황실 헤더 */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-teal-600 text-white rounded tracking-wider">
              NSC SIM
            </span>
            <span className="font-bold text-sm md:text-base tracking-tight">외교 선택 시뮬레이션</span>
            {groupId && groupData?.country && (
              <>
                <span className="text-slate-600">|</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: groupData.country.emblem?.color || '#334155' }}
                  >
                    {groupData.country.emblem?.shape?.split(' ')[0] || '■'}
                  </span>
                  <span className="font-bold text-sm text-teal-300">{groupData.country.name}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">
                    {groupId}모둠
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200">
            {currentStep === 'S0' && 'STEP 00 · 모둠 입장'}
            {currentStep === 'S1' && 'STEP 01 · 나라 정하기'}
            {currentStep === 'S2_S3' && 'STEP 02 · 위기 브리핑'}
            {currentStep === 'S3.5' && 'STEP 03 · 자문위원 토론'}
            {(currentStep === 'S5' || currentStep === 'S5_WAIT') && 'STEP 04 · 결과 평가'}
            {(currentStep === 'S6' || currentStep === 'DONE') && 'STEP 05 · 역사 비교'}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-5 md:p-6">
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border-l-4 border-rose-600 text-rose-900 text-sm font-semibold rounded-r-lg shadow-xs">
            {errorMsg}
          </div>
        )}

        {/* STEP 00: 모둠 선택 */}
        {currentStep === 'S0' && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs space-y-6 mt-4">
            <div className="border-b border-slate-100 pb-5 space-y-1">
              <span className="font-mono text-xs font-bold text-teal-700 tracking-wider">
                HISTORY × SOCIAL ETHICS
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">모둠 회의실 입장</h1>
              <p className="text-sm text-slate-500">배정받은 모둠 번호를 선택하세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((num) => {
                const isOccupied = allGroups[String(num)]?.occupied;
                return (
                  <button
                    key={num}
                    onClick={() => handleJoinGroup(num)}
                    disabled={loading}
                    className={`p-5 rounded-lg border text-left transition ${
                      isOccupied
                        ? 'bg-slate-50 border-slate-200 text-slate-400'
                        : 'bg-white border-slate-300 hover:border-teal-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono text-xs text-slate-400 mb-0.5">TEAM 0{num}</div>
                    <div className="text-xl font-bold text-slate-900">{num}모둠</div>
                    <div className="text-xs mt-1.5 font-semibold text-teal-700">
                      {isOccupied ? '활동 중 (재입장)' : '회의실 입장 ➔'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 01: 나라 정하기 */}
        {currentStep === 'S1' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-2">
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3.5">
                <span className="font-mono text-[11px] font-bold text-teal-700">STEP 01 · NATION SETUP</span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">우리 모둠의 가상 나라 정하기</h2>
                <p className="text-xs text-slate-500 mt-1">실제로 있는 나라 이름은 쓸 수 없습니다. 새로운 나라 이름을 지어 주세요.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">나라 이름 (최대 8자)</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={countryName}
                    onChange={(e) => setCountryName(e.target.value)}
                    placeholder="예: 한울민국, 청솔국"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm font-semibold focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">나라 색깔과 상징</label>
                  <div className="flex gap-2.5 mb-3">
                    {EMBLEM_COLORS.map((c: string) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEmblemColor(c)}
                        className={`w-8 h-8 rounded-md border-2 transition ${
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
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                          emblemShape === s
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
                  className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition disabled:opacity-40"
                >
                  {loading ? '저장하는 중...' : '위기 상황 브리핑 열기 ➔'}
                </button>
              </div>
            </div>

            <div className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-center space-y-3">
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded">
                EMBLEM PREVIEW
              </span>
              <div
                className="w-24 h-24 mx-auto rounded-xl flex items-center justify-center text-5xl text-white shadow-xs"
                style={{ backgroundColor: emblemColor }}
              >
                {emblemShape.split(' ')[0]}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{countryName || '나라 이름 미정'}</h3>
            </div>
          </div>
        )}

        {/* STEP 02: 위기 상황 + 역할 나누기 + 첫 선택 */}
        {currentStep === 'S2_S3' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="relative h-36 bg-slate-900 grid grid-cols-2 overflow-hidden">
                <div
                  className="bg-cover bg-center opacity-50"
                  style={{ backgroundImage: `url('/frendia.jpg')` }}
                />
                <div
                  className="bg-cover bg-center opacity-50"
                  style={{ backgroundImage: `url('/gran.jpg')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/30" />

                <span className="font-mono absolute top-3 left-4 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded tracking-wider">
                  URGENT BRIEFING
                </span>

                <div className="absolute inset-x-0 bottom-3 px-6 flex items-center justify-between text-white">
                  <div>
                    <span className="text-[11px] font-semibold text-teal-300 block">오랜 동맹국</span>
                    <span className="text-lg font-bold">{ALLY_NAME}</span>
                  </div>
                  <span className="px-3 py-1 rounded bg-white/10 text-xs font-bold text-amber-300 border border-white/20">
                    {groupData?.country?.name}의 선택
                  </span>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-indigo-300 block">{CONFLICT_NAME}과 가까운 자원 나라</span>
                    <span className="text-lg font-bold">{TRADE_NAME}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                <h2 className="text-lg md:text-xl font-bold text-slate-900">
                  군사력이 강한 <span className="text-rose-600">{CONFLICT_NAME}</span>이 동맹국{' '}
                  <span className="text-teal-700">{ALLY_NAME}</span>을 공격했습니다.
                </h2>

                <div className="bg-slate-50 border-l-4 border-slate-800 rounded-r-lg p-4 text-xs md:text-sm text-slate-700 leading-relaxed space-y-1.5">
                  <p>
                    • <b>{groupData?.country?.name}과 {ALLY_NAME}의 관계:</b> 과거에 {ALLY_NAME}이 우리 나라를 도와준 적이 있으며, 서로 공격을 받으면 돕기로 약속한 동맹국입니다.
                  </p>
                  <p>
                    • <b>{CONFLICT_NAME}과 {TRADE_NAME}의 관계:</b> {CONFLICT_NAME}과 가까운 자원 강국 <b>{TRADE_NAME}</b>이 “{ALLY_NAME}을 도우면 너희 나라로 보내는 <b>천연가스와 핵심 광물(65%)을 끊겠다</b>”고 압박하고 있습니다.
                  </p>
                </div>

                {/* 역할 나누기 */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-sm font-bold text-slate-900">역할 나누기</span>
                    <span className="font-mono text-[11px] text-slate-400">4 ROLES</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ROLE_CARDS.map((role) => (
                      <div
                        key={role.id}
                        className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
                      >
                        <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                          <img
                            src={role.image}
                            alt={role.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="py-2.5 px-2 text-center font-bold text-sm text-slate-900 border-t border-slate-100">
                          {role.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 첫 선택 카드 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <span className="font-mono text-[11px] font-bold text-teal-700">FIRST DECISION</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  토의 후 [{groupData?.country?.name}]의 첫 번째 선택
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  역할별 의견을 들은 뒤, 네 가지 방법 중 하나를 고르고 이유를 적어 주세요.
                </p>
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
                      className={`p-4 rounded-lg border text-left transition ${
                        isSelected ? style.selected : style.idle
                      }`}
                    >
                      <span className={`text-[11px] font-bold ${style.tag}`}>{p.tag}</span>
                      <div className="font-bold text-base text-slate-900 mt-0.5">{p.label}</div>
                      <p className="text-xs text-slate-600 mt-1">{p.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  이 방법을 선택한 이유 (10자 이상 · 약속과 사람 목숨 vs 난방과 경제 중 무엇을 더 중요하게 보았나요?)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="예: 가스가 끊기면 동네 가게와 가정의 피해가 너무 크므로, 중립을 지키며 피해를 막아야 합니다."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:border-teal-700"
                />
              </div>

              <button
                onClick={handleRequestRebuttal}
                disabled={loading}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition"
              >
                {loading ? 'AI 외교 자문위원이 검토하는 중...' : '선택 제출하고 AI 외교 자문위원 반론 듣기 ➔'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 03: AI 외교 자문위원과 2왕복 토론 */}
        {currentStep === 'S3.5' && groupData?.rebuttal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold tracking-tight">
                  [{groupData?.country?.name}] 긴급 회의실
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-300">
                {groupData.finalRebuttal ? 'ROUND 02 / 02' : 'ROUND 01 / 02'}
              </span>
            </div>

            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-6 md:p-7 shadow-xl space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-mono text-[11px] font-bold text-slate-500">INITIAL CHOICE</span>
                <div className="font-bold text-base text-slate-900 mt-0.5">{groupData.draft?.policy}</div>
                <p className="text-xs text-slate-600 mt-0.5">“{groupData.draft?.reason}”</p>
              </div>

              <div className="p-5 bg-amber-50/80 border-l-4 border-amber-500 rounded-r-lg space-y-2.5">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-amber-500 text-white rounded">
                  ADVISOR BRIEF 01
                </span>
                <p className="text-base font-semibold text-slate-900 leading-relaxed">{groupData.rebuttal.rebuttal}</p>
                <div className="p-3.5 bg-white rounded-lg border border-amber-200">
                  <span className="text-xs font-bold text-rose-700">질문 1</span>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{groupData.rebuttal.question}</p>
                </div>
              </div>

              {!groupData.finalRebuttal ? (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      우리 모둠의 답변 적기 (네 가지 역할을 맡은 모둠원과 상의해 답해 보세요)
                    </label>
                    <textarea
                      rows={2}
                      value={rebuttalReply}
                      onChange={(e) => setRebuttalReply(e.target.value)}
                      placeholder="예: 당장 에너지 부족은 비축 물량과 절약으로 버티고, 동맹국과의 약속을 지켜 다른 나라들의 믿음을 얻는 것이 더 중요합니다."
                      className="w-full bg-white border border-slate-300 rounded-lg p-3.5 text-sm focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <button
                    onClick={handleSendCounterReply}
                    disabled={loading}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition text-sm"
                  >
                    {loading ? 'AI 외교 자문위원이 답변을 읽는 중...' : '답변 보내고 마지막 반론 듣기 ➔'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-lg ml-4 sm:ml-10 space-y-1">
                    <span className="text-xs font-bold text-teal-800">
                      [{groupData?.country?.name}] 모둠의 답변
                    </span>
                    <p className="text-sm font-semibold text-slate-800">“{groupData.rebuttalReply}”</p>
                  </div>

                  <div className="p-5 bg-rose-50/80 border-l-4 border-rose-600 rounded-r-lg space-y-2.5">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-rose-600 text-white rounded">
                      ADVISOR BRIEF 02
                    </span>
                    <p className="text-base font-semibold text-slate-900 leading-relaxed">
                      {groupData.finalRebuttal.rebuttal}
                    </p>
                    <div className="p-3.5 bg-white rounded-lg border border-rose-200">
                      <span className="text-xs font-bold text-rose-700">마지막 질문</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{groupData.finalRebuttal.question}</p>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-300 rounded-lg space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">우리 모둠의 최종 결정</h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        AI 자문위원의 반론을 들은 뒤에도 처음 선택을 유지할지, 바꿀지 정해 주세요.
                      </p>
                    </div>

                    <div className="flex gap-2.5">
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
                          className={`flex-1 py-3 rounded-lg border font-bold text-sm transition ${
                            keepOrRevise === opt
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          처음 선택 {opt} ({groupData.draft?.policy})
                        </button>
                      ))}
                    </div>

                    {keepOrRevise === '수정' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">바꿀 선택 고르기</label>
                        <select
                          value={finalPolicy}
                          onChange={(e) => setFinalPolicy(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-white font-bold"
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
                        최종 결정을 내린 이유 한 줄 (10자 이상 · 뉴스 특보에 반영됩니다)
                      </label>
                      <textarea
                        rows={2}
                        value={finalReason}
                        onChange={(e) => setFinalReason(e.target.value)}
                        placeholder="AI 자문위원의 지적을 생각한 뒤 우리 모둠이 내린 최종 이유를 적어 주세요."
                        className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-white"
                      />
                    </div>

                    <button
                      onClick={handleRunSimulation}
                      disabled={loading}
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition text-sm"
                    >
                      {loading ? '뉴스 특보를 만드는 중...' : '최종 결정 발표하고 뉴스 결과 보기 ➔'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 04: 결과 평가하기 */}
        {(currentStep === 'S5' || currentStep === 'S5_WAIT') && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-7 shadow-xs space-y-6">
            <div className="bg-slate-900 text-white rounded-lg p-5 space-y-1.5">
              <span className="font-mono text-[11px] font-bold text-amber-300 tracking-wider">
                ETHICAL EVALUATION
              </span>
              <h2 className="text-lg md:text-xl font-bold">
                [{groupData?.country?.name}]의 “{groupData?.final?.policy}”, 스스로 평가해 봅시다
              </h2>
              <p className="text-xs text-slate-300">
                방금 뉴스에서 본 떡국·미역국·우리 나라 시민들의 반응을 떠올리며 두 가지 기준으로 평가해 보세요.
              </p>
            </div>

            {currentStep === 'S5_WAIT' ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">우리 모둠의 평가가 제출되었습니다</h3>
                <div className="flex flex-wrap justify-center gap-3 text-sm">
                  <span className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-semibold">
                    1. 결과와 이익 기준(공리주의):{' '}
                    <b
                      className={
                        groupData?.check?.utilVerdict === '충족' || groupData?.check?.utilVerdict === '통과'
                          ? 'text-teal-700'
                          : 'text-rose-600'
                      }
                    >
                      {groupData?.check?.utilVerdict}
                    </b>
                  </span>
                  <span className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-semibold">
                    2. 약속과 의무 기준(의무론):{' '}
                    <b
                      className={
                        groupData?.check?.deonVerdict === '충족' || groupData?.check?.deonVerdict === '통과'
                          ? 'text-teal-700'
                          : 'text-rose-600'
                      }
                    >
                      {groupData?.check?.deonVerdict}
                    </b>
                  </span>
                </div>
                {sessionData?.presenterGroup === groupId && (
                  <div className="p-3 bg-amber-50 border border-amber-400 rounded-lg font-bold text-amber-900 text-sm">
                    우리 모둠이 발표 모둠으로 선정되었습니다.
                  </div>
                )}
                <button
                  onClick={() => callSessionApi('SET_STEP', { step: 'S6' })}
                  className="px-8 py-3.5 bg-slate-900 text-white text-sm font-bold rounded-lg"
                >
                  마지막 단계: 광해군의 외교와 비교하기 ➔
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-700">기준 1 · 결과와 이익 (공리주의)</span>
                      <h3 className="font-bold text-base text-slate-900 mt-0.5">
                        우리 국민과 사회 전체의 이익이 피해보다 컸나요?
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      {(['충족', '미흡'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setUtilVerdict(v)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition ${
                            utilVerdict === v
                              ? v === '충족'
                                ? 'bg-teal-700 text-white border-teal-700'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {v === '충족' ? '이익을 지켰다 (충족)' : '피해가 더 컸다 (미흡)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-teal-700">기준 2 · 약속과 의무 (의무론)</span>
                      <h3 className="font-bold text-base text-slate-900 mt-0.5">
                        손해를 떠나 동맹 약속과 생명을 지키는 옳은 행동이었나요?
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      {(['충족', '미흡'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDeonVerdict(v)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition ${
                            deonVerdict === v
                              ? v === '충족'
                                ? 'bg-teal-700 text-white border-teal-700'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {v === '충족' ? '약속과 의무를 지켰다 (충족)' : '약속을 어겼다 (미흡)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    뉴스 결과를 보고 느낀 점 한 줄 정리
                  </label>
                  <input
                    type="text"
                    value={ethicsNote}
                    onChange={(e) => setEthicsNote(e.target.value)}
                    placeholder="예: 가스 공급과 국민 생활(공리주의)은 지켰지만, 위기에 처한 동맹과의 약속(의무론)을 지키지 못한 점이 아쉽다."
                    className="w-full border border-slate-300 rounded-lg p-3.5 text-sm bg-slate-50"
                  />
                </div>

                <button
                  onClick={() =>
                    callSessionApi('SUBMIT_CHECK', {
                      check: {
                        utilVerdict,
                        utilNote: ethicsNote,
                        deonVerdict,
                        deonNote: ethicsNote,
                      },
                    })
                  }
                  disabled={loading || ethicsNote.trim().length < 8}
                  className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-lg disabled:opacity-40"
                >
                  우리 모둠 평가 제출하기 ➔
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 05: 광해군과 비교하기 & 최종 기록 */}
        {(currentStep === 'S6' || currentStep === 'DONE') && (
          <div className="space-y-5">
            {currentStep === 'DONE' ? (
              <div className="bg-white border-t-4 border-teal-700 border-x border-b border-slate-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-5 space-y-1">
                  <span className="font-mono text-xs font-bold text-teal-700">
                    FINAL REPORT · {groupId}모둠 [{groupData?.country?.name}]
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{getDiplomaticTitle()}</h2>
                  <p className="text-xs text-slate-500">
                    첫 선택: <b>{groupData?.draft?.policy}</b> → 최종 선택: <b>{groupData?.final?.policy}</b>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                  <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-2">
                    <span className="font-mono text-[11px] text-slate-500 font-bold">FINAL REASON</span>
                    <p className="font-semibold text-slate-800 leading-relaxed">“{groupData?.final?.reason}”</p>
                    <div className="pt-2 flex gap-2 text-xs font-bold">
                      <span className="px-2.5 py-1 rounded bg-white border border-slate-200">
                        공리주의: {groupData?.check?.utilVerdict}
                      </span>
                      <span className="px-2.5 py-1 rounded bg-white border border-slate-200">
                        의무론: {groupData?.check?.deonVerdict}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50/60 p-5 rounded-lg border border-amber-200 space-y-2">
                    <span className="font-mono text-[11px] text-amber-800 font-bold">HISTORICAL COMPARISON</span>
                    <p className="text-slate-800 font-medium leading-relaxed">{groupData?.compare?.summary}</p>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-lg space-y-3">
                  <span className="font-mono text-[11px] font-bold text-teal-300 tracking-wider">
                    CIVIC REFLECTION
                  </span>
                  <p className="text-sm md:text-base font-semibold leading-relaxed text-slate-100">
                    조선 시대에는 왕(광해군) 혼자 외교 결정을 내렸지만, 오늘날 민주주의 사회에서는{' '}
                    <span className="text-amber-300">국민(시민)</span>이 정부의 외교 방향에 목소리를 내고 그 결과도 함께 감당합니다.
                  </p>
                  <div className="p-4 rounded bg-white/5 border border-white/15 text-xs md:text-sm text-slate-200 leading-relaxed">
                    <b>[활동지 마지막 질문]</b><br />
                    오늘 맡았던 역할(대통령·기업가·소상공인·구호단체)을 떠올리며,{' '}
                    <b>
                      “실제 우리 나라의 시민인 나라면 정부에 어떤 기준을 우선하라고 요구할지, 그리고 그로 인한 불편이나 피해(물가 상승 또는 국제 비판)까지 감수할 수 있는지”
                    </b>{' '}
                    활동지 마지막 칸에 적어 주세요.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-xs space-y-5">
                <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-lg p-5 space-y-2">
                  <span className="font-mono text-[11px] font-bold text-amber-800">HISTORICAL CONNECTION</span>
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">
                    400년 전 광해군도 오늘 여러분과 똑같은 고민을 했습니다.
                  </h2>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    임진왜란 때 도와준 <b>명나라에 대한 의리(약속)</b>와, 힘이 강해진{' '}
                    <b>후금과의 전쟁을 피해 백성을 살리는 길(실리)</b> 사이에서 고민했던 광해군의 외교와, 방금{' '}
                    <b>[{groupData?.country?.name}]</b>이 내린 <b>“{groupData?.final?.policy}”</b> 선택은 어떤 점이 비슷하고 어떤 점이 다른가요?
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    광해군의 외교와 우리 모둠 선택의 공통점 · 차이점 한 줄 (학급 전체 화면에 함께 보입니다)
                  </label>
                  <textarea
                    rows={3}
                    value={compareText}
                    onChange={(e) => setCompareText(e.target.value)}
                    placeholder="예) 공통점: 강대국 사이에서 의리와 백성의 생활이 부딪혔다. / 차이점: 우리는 왕 혼자 결정하지 않고 소상공인·기업가·구호단체 등 여러 입장을 함께 따져 결정했다."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3.5 text-sm focus:outline-none focus:border-teal-700"
                  />
                </div>

                <button
                  onClick={() => callSessionApi('SUBMIT_COMPARE', { compare: { summary: compareText } })}
                  disabled={loading || compareText.trim().length < 10}
                  className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-sm disabled:opacity-40"
                >
                  비교 제출하고 최종 결과 보기 ➔
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
      fallback={<div className="min-h-screen bg-[#F1F5F9] p-8 text-center font-semibold">불러오는 중...</div>}
    >
      <JoinContent />
    </Suspense>
  );
}