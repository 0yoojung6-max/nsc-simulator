'use client';

import React, { useState } from 'react';
import { Sparkles, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';

const POLICIES = ['전면 지원', '비군사적 지원(인도적·경제)', '중립 선언과 중재 시도', '지원 거부와 교역 유지'];
const LABELS: Record<string, string> = {
  security: '안보',
  economy: '경제',
  reputation: '국제 평판',
  public_support: '여론 지지',
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState('하란국');
  const [policy, setPolicy] = useState(2);
  const [reason, setReason] = useState('중립을 지키며 중재해 인명 피해를 줄이고 교역도 지키고 싶습니다.');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, policy, reason }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || `서버 오류 (${res.status})`);
      else setData(json);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const sim = data?.simulation;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">NSC Simulator</h1>
            <p className="text-sm text-slate-400">Gemini & Firebase 기반 시뮬레이터 환경</p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 mb-6 space-y-3">
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            maxLength={8}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            placeholder="국가 이름"
          />
          <select
            value={policy}
            onChange={(e) => setPolicy(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
          >
            {POLICIES.map((p, i) => (
              <option key={i} value={i}>{p}</option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            placeholder="정책을 선택한 이유"
          />
          <button
            onClick={run}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-5 h-5" />
            <span>{loading ? '시뮬레이션 실행 중...' : '시뮬레이터 테스트 실행'}</span>
          </button>
        </div>

        {error && (
          <div className="bg-slate-950 border border-red-900 rounded-xl p-4 mt-6">
            <div className="flex items-center space-x-2 text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold text-sm">오류</span>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {sim && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-6 space-y-3 text-sm">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">
                {data.source === 'ai' ? `AI 생성 결과 (${data.model})` : '대체본 결과 (AI 호출 실패 또는 대체본 모드)'}
              </span>
            </div>
            <p><b>{sim.ally_statement.speaker}</b>: {sim.ally_statement.text}</p>
            <p><b>{sim.trade_response.speaker}</b>: {sim.trade_response.text}</p>
            <p><b>{sim.news_article.headline}</b><br />{sim.news_article.body}</p>
            <p className="text-amber-300">속보: {sim.ticker.join(' / ')}</p>
            <p className="text-slate-400">
              지표 변화: {Object.entries(sim.indicator_deltas).map(([k, v]) => `${LABELS[k]} ${Number(v) > 0 ? '+' : ''}${v}`).join(', ')}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
