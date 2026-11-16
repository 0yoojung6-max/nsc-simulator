'use client';

import React, { useState } from 'react';

export default function ScenarioPage() {
  const [stage, setStage] = useState('S1_FOUNDING');
  const [choice, setChoice] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // S1 결과
  const [resultData, setResultData] = useState<any>(null);
  const [isRebuttalMode, setIsRebuttalMode] = useState(false);
  const [rebuttal, setRebuttal] = useState('');

  // S2 진입 및 결과
  const [isS2Started, setIsS2Started] = useState(false);
  const [s2Choice, setS2Choice] = useState('');
  const [s2Result, setS2Result] = useState<any>(null);

  // S3 최종 엔딩 진입 여부
  const [isEndingStarted, setIsEndingStarted] = useState(false);

  const [rawFallback, setRawFallback] = useState<string | null>(null);

  const cleanJson = (text: string) => {
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  // S1 제출 및 반박 처리
  const submitChoice = async (textToSend: string, isRebuttal: boolean = false) => {
    if (!textToSend.trim()) return;
    setLoading(true);
    setRawFallback(null);

    const currentStage = isRebuttal ? 'S1_REBUTTAL' : 'S1_FOUNDING';
    const newHistory = [...history, { role: isRebuttal ? 'student_rebuttal' : 'student_choice', content: textToSend }];

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: currentStage, choice: textToSend, history: newHistory }),
      });
      const data = await res.json();
      
      if (res.ok && data.result) {
        const parsed = cleanJson(data.result);
        if (parsed) {
          setResultData(parsed);
          setHistory(newHistory);
          if (isRebuttal) {
            setIsRebuttalMode(false);
          } else {
            setIsRebuttalMode(true);
          }
        } else {
          setRawFallback(data.result);
        }
      } else {
        setRawFallback(data.error || '오류가 발생했습니다.');
      }
    } catch {
      setRawFallback('서버 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (!isRebuttal) setChoice('');
      else setRebuttal('');
    }
  };

  // S2 제출 처리
  const submitS2Choice = async () => {
    if (!s2Choice.trim()) return;
    setLoading(true);
    setRawFallback(null);
    setStage('S2_CRISIS_ACTION');

    const newHistory = [...history, { role: 'student_s2_choice', content: s2Choice }];

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'S2_CRISIS_ACTION', choice: s2Choice, history: newHistory }),
      });
      const data = await res.json();
      
      if (res.ok && data.result) {
        const parsed = cleanJson(data.result);
        if (parsed) {
          setS2Result(parsed);
          setHistory(newHistory);
        } else {
          setRawFallback(data.result);
        }
      } else {
        setRawFallback(data.error || '오류가 발생했습니다.');
      }
    } catch {
      setRawFallback('서버 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderText = (val: any) => {
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) return JSON.stringify(val, null, 2);
    return String(val || '');
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
        <div>
          <span className="text-xs font-semibold px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">
            NSC 상황실 | 현재 단계: {stage}
          </span>
          <h1 className="text-2xl font-bold mt-3 text-white">국가 건국 및 위기 대응 시뮬레이션</h1>
          <p className="text-sm text-slate-400 mt-1">국가안전보장회의(NSC) 위원으로서 국가의 운명을 결정하세요.</p>
        </div>

        {/* --- S1 단계 --- */}
        {!isS2Started && (
          <>
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700 space-y-2">
              <h2 className="font-semibold text-slate-300 text-sm">📡 상황 브리핑 (S1: 건국 및 초기 외교 노선)</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {renderText(resultData?.next_situation) || 
                  "우리 국가는 현재 외교적 긴장과 경제적 위기 상황에 직면해 있습니다. 국가의 생존을 위해 첫 번째 주요 정책 방향을 선택하고 실행해야 합니다."}
              </p>
            </div>

            {!isRebuttalMode && !resultData && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">우리 모둠의 초기 정책 결정 입력</label>
                <textarea
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  placeholder="예: 실리 중심의 중립 외교를 선언하고 강대국 간의 완충 지대를 자처한다."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm h-28 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => submitChoice(choice, false)}
                  disabled={loading || !choice.trim()}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition disabled:bg-slate-700"
                >
                  {loading ? 'AI 심판관 검토 중...' : '정책 제출 및 AI 반론 확인하기'}
                </button>
              </div>
            )}

            {resultData && (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                  <h3 className="font-bold text-amber-400 text-sm">🔍 냉혹한 현실 분석</h3>
                  <p className="text-sm text-amber-200/90 leading-relaxed">{renderText(resultData.analysis)}</p>
                </div>

                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1">
                  <h3 className="font-bold text-rose-400 text-sm">⚔️ NSC 심판관의 날카로운 반론</h3>
                  <p className="text-sm text-rose-200/90 leading-relaxed">{renderText(resultData.feedback)}</p>
                </div>
              </div>
            )}

            {isRebuttalMode && (
              <div className="space-y-3 pt-4 border-t border-slate-700 bg-indigo-950/40 p-4 rounded-xl border border-indigo-900">
                <label className="block text-sm font-semibold text-indigo-300">💬 AI 반론에 대한 모둠의 1회성 추가 반박</label>
                <textarea
                  value={rebuttal}
                  onChange={(e) => setRebuttal(e.target.value)}
                  placeholder="예: 다자간 경제 협력체를 통해 고립을 방어할 수 있는 외교적 안전장치가 있습니다."
                  className="w-full bg-slate-900 border border-indigo-800 rounded-xl p-3 text-sm h-24 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => submitChoice(rebuttal, true)}
                  disabled={loading || !rebuttal.trim()}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition disabled:bg-slate-700"
                >
                  {loading ? '심판관 최종 판정 중...' : '추가 반박 제출 및 최종 판정 받기'}
                </button>
              </div>
            )}

            {resultData && !isRebuttalMode && (
              <button
                onClick={() => {
                  setStage('S2_CRISIS_BRIEFING');
                  setIsS2Started(true);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-lg"
              >
                🚀 S2 위기 심화 단계(경제 제재 및 안보 위기)로 진입하기
              </button>
            )}
          </>
        )}

        {/* --- S2 단계 --- */}
        {isS2Started && !isEndingStarted && (
          <div className="space-y-6 pt-2">
            <div className="p-4 bg-emerald-950/40 rounded-xl border border-emerald-800 space-y-2">
              <h2 className="font-semibold text-emerald-300 text-sm">📡 상황 브리핑 (S2: 본격적인 경제 제재 및 안보 위기)</h2>
              <p className="text-sm text-emerald-200/90 leading-relaxed">
                {renderText(s2Result?.next_situation) || 
                  "앞선 외교적 선택의 여파로 주변국의 경제 보복과 군사적 압박이 현실화되었습니다. 물가 폭등과 공급망 차단 위기 속에서 국가 안보를 수호할 고강도 비상 조치를 단행해야 합니다."}
              </p>
            </div>

            {!s2Result && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">S2 비상 대책 및 정책 결정 입력</label>
                <textarea
                  value={s2Choice}
                  onChange={(e) => setS2Choice(e.target.value)}
                  placeholder="예: 비상경제대책본부를 설치하고 배급제를 시행하며 전시 물자 확보에 총력을 기울인다."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm h-28 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={submitS2Choice}
                  disabled={loading || !s2Choice.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition disabled:bg-slate-700"
                >
                  {loading ? 'AI 심판관 S2 검토 중...' : 'S2 비상 정책 제출 및 최종 심판 받기'}
                </button>
              </div>
            )}

            {s2Result && (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                  <h3 className="font-bold text-amber-400 text-sm">🔍 S2 현실 분석 및 평가</h3>
                  <p className="text-sm text-amber-200/90 leading-relaxed">{renderText(s2Result.analysis)}</p>
                </div>

                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1">
                  <h3 className="font-bold text-rose-400 text-sm">⚔️ NSC 심판관의 최종 판정</h3>
                  <p className="text-sm text-rose-200/90 leading-relaxed">{renderText(s2Result.feedback)}</p>
                </div>

                <button
                  onClick={() => setIsEndingStarted(true)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg"
                >
                  🏆 시뮬레이션 최종 결과 리포트 확인하기
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- S3 최종 엔딩 화면 --- */}
        {isEndingStarted && (
          <div className="space-y-6 pt-2 text-center">
            <div className="p-6 bg-indigo-950/60 rounded-2xl border border-indigo-500/40 space-y-3">
              <span className="text-xs font-bold px-3 py-1 bg-indigo-500 text-white rounded-full">
                SIMULATION FINISHED
              </span>
              <h2 className="text-xl font-bold text-white mt-2">국가 위기 대응 시뮬레이션 결과 리포트</h2>
              <p className="text-sm text-indigo-200/90 leading-relaxed text-left bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                {renderText(s2Result?.next_situation) || "모든 위기 단계를 거치며 우리 모둠이 내린 결단은 국제정치사의 중요한 분수령이 되었습니다."}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition"
            >
              🔄 시뮬레이션 처음부터 다시 시작하기
            </button>
          </div>
        )}

        {rawFallback && (
          <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-300 whitespace-pre-wrap">
            {rawFallback}
          </div>
        )}
      </div>
    </main>
  );
}