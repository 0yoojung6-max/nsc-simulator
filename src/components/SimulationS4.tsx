'use client';

import React, { useState, useEffect, useRef } from 'react';

interface S4Props {
  countryName: string;
  policy: string;
  simulationData: {
    ally_statement: { speaker: string; text: string; videoUrl?: string; imageUrl?: string };
    trade_response: { speaker: string; text: string; videoUrl?: string; imageUrl?: string };
    news_article: { headline: string; body: string; source: string; videoUrl?: string; imageUrl?: string };
    ticker: string[];
  };
  s4Control?: { command: string; speed: number; timestamp: number };
  onComplete: () => void;
}

export default function SimulationS4({ countryName, policy, simulationData, s4Control, onComplete }: S4Props) {
  const [sceneIdx, setSceneIdx] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [mediaFailed, setMediaFailed] = useState<Record<string, boolean>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const speed = s4Control?.speed || 1;

  const playHeavySiren = () => {
    if (muted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(135, now);
      osc1.frequency.exponentialRampToValueAtTime(275, now + 1.0);
      osc1.frequency.exponentialRampToValueAtTime(145, now + 1.95);

      osc2.frequency.setValueAtTime(67.5, now);
      osc2.frequency.exponentialRampToValueAtTime(137.5, now + 1.0);
      osc2.frequency.exponentialRampToValueAtTime(72.5, now + 1.95);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.25);
      gain.gain.linearRampToValueAtTime(0.16, now + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);
    } catch (e) {}
  };

  const playNewsBassTone = () => {
    if (muted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(196, now);
      osc.frequency.setValueAtTime(261.63, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted, sceneIdx]);

  useEffect(() => {
    if (!s4Control) return;
    if (s4Control.command === 'SKIP') {
      setSceneIdx(3);
      setIsCompleted(true);
    }
    if (s4Control.command === 'REPLAY') {
      setIsCompleted(false);
      setSceneIdx(0);
    }
  }, [s4Control?.command, s4Control?.timestamp]);

  // 전체 재생 시간 11초로 압축 (인트로 2초 + 장면당 3초 × 3개)
  useEffect(() => {
    if (isCompleted) return;
    const k = 1 / speed;
    const timers: NodeJS.Timeout[] = [];

    if (sceneIdx === 0) {
      playHeavySiren();
      timers.push(setTimeout(() => { setSceneIdx(1); playNewsBassTone(); }, 2000 * k));
    }
    if (sceneIdx <= 1) {
      timers.push(setTimeout(() => { setSceneIdx(2); playNewsBassTone(); }, 5000 * k));
    }
    if (sceneIdx <= 2) {
      timers.push(setTimeout(() => { setSceneIdx(3); playNewsBassTone(); }, 8000 * k));
    }
    if (sceneIdx <= 3) {
      timers.push(setTimeout(() => {
        setIsCompleted(true);
        playNewsBassTone();
      }, 11000 * k));
    }

    return () => timers.forEach(clearTimeout);
  }, [sceneIdx, speed, isCompleted]);

  const scenes = [
    {
      tag: 'SCENE 01 · 동맹국 공식 반응',
      badgeColor: 'bg-[#34B3A8] text-[#0A0F14]',
      speaker: simulationData?.ally_statement?.speaker || '떡국 외무부 성명',
      headline: simulationData?.ally_statement?.text,
      videoUrl: simulationData?.ally_statement?.videoUrl,
      fallbackSvg: (
        <svg viewBox="0 0 1280 720" className="w-full h-full object-cover">
          <defs>
            <radialGradient id="g1" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#1e4963" />
              <stop offset="100%" stopColor="#070d12" />
            </radialGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#g1)" />
          <circle cx="640" cy="340" r="220" fill="none" stroke="#34B3A8" strokeWidth="2" strokeDasharray="10 10" opacity="0.5" />
          <circle cx="640" cy="340" r="130" fill="none" stroke="#34B3A8" strokeWidth="3" opacity="0.8" />
          <polygon points="640,290 675,365 640,348 605,365" fill="#34B3A8" />
        </svg>
      )
    },
    {
      tag: 'SCENE 02 · 강대국 통상 조치',
      badgeColor: 'bg-[#E2504A] text-white',
      speaker: simulationData?.trade_response?.speaker || '미역국 에너지부 발표',
      headline: simulationData?.trade_response?.text,
      videoUrl: simulationData?.trade_response?.videoUrl,
      fallbackSvg: (
        <svg viewBox="0 0 1280 720" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b1212" />
              <stop offset="100%" stopColor="#090505" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#g2)" />
          <rect x="240" y="310" width="800" height="44" rx="22" fill="#1f0a0a" stroke="#E2504A" strokeWidth="4" />
          <circle cx="640" cy="332" r="56" fill="#2b0c0c" stroke="#E2504A" strokeWidth="6" />
          <line x1="605" y1="297" x2="675" y2="367" stroke="#E2504A" strokeWidth="8" />
        </svg>
      )
    },
    {
      tag: 'SCENE 03 · 국내 민생 및 여론 동향',
      badgeColor: 'bg-[#F2B134] text-[#0A0F14]',
      speaker: simulationData?.news_article?.headline || '국내 긴급 뉴스 보도',
      headline: simulationData?.news_article?.body,
      videoUrl: simulationData?.news_article?.videoUrl,
      fallbackSvg: (
        <svg viewBox="0 0 1280 720" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="g3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e2430" />
              <stop offset="100%" stopColor="#080a0f" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#g3)" />
          <polyline points="180,460 380,410 540,480 740,260 920,320 1100,190" fill="none" stroke="#F2B134" strokeWidth="8" />
          <circle cx="1100" cy="190" r="14" fill="#F2B134" />
        </svg>
      )
    }
  ];

  const activeCut = scenes[Math.min(Math.max(sceneIdx - 1, 0), 2)];
  const showVideo = activeCut.videoUrl && !mediaFailed[activeCut.videoUrl];

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-between font-sans overflow-hidden select-none z-40">
      <div className="absolute inset-0 z-0 overflow-hidden">
        {showVideo ? (
          <video
            ref={videoRef}
            key={activeCut.videoUrl}
            src={activeCut.videoUrl}
            autoPlay
            loop
            muted={muted}
            playsInline
            onLoadedData={(e) => {
              e.currentTarget.muted = muted;
              e.currentTarget.play().catch(() => {
                e.currentTarget.muted = true;
                e.currentTarget.play().catch(() => {});
              });
            }}
            onError={() => setMediaFailed((prev) => ({ ...prev, [activeCut.videoUrl!]: true }))}
            className="w-full h-full object-cover opacity-85"
          />
        ) : (
          <div className="w-full h-full opacity-80">{activeCut.fallbackSvg}</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/65" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-3">
          <span className="bg-[#E2504A] text-white text-xs font-black px-2.5 py-1 rounded tracking-wider animate-pulse">
            BREAKING NEWS
          </span>
          <span className="font-black text-lg tracking-tight text-white">KBC 국제뉴스 특보</span>
          <span className="text-xs text-slate-300 hidden sm:inline">| 발표 국가: {countryName}</span>
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted && sceneIdx > 0 && (
            <button
              onClick={() => {
                setSceneIdx(3);
                setIsCompleted(true);
              }}
              className="bg-white/15 border border-white/25 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/25 transition"
            >
              전체 요약 바로가기 ⏭️
            </button>
          )}
          <button
            onClick={() => {
              const next = !muted;
              setMuted(next);
              if (videoRef.current) {
                videoRef.current.muted = next;
                if (!next) videoRef.current.play().catch(() => {});
              }
              if (!next) playNewsBassTone();
            }}
            className="bg-black/60 border border-white/25 px-3.5 py-1.5 rounded-lg text-xs font-bold hover:border-[#F2B134] transition"
          >
            {muted ? '🔇 소리 켜기' : '🔊 방송 오디오 ON'}
          </button>
        </div>
      </header>

      {sceneIdx === 0 && (
        <div className="fixed inset-0 bg-[#1f0404]/95 z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="border-y-4 border-[#E2504A] py-8 px-6 max-w-2xl w-full bg-black/80 space-y-4">
            <div className="text-xs font-mono tracking-[0.25em] text-[#E2504A]">EMERGENCY DIPLOMATIC BULLETIN</div>
            <h1 className="text-4xl md:text-6xl font-black text-white">긴급 외교 특보</h1>
            <p className="text-base md:text-lg text-slate-200 font-medium">
              [{countryName}] 대통령이 “{policy}” 노선을 공식 발표했습니다
            </p>
          </div>
        </div>
      )}

      <div className="relative z-20 mt-auto">
        <div className="max-w-5xl mx-auto px-6 pb-6 space-y-4">
          <div className="inline-flex items-center gap-2">
            <span className={`text-xs font-black px-3 py-1 rounded ${activeCut.badgeColor}`}>
              {activeCut.tag}
            </span>
          </div>

          <div className="bg-black/80 backdrop-blur-md border-l-4 border-[#F2B134] p-6 md:p-7 rounded-r-2xl shadow-2xl space-y-2">
            <div className="text-sm md:text-base font-bold text-[#F2B134]">
              {activeCut.speaker}
            </div>
            <p className="text-lg md:text-2xl font-bold text-white leading-relaxed">
              {activeCut.headline}
            </p>
          </div>

          {isCompleted ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/85 border border-white/15 p-4 rounded-2xl">
              <div className="flex flex-wrap gap-2">
                {['1. 떡국 반응', '2. 미역국 조치', '3. 국내 여론'].map((label, i) => {
                  const isActiveTab = sceneIdx === i + 1;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSceneIdx(i + 1);
                        playNewsBassTone();
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                        isActiveTab
                          ? 'bg-[#F2B134] text-black font-black shadow'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {label} 다시 보기
                    </button>
                  );
                })}
              </div>
              <button
                onClick={onComplete}
                className="w-full sm:w-auto px-6 py-3 bg-[#34B3A8] hover:bg-[#2a968c] text-black font-black rounded-xl text-sm shadow-lg"
              >
                시뮬레이션 종료 · 윤리 이론으로 검증하기 ➔
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-[#E2504A] animate-ping" />
              현장 특보 수신 중... ({sceneIdx}/3 장면 진행 중)
            </div>
          )}
        </div>

        <footer className="bg-[#E2504A] text-white py-2.5 px-6 flex items-center gap-4">
          <span className="bg-white text-[#E2504A] font-black text-xs px-2.5 py-0.5 rounded shrink-0">속보</span>
          <div className="text-xs md:text-sm font-bold truncate">
            {(simulationData?.ticker || ['긴급 외교 속보 수신 중...']).join('   |   ')}
          </div>
        </footer>
      </div>
    </div>
  );
}