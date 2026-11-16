'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db, ensureAnonAuth } from '@/app/lib/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';
import { FALLBACK_REBUTTALS, FALLBACK_SIMULATIONS } from '@/app/lib/constants';

export default function TeacherPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [groups, setGroups] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showLargeQR, setShowLargeQR] = useState(false);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'VERDICTS' | 'LOGS' | 'COMPARE'>('DASHBOARD');
  const [originUrl, setOriginUrl] = useState('');

  // 교사 전용 독립 타이머
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
    let unsubGroups: any[] = [];

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
      setSessionCode(data.code);
      setIsAuthenticated(true);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const teacherUpdate = async (sessionUpdates: any = null, targetGroupId: number | null = null, groupUpdates: any = null) => {
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

  const handleSeedDemoData = async () => {
    setLoading(true);
    const demoPresets = [
      {
        id: 1,
        name: '마르디아',
        intro: '조약과 신의를 지키는 나라',
        color: '#1E293B',
        shape: '🛡️ 방패',
        policy: '전면 지원',
        reason: '방위조약에 따라 동맹국 프렌디아를 돕는 것이 국가의 도덕적 책무입니다.',
        utilVerdict: '부적합',
        utilNote: '그랜의 가스 차단으로 국민 난방과 산업 피해가 큼',
        deonVerdict: '통과',
        deonNote: '경제적 손실을 감수하고 동맹과의 조약을 지켰음',
        compare: {
          same: '강대국 사이에서 기존 동맹의 명분과 자국민의 생존 실리가 충돌함',
          diff1: '군신 사대 관계에서 국제법과 상호방위조약 중심으로 변화함',
          diff2: '국제기구와 전 세계 실시간 언론의 감시를 받게 됨',
          diff3: '소수 신하들의 논쟁에서 전체 국민의 에너지·경제 문제로 확대됨',
        }
      },
      {
        id: 2,
        name: '한울민국',
        intro: '실리와 평화의 균형을 추구하는 나라',
        color: '#0F766E',
        shape: '🕊️ 비둘기',
        policy: '중립과 평화 중재',
        reason: '천연가스 공급을 유지하면서 휴전 협상을 중재하는 것이 최선입니다.',
        utilVerdict: '통과',
        utilNote: '에너지 대란을 막고 국민의 민생을 보호함',
        deonVerdict: '부적합',
        deonNote: '침공당한 동맹국과의 방위조약 의무를 이행하지 않음',
        compare: {
          same: '어느 한쪽을 택할 경우 다른 한쪽으로부터 큰 보복이나 신뢰 상실을 겪음',
          diff1: '명문화된 현대 국제 조약의 법적 구속력이 훨씬 강해짐',
          diff2: '국제기구를 통한 평화 중재 외교의 공간이 넓어짐',
          diff3: '대외 무역과 에너지 의존도가 높아 국민 생활에 즉각 영향을 줌',
        }
      },
      {
        id: 3,
        name: '솔라리스',
        intro: '생명 존중과 인도주의를 지향하는 나라',
        color: '#D97706',
        shape: '⚖️ 천칭',
        policy: '비군사적 지원',
        reason: '군사 개입은 피하되 피해 민간인을 인도적으로 돕는 것이 옳습니다.',
        utilVerdict: '통과',
        utilNote: '전면전 휘말림을 피하면서 민간인 생명을 구함',
        deonVerdict: '통과',
        deonNote: '살상 무기 지원을 배제하고 인도주의 원칙을 지킴',
        compare: {
          same: '약소국·중견국 지도자로서 외교적 줄타기의 고뇌를 겪음',
          diff1: '전시 인도법과 제네바 협약 등 민간인 보호 규범이 확립됨',
          diff2: '국제구호기구 및 글로벌 시민 사회의 여론이 중요해짐',
          diff3: '국민들이 실시간 뉴스를 통해 외교 결정을 평가하고 투표로 심판함',
        }
      },
      {
        id: 4,
        name: '노르드아크',
        intro: '자국민의 민생을 우선하는 나라',
        color: '#4F46E5',
        shape: '🧭 나침반',
        policy: '지원 거부와 교역 유지',
        reason: '타국의 분쟁에 개입해 우리 국민의 에너지와 일자리를 위협할 수 없습니다.',
        utilVerdict: '통과',
        utilNote: '천연가스 장기 공급 확보로 자국민 경제 이익 극대화',
        deonVerdict: '부적합',
        deonNote: '자국의 이익만을 위해 동맹국의 위기를 외면함',
        compare: {
          same: '왕(대통령)의 외교적 결단이 나라의 존망과 백성의 삶에 직결됨',
          diff1: '조약 파기 시 외교적·경제적 제재 시스템이 체계화됨',
          diff2: '강대국 중심 질서 속에서도 중견국의 선택권이 다양해짐',
          diff3: '에너지 안보가 국가 경제와 직결되는 현대 산업 사회의 특성이 나타남',
        }
      },
    ];

    for (const d of demoPresets) {
      const sim = FALLBACK_SIMULATIONS[d.policy];
      const reb = FALLBACK_REBUTTALS[d.policy];
      await teacherUpdate(null, d.id, {
        occupied: true,
        step: 'DONE',
        country: { name: d.name, intro: d.intro, emblem: { color: d.color, shape: d.shape } },
        draft: { policy: d.policy, reason: d.reason, theory: '양 관점 검토' },
        rebuttal: reb,
        rebuttalReply: '우리 국가가 중시하는 핵심 가치를 지키기 위해 기존 결정을 유지하겠습니다.',
        final: { policy: d.policy, reason: d.reason, keepOrRevise: '유지' },
        simulation: sim,
        check: {
          utilVerdict: d.utilVerdict,
          utilNote: d.utilNote,
          deonVerdict: d.deonVerdict,
          deonNote: d.deonNote,
        },
        compare: d.compare,
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

  const joinUrl = `${originUrl}/join?code=${sessionCode}`;
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
          {errorMsg && <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg">{errorMsg}</div>}
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
            placeholder="교사 비밀번호 (1234)"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-center font-black tracking-widest"
          />
          <button onClick={handleCreateSession} disabled={loading} className="w-full py-4 bg-[#1E293B] text-white font-black rounded-xl shadow">
            {loading ? '세션 여는 중...' : '🚀 수업 세션 시작하기'}
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
              <h1 className="text-2xl md:text-3xl font-black">{presenterData.country?.name} 대통령</h1>
            </div>
            <button onClick={() => teacherUpdate({ presenterGroup: null })} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-bold">
              ✕ 발표 닫기
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
              <span className="text-xs text-[#0F766E] font-extrabold">최종 외교 선택</span>
              <div className="text-2xl font-black text-slate-900">{presenterData.final?.policy}</div>
              <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                {presenterData.final?.reason}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-black text-lg">윤리 이론 교차 판정</h3>
              <div className="p-4 bg-white rounded-xl border border-indigo-200 space-y-1">
                <div className="flex justify-between font-black text-sm">
                  <span className="text-indigo-900">1. 공리주의</span>
                  <span className={presenterData.check?.utilVerdict === '통과' ? 'text-[#0F766E]' : 'text-rose-600'}>
                    {presenterData.check?.utilVerdict || '-'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{presenterData.check?.utilNote}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-teal-200 space-y-1">
                <div className="flex justify-between font-black text-sm">
                  <span className="text-teal-900">2. 의무론</span>
                  <span className={presenterData.check?.deonVerdict === '통과' ? 'text-[#0F766E]' : 'text-rose-600'}>
                    {presenterData.check?.deonVerdict || '-'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{presenterData.check?.deonNote}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8EEF3] text-[#1E293B]">
      <header className="bg-[#1E293B] text-white px-6 py-3.5 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black">대통령 외교 시뮬레이터 · 교사 통제실</h1>
            <span className="bg-[#0F766E] text-white font-black px-3 py-1 rounded-lg text-sm tracking-widest">
              코드: {sessionCode}
            </span>
            <button onClick={() => setShowLargeQR(true)} className="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-bold">
              📱 QR 크게 보기
            </button>
          </div>

          {/* 교사 전용 독립 타이머 */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3.5 py-1.5 rounded-xl">
            <span className="text-xs text-slate-400 font-bold">⏱️ 타이머</span>
            <span className={`font-mono text-xl font-black px-2 ${timerSec <= 30 && timerRunning ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>
              {formatTime(timerSec)}
            </span>
            <div className="flex items-center gap-1">
              {[3, 5, 10].map((m) => (
                <button
                  key={m}
                  onClick={() => { setTimerRunning(false); setCustomMinutes(m); setTimerSec(m * 60); }}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold"
                >
                  {m}분
                </button>
              ))}
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className={`px-2.5 py-1 rounded text-xs font-black ${timerRunning ? 'bg-amber-400 text-slate-900' : 'bg-[#0F766E] text-white'}`}
              >
                {timerRunning ? '일시정지' : '시작'}
              </button>
              <button
                onClick={() => { setTimerRunning(false); setTimerSec(customMinutes * 60); }}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-bold"
              >
                초기화
              </button>
            </div>
          </div>

          <button onClick={handleSeedDemoData} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-black shadow">
            ⚡ 실연용 가상 데이터 채우기
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 text-sm font-black">
          {[
            { id: 'DASHBOARD', label: '1. 실시간 모둠 현황' },
            { id: 'VERDICTS', label: '2. 공리주의 × 의무론 판정표' },
            { id: 'LOGS', label: '3. 자문위원 반론 및 논거 로그' },
            { id: 'COMPARE', label: '4. 광해군 비교 공유' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-3.5 border-b-2 ${activeTab === t.id ? 'border-[#0F766E] text-[#0F766E]' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((num) => {
              const g = groups[String(num)] || {};
              return (
                <div key={num} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-lg text-slate-900">{num}모둠</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${g.occupied ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-400'}`}>
                        {g.occupied ? `접속 중 (${g.step})` : '대기 중'}
                      </span>
                    </div>
                    <div className="text-base font-black text-[#0F766E]">{g.country?.name ? `${g.country.name} 대통령` : '미취임'}</div>
                    <div className="p-3 bg-slate-50 rounded-xl text-xs">
                      최종 선택: <b className="text-slate-900">{g.final?.policy || '-'}</b>
                    </div>
                  </div>
                  <div className="pt-3 border-t flex gap-1.5">
                    <button onClick={() => teacherUpdate({ presenterGroup: num })} className="flex-1 py-2 bg-[#1E293B] text-white text-xs font-bold rounded-lg">
                      🎤 발표 띄우기
                    </button>
                    <button
                      onClick={() => teacherUpdate(null, num, { step: 'S1', occupied: false, country: null, draft: null, final: null, check: null, compare: null })}
                      className="px-2.5 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg"
                    >
                      초기화
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'VERDICTS' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-black text-slate-900">📊 모둠별 [공리주의 vs 의무론] 판정 비교</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((num) => {
                const g = groups[String(num)] || {};
                const chk = g.check;
                return (
                  <div key={num} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-base text-slate-900">{num}모둠 ({g.country?.name || '미정'})</span>
                      <span className="text-xs font-bold px-2.5 py-1 bg-white border rounded-full">{g.final?.policy || '미제출'}</span>
                    </div>
                    {chk ? (
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 bg-white rounded-xl border flex justify-between items-center">
                          <span><b>공리주의:</b> {chk.utilNote}</span>
                          <span className={`font-black px-2 py-0.5 rounded text-white ${chk.utilVerdict === '통과' ? 'bg-[#0F766E]' : 'bg-rose-600'}`}>
                            {chk.utilVerdict}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border flex justify-between items-center">
                          <span><b>의무론:</b> {chk.deonNote}</span>
                          <span className={`font-black px-2 py-0.5 rounded text-white ${chk.deonVerdict === '통과' ? 'bg-[#0F766E]' : 'bg-rose-600'}`}>
                            {chk.deonVerdict}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">검증 결과 대기 중</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'LOGS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((num) => {
              const g = groups[String(num)] || {};
              return (
                <div key={num} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2 text-xs">
                  <div className="font-black text-sm text-[#0F766E]">{num}모둠 ({g.country?.name || '-'} 대통령)</div>
                  <p><b>초기 선택 및 이유:</b> {g.draft?.policy || '-'} — {g.draft?.reason || '-'}</p>
                  <p className="text-amber-800"><b>자문위원 반론:</b> {g.rebuttal?.rebuttal || '-'}</p>
                  <p className="text-teal-800"><b>대통령 재반박:</b> {g.rebuttalReply || '-'}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. 광해군 비교 공유 탭 */}
        {activeTab === 'COMPARE' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-black text-slate-900">📜 모둠별 [17세기 광해군 vs 오늘날 우리의 선택] 비교 공유</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((num) => {
                const g = groups[String(num)] || {};
                const cmp = g.compare;
                return (
                  <div key={num} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-black text-base text-slate-900">{num}모둠 ({g.country?.name || '미정'})</span>
                      <span className="font-bold text-[#0F766E]">{g.final?.policy || '-'}</span>
                    </div>
                    {cmp ? (
                      <div className="space-y-2 leading-relaxed">
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <b className="text-amber-900">공통점:</b> {cmp.same}
                        </div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                          <div><b>① 국제법·조약:</b> {cmp.diff1}</div>
                          <div><b>② 국제기구·여론:</b> {cmp.diff2}</div>
                          <div><b>③ 국내 여론·경제:</b> {cmp.diff3}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 py-4 text-center">아직 광해군 비교를 제출하지 않았습니다.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {showLargeQR && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setShowLargeQR(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-slate-900">모둠 기기 QR 코드 입장</h2>
            <div className="flex justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={240} />
            </div>
            <div className="text-2xl font-black text-[#0F766E] tracking-widest">세션 코드: {sessionCode}</div>
            <button onClick={() => setShowLargeQR(false)} className="w-full py-3 bg-[#1E293B] text-white font-bold rounded-xl">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}