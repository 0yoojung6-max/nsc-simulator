import Link from 'next/link';
import { WORLD_ACTORS } from '@/app/lib/constants';

export default function HomePage() {
  const allyName = WORLD_ACTORS.ally.name;
  const tradeName = WORLD_ACTORS.trade.name;

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4 md:p-8 overflow-hidden bg-[#0F172A]">
      {/* 1. 배경 일러스트 레이어 (화면 크기에 맞게 여백을 지키고 잘림을 방지하기 위한 object/bg 설정) */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center md:bg-[center_top] bg-no-repeat transition-all duration-500"
        style={{
          backgroundImage: `url('/background.png')`,
        }}
      />

      {/* 2. 어두운 오버레이: 배경을 살리면서 텍스트가 묻히지 않게 조율된 은은한 그라데이션 */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-slate-900/15" />

      {/* 3. 화면 중앙에 위치한 콘텐츠 카드 (반응형 패딩 및 최대 너비 보정) */}
      <div className="relative z-20 max-w-xl w-full bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl text-center space-y-6 sm:space-y-8 my-auto">
        <div className="space-y-3 sm:space-y-4">
          <span className="inline-block px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] sm:text-xs font-black tracking-wider uppercase">
            한국사 × 현대 사회와 윤리 융합 수업
          </span>

          {/* md 화면 이상에서 줄바꿈 없이 한 줄에, 모바일에서는 유연하게 */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white md:whitespace-nowrap drop-shadow">
            다시 태어나 보니, 내가 <span className="text-teal-400">대통령?!</span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base font-bold text-slate-200 leading-relaxed max-w-md mx-auto">
            동맹의 신의(<span className="text-teal-300">{allyName}</span>)와 자국의 실리(
            <span className="text-indigo-300">{tradeName}</span>)가 충돌할 때,
            <br className="hidden sm:inline" />
            대통령으로서 어떤 외교 노선을 선택하시겠습니까?
          </p>
        </div>

        {/* 4. 버튼 영역 (모바일 1열, 태블릿 이상 2열 대응) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1 sm:pt-2">
          <Link
            href="/join"
            className="group p-4 sm:p-5 rounded-2xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white font-black text-base sm:text-lg shadow-lg transition duration-200 flex flex-col items-center justify-center gap-1"
          >
            <span className="flex items-center gap-1">🎖️ 모둠 대통령 입장</span>
            <span className="text-[10px] sm:text-xs font-normal text-teal-100 group-hover:text-white transition">
              QR 코드 · 바로 참여
            </span>
          </Link>

          <Link
            href="/teacher"
            className="group p-4 sm:p-5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-100 font-black text-base sm:text-lg transition duration-200 flex flex-col items-center justify-center gap-1"
          >
            <span>🧑‍🏫 교사 통제실</span>
            <span className="text-[10px] sm:text-xs font-normal text-slate-400 group-hover:text-slate-300 transition">
              세션 개설 및 타이머 제어
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}