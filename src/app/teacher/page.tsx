'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db, ensureAnonAuth } from '@/app/lib/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  DEFAULT_SESSION_ID,
  FALLBACK_REBUTTALS,
  FALLBACK_SIMULATIONS,
  ROLE_CARDS,
  WORLD_ACTORS,
} from '@/app/lib/constants';

const ALLY_NAME = WORLD_ACTORS.ally.name;
const TRADE_NAME = WORLD_ACTORS.trade.name;
const CONFLICT_NAME = WORLD_ACTORS.conflict.name;

export default function TeacherPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionCode, setSessionCode] = useState(DEFAULT_SESSION_ID);
  const [sessionData, setSessionData] = useState<any>(null);
  const [groups, setGroups] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showLargeQR, setShowLargeQR] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [originUrl, setOriginUrl] = useState('');

  // 교사 전용 타이머
  const [timerSec, setTimerSec] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(5);

  useEffect(() => {
    if (typeof window !== 'undefined') setOriginUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.frequency.value = 880;
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          } catch (e) {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!sessionCode || !isAuthenticated) return;
    let unsubSession: any;
    const unsubGroups: any[] = [];

    ensureAnonAuth().then(() => {
      unsubSession = onSnapshot(doc(db, 'sessions', sessionCode), (snap) => {
        if (snap.exists()) setSessionData(snap.data());
      });

      for (let g = 1; g <= 4; g++) {
        const u = onSnapshot(doc(db, `sessions/${sessionCode}/groups/${g}`), (snap) => {
          if (snap.exists()) setGroups((prev) => ({ ...prev, [String(g)]: snap.data() }));
        });
        unsubGroups.push(u);
      }
    });

    return () => {
      if (unsubSession) unsubSession();
      unsubGroups.forEach((u) => u());
    };
  }, [sessionCode, isAuthenticated]);

  const handleCreateSession = async () => {
    if (!passcode.trim()) return setErrorMsg('교사 비밀번호를 입력해 주세요.');
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_SESSION', payload: { passcode } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionCode(data.code || DEFAULT_SESSION_ID);
      setIsAuthenticated(true);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const teacherUpdate = async (
    sessionUpdates: any = null,
    targetGroupId: number | null = null,
    groupUpdates: any = null
  ) => {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEACHER_UPDATE',
          code: sessionCode,
          payload: { passcode, sessionUpdates, targetGroupId, groupUpdates },
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetClass = async () => {
    const ok = confirm(
      '기존 학생들의 활동 데이터와 모둠 진행 기록이 초기화됩니다. 새 수업을 시작할까요?'
    );
    if (!ok) return;

    setLoading(true);
    try {
      await teacherUpdate({ presenterGroup: null });

      for (let num = 1; num <= 4; num++) {
        await teacherUpdate(null, num, {
          step: 'S1',
          occupied: false,
          country: null,
          draft: null,
          rebuttal: null,
          rebuttalReply: '',
          finalRebuttal: null,
          final: null,
          simulation: null,
          check: null,
          compare: null,
        });
      }
      alert('새 수업으로 초기화되었습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDemoData = async () => {
    setLoading(true);
    const demoPresets = [
      {
        id: 1,
        name: '청솔국',
        color: '#1E293B',
        shape: '🛡️ 방패',
        policy: '전면 지원',
        reason: `방위조약에 따라 동맹국 ${ALLY_NAME}을 돕는 것이 국가의 도덕적 책무입니다.`,
        utilVerdict: '미흡',
        deonVerdict: '충족',
        ethicsNote: `${TRADE_NAME}의 가스 차단으로 민생 피해는 컸지만, 동맹국 ${ALLY_NAME}과의 약속을 지켰습니다.`,
        compareSummary: `공통점: 강대국 사이에서 명분과 실리가 충돌했습니다. 차이점: 대통령·기업가·소상공인·구호단체가 함께 숙의해 결정했습니다.`,
      },
      {
        id: 2,
        name: '한울민국',
        color: '#0F766E',
        shape: '🕊️ 비둘기',
        policy: '중립과 평화 중재',
        reason: `천연가스 공급을 유지하면서 휴전 협상을 중재하는 것이 최선입니다.`,
        utilVerdict: '충족',
        deonVerdict: '미흡',
        ethicsNote: `난방과 민생(공리주의)은 지켰으나, 위기의 ${ALLY_NAME}과의 약속(의무론)을 다하지 못했습니다.`,
        compareSummary: `공통점: 강대국 사이에서 충돌과 피해를 피하려 고민했습니다. 차이점: 오늘날은 에너지 무역과 여론의 영향이 큽니다.`,
      },
      {
        id: 3,
        name: '가온국',
        color: '#D97706',
        shape: '⚖️ 천칭',
        policy: '비군사적 지원',
        reason: `군사 개입은 피하되 피해 민간인을 인도적으로 돕는 것이 옳습니다.`,
        utilVerdict: '충족',
        deonVerdict: '충족',
        ethicsNote: `전면전을 피하면서 구호단체의 목소리를 반영해 민간인 생명을 지켰습니다.`,
        compareSummary: `공통점: 위기 속에서 백성의 삶을 고민했습니다. 차이점: 국제 인도주의 규범과 다양한 사회 계층의 목소리를 반영했습니다.`,
      },
      {
        id: 4,
        name: '다솜국',
        color: '#4F46E5',
        shape: '🧭 나침반',
        policy: '지원 거부와 교역 유지',
        reason: `타국의 분쟁에 개입해 ${TRADE_NAME}과의 교역 및 우리 국민의 에너지를 위협할 수 없습니다.`,
        utilVerdict: '충족',
        deonVerdict: '미흡',
        ethicsNote: `소상공인과 산업의 생존은 지켰지만, 동맹국 ${ALLY_NAME}을 외면해 국제 신뢰를 잃었습니다.`,
        compareSummary: `공통점: 지도자의 선택이 백성의 생계와 직결됩니다. 차이점: 민주주의 시민 사회에서 정부의 실리 외교에 대한 비판도 함께 제기됩니다.`,
      },
    ];

    for (const d of demoPresets) {
      const sim = FALLBACK_SIMULATIONS[d.policy];
      const reb = FALLBACK_REBUTTALS[d.policy];
      await teacherUpdate(null, d.id, {
        occupied: true,
        step: 'DONE',
        country: { name: d.name, intro: '', emblem: { color: d.color, shape: d.shape } },
        draft: { policy: d.policy, reason: d.reason },
        rebuttal: reb,
        rebuttalReply: '네 가지 역할 입장을 모두 고려해 우리 사회가 감당할 수 있는 최선의 결정을 내렸습니다.',
        final: { policy: d.policy, reason: d.reason, keepOrRevise: '유지' },
        simulation: sim,
        check: {
          utilVerdict: d.utilVerdict,
          utilNote: d.ethicsNote,
          deonVerdict: d.deonVerdict,
          deonNote: d.ethicsNote,
        },
        compare: { summary: d.compareSummary },
      });
    }
    setLoading(false);
    alert('실연용 4개 모둠 데이터가 모두 준비되었습니다.');
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isPositiveVerdict = (v?: string) => v === '충족' || v === '통과';
  const joinUrl = `${originUrl}/join`;
  const presenterGroupNum = sessionData?.presenterGroup;
  const presenterData = presenterGroupNum ? groups[String(presenterGroupNum)] : null;

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#E8EEF3] flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-lg space-y-6">
          <div className="text-center space-y-1.5">
            <span className="text-xs font-extrabold px-3 py-1 bg-teal-50 text-teal-800 rounded-full">
              한국사 × 현대 사회와 윤리
            </span>
            <h1 className="text-2xl font-black">교사 통제실 입장</h1>
          </div>
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg">{errorMsg}</div>
          )}
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
            placeholder="교사 비밀번호 입력"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-center font-black tracking-widest"
          />
          <button
            onClick={handleCreateSession}
            disabled={loading}
            className="w-full py-4 bg-[#1E293B] text-white font-black rounded-xl shadow"
          >
            {loading ? '통제실 여는 중...' : '🚀 수업 통제실 열기'}
          </button>
        </div>
      </main>
    );
  }

  if (presenterGroupNum && presenterData) {
    return (
      <div className="min-h-screen bg-[#E8EEF3] text-slate-900 p-8 flex flex-col justify-center">
        <div className="max-w-5xl mx-auto w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-lg space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="bg-[#0F766E] text-white font-black px-4 py-1.5 rounded-full text-sm">
                발표 모둠: {presenterGroupNum}모둠
              </span>
              <h1 className="text-2xl md:text-3xl font-black">{presenterData.country?.name}</h1>
            </div>
            <button
              onClick={() => teacherUpdate({ presenterGroup: null })}
              className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-bold"
            >
              ✕ 발표 닫기
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
              <span className="text-xs text-[#0F766E] font-extrabold">최종 외교 선택</span>
              <div className="text-2xl font-black text-slate-900">{presenterData.final?.policy}</div>
              <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                {presenterData.final?.reason || '-'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-black text-lg">윤리 평가 및 광해군 비교</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-xl border border-indigo-200 flex justify-between items-center font-black text-sm">
                  <span className="text-indigo-900">공리주의</span>
                  <span
                    className={
                      isPositiveVerdict(presenterData.check?.utilVerdict) ? 'text-[#0F766E]' : 'text-rose-600'
                    }
                  >
                    {presenterData.check?.utilVerdict || '-'}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-teal-200 flex justify-between items-center font-black text-sm">
                  <span className="text-teal-900">의무론</span>
                  <span
                    className={
                      isPositiveVerdict(presenterData.check?.deonVerdict) ? 'text-[#0F766E]' : 'text-rose-600'
                    }
                  >
                    {presenterData.check?.deonVerdict || '-'}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed">
                {presenterData.check?.utilNote || '-'}
              </div>
              {presenterData.compare?.summary && (
                <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 text-sm text-slate-800 leading-relaxed">
                  <span className="block text-xs font-black text-amber-800 mb-1">광해군 비교</span>
                  {presenterData.compare.summary}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8EEF3] text-[#1E293B]">
      {/* 상단 제어 바 */}
      <header className="bg-[#1E293B] text-white px-6 py-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-black mr-1">외교 선택 시뮬레이터 · 교사 화면</h1>
            <button
              onClick={() => setShowLargeQR(true)}
              className="bg-[#0F766E] hover:bg-teal-600 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs"
            >
              📱 학생 입장 QR
            </button>
            <button
              onClick={() => setShowBriefingModal(true)}
              className="bg-rose-600 hover:bg-rose-500 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs"
            >
              🚨 상황 · 역할 화면 보기
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSeedDemoData}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow"
            >
              ⚡ 실연용 데이터 채우기
            </button>
            <button
              onClick={handleResetClass}
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow"
            >
              🔄 새 수업 초기화
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 직관적인 대형 수업 타이머 배너 */}
        <section className="bg-slate-900 text-white rounded-3xl px-6 py-5 shadow-md border border-slate-700 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-black px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
              ⏱️ 수업 타이머
            </span>
            <div
              className={`font-mono text-4xl sm:text-5xl font-black tracking-wider ${
                timerSec <= 30 && timerRunning ? 'text-rose-400 animate-pulse' : 'text-amber-300'
              }`}
            >
              {formatTime(timerSec)}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {[3, 5, 10].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setTimerRunning(false);
                  setCustomMinutes(m);
                  setTimerSec(m * 60);
                }}
                className={`px-4 py-2.5 rounded-xl text-sm font-black transition ${
                  customMinutes === m && timerSec === m * 60 && !timerRunning
                    ? 'bg-white/25 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200'
                }`}
              >
                {m}분
              </button>
            ))}
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className={`px-6 py-2.5 rounded-xl text-sm font-black shadow transition ${
                timerRunning ? 'bg-amber-400 text-slate-950' : 'bg-[#0F766E] hover:bg-teal-600 text-white'
              }`}
            >
              {timerRunning ? '⏸ 일시정지' : '▶ 시작'}
            </button>
            <button
              onClick={() => {
                setTimerRunning(false);
                setTimerSec(customMinutes * 60);
              }}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-black text-slate-200"
            >
              ↺ 초기화
            </button>
          </div>
        </section>

        {/* 실시간 모둠 현황 (접속 확인 + 결과 취합 + 발표 띄우기) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">실시간 모둠 현황</h2>
            <span className="text-xs font-bold text-slate-500">
              접속 {Object.values(groups).filter((g) => g?.occupied).length} / 4모둠
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((num) => {
              const g = groups[String(num)] || {};
              return (
                <div
                  key={num}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-lg text-slate-900">{num}모둠</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          g.occupied ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {g.occupied ? `접속 · ${g.step || 'S1'}` : '미접속'}
                      </span>
                    </div>

                    <div className="text-base font-black text-[#0F766E]">
                      {g.country?.name || '나라 미정'}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                      <div>
                        첫 선택: <b>{g.draft?.policy || '-'}</b>
                      </div>
                      <div>
                        최종 선택: <b className="text-slate-900">{g.final?.policy || '-'}</b>
                      </div>
                      {g.check && (
                        <div className="pt-1 border-t border-slate-200/80 flex flex-wrap gap-1.5 font-bold">
                          <span
                            className={
                              isPositiveVerdict(g.check.utilVerdict) ? 'text-[#0F766E]' : 'text-rose-600'
                            }
                          >
                            공리주의 {g.check.utilVerdict}
                          </span>
                          <span>·</span>
                          <span
                            className={
                              isPositiveVerdict(g.check.deonVerdict) ? 'text-[#0F766E]' : 'text-rose-600'
                            }
                          >
                            의무론 {g.check.deonVerdict}
                          </span>
                        </div>
                      )}
                    </div>

                    {g.compare?.summary && (
                      <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-slate-700 leading-relaxed line-clamp-3">
                        <span className="font-black text-amber-900">광해군 비교: </span>
                        {g.compare.summary}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex gap-1.5">
                    <button
                      onClick={() => teacherUpdate({ presenterGroup: num })}
                      className="flex-1 py-2 bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                    >
                      🎤 발표 띄우기
                    </button>
                    <button
                      onClick={() =>
                        teacherUpdate(null, num, {
                          step: 'S1',
                          occupied: false,
                          country: null,
                          draft: null,
                          rebuttal: null,
                          rebuttalReply: '',
                          finalRebuttal: null,
                          final: null,
                          simulation: null,
                          check: null,
                          compare: null,
                        })
                      }
                      className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg"
                    >
                      초기화
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* QR 코드 크게 보기 모달 */}
      {showLargeQR && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setShowLargeQR(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black text-slate-900">모둠 기기 QR 코드 입장</h2>
            <p className="text-xs text-slate-500">스마트폰이나 태블릿으로 스캔하면 모둠 선택 화면으로 바로 이동합니다.</p>
            <div className="flex justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={240} />
            </div>
            <button
              onClick={() => setShowLargeQR(false)}
              className="w-full py-3 bg-[#1E293B] text-white font-bold rounded-xl"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 학생 화면과 동일한 상황 · 역할 나누기 화면 모달 */}
      {showBriefingModal && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          onClick={() => setShowBriefingModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-36 bg-slate-900 grid grid-cols-2 overflow-hidden">
              <div
                className="bg-cover bg-center opacity-55"
                style={{ backgroundImage: `url('/frendia.jpg')` }}
              />
              <div
                className="bg-cover bg-center opacity-55"
                style={{ backgroundImage: `url('/gran.jpg')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/30" />

              <span className="absolute top-3.5 left-4 bg-rose-600 text-white text-xs font-black px-3 py-1 rounded-full shadow">
                🚨 긴급 상황
              </span>

              <button
                onClick={() => setShowBriefingModal(false)}
                className="absolute top-3.5 right-4 bg-white/20 hover:bg-white/30 text-white text-xs font-black px-3.5 py-1.5 rounded-full backdrop-blur-xs"
              >
                ✕ 화면 닫기
              </button>

              <div className="absolute inset-x-0 bottom-3.5 px-6 flex items-center justify-between text-white">
                <div>
                  <span className="text-[11px] font-bold text-teal-300 block">오랜 동맹국</span>
                  <span className="text-lg font-black">{ALLY_NAME}</span>
                </div>
                <span className="px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-black text-amber-300 border border-white/20">
                  우리 나라의 선택
                </span>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-indigo-300 block">
                    {CONFLICT_NAME}과 가까운 자원 나라
                  </span>
                  <span className="text-lg font-black">{TRADE_NAME}</span>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-7 space-y-5">
              <h2 className="text-lg md:text-xl font-black text-slate-900 text-center">
                군사력이 강한 <span className="text-rose-600">{CONFLICT_NAME}</span>이 동맹국{' '}
                <span className="text-[#0F766E]">{ALLY_NAME}</span>을 공격했습니다!
              </h2>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs md:text-sm text-slate-700 leading-relaxed space-y-1.5">
                <p>
                  • <b>우리 나라와 {ALLY_NAME}의 관계:</b> 과거에 {ALLY_NAME}이 우리 나라를 도와준 적이 있으며, 서로 공격을 받으면 돕기로 약속한 동맹국입니다.
                </p>
                <p>
                  • <b>{CONFLICT_NAME}과 {TRADE_NAME}의 관계:</b> {CONFLICT_NAME}과 가까운 자원 강국 <b>{TRADE_NAME}</b>이 “{ALLY_NAME}을 도우면 너희 나라로 보내는 <b>천연가스와 핵심 광물(65%)을 끊겠다</b>”고 압박하고 있습니다.
                </p>
              </div>

              {/* 학생 화면과 동일한 역할 나누기 4장 이미지 카드 */}
              <div className="space-y-2.5 pt-1">
                <span className="block text-sm font-black text-slate-900">역할 나누기</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ROLE_CARDS.map((role) => (
                    <div
                      key={role.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
                    >
                      <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                        <img
                          src={role.image}
                          alt={role.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="py-2.5 px-2 text-center font-black text-sm text-slate-900">
                        {role.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowBriefingModal(false)}
                className="w-full py-3.5 bg-[#1E293B] hover:bg-slate-800 text-white font-black rounded-2xl transition shadow-sm text-sm"
              >
                교사 화면으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}