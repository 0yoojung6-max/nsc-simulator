'use client';

import React, { useState } from 'react';
import { Sparkles, ShieldAlert, Cpu, Terminal, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'NSC Simulator Test Run' }),
      });
      const data = await response.json();
      setResult(data.output || '시뮬레이션이 성공적으로 완료되었습니다.');
    } catch (error) {
      setResult('시뮬레이션 실행 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

        <div className="border-t border-slate-800 pt-6 mb-6">
          <p className="text-slate-300 leading-relaxed mb-4">
            데스크톱 환경 설정이 완료되었습니다. 아래 버튼을 눌러 AI 시뮬레이터 시스템 연동 테스트를 시작해 보세요.
          </p>
          
          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-5 h-5" />
            <span>{loading ? '시뮬레이션 실행 중...' : '시뮬레이터 테스트 실행'}</span>
          </button>
        </div>

        {result && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-6">
            <div className="flex items-center space-x-2 text-emerald-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold text-sm">실행 결과</span>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{result}</p>
          </div>
        )}
      </div>
    </main>
  );
}
