'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ParticleAvatar } from '@/components/particle-avatar';
import { getUser } from '@/lib/store';

const STAGES = ['播种', '破土', '萌芽', '抽叶', '生长', '茁壮'];

export default function SplashPage() {
  const router = useRouter();
  const [phase, setPhase] = useState(0);
  const [growth, setGrowth] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const growthStart = Date.now();
    const growthDuration = 3500; // 加快生长速度：5000 → 3500ms
    const targetGrowth = 0.85;

    const growthInterval = setInterval(() => {
      const elapsed = Date.now() - growthStart;
      if (elapsed >= growthDuration) {
        setGrowth(targetGrowth);
        clearInterval(growthInterval);
        return;
      }
      const progress = elapsed / growthDuration;
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setGrowth(targetGrowth * eased);
    }, 50);
    timers.push(growthInterval as unknown as ReturnType<typeof setTimeout>);

    timers.push(setTimeout(() => setPhase(1), 1800));
    timers.push(setTimeout(() => setPhase(2), 3200));
    timers.push(setTimeout(() => {
      const u = getUser();
      router.replace(u ? '/feed' : '/onboarding');
    }, 5500));
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(growthInterval);
    };
  }, [router]);

  const activeStage = Math.min(STAGES.length - 1, Math.floor(growth * STAGES.length));

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(180deg, #F5EFD8 0%, #F0E8CC 15%, #F8F2E0 30%, #F0F4E8 50%, #E8F0E0 70%, #F0EAD8 100%)' }}>
      {/* 水彩柔光背景 — 模拟图片中的绿色虚化 */}
      <div className="absolute top-[8%] left-[5%] rounded-full blur-2xl pointer-events-none"
        style={{ width: 200, height: 200, background: 'radial-gradient(circle, rgba(160,200,160,0.12), transparent 70%)' }} />
      <div className="absolute top-[15%] right-[8%] rounded-full blur-2xl pointer-events-none"
        style={{ width: 180, height: 180, background: 'radial-gradient(circle, rgba(180,210,170,0.10), transparent 70%)' }} />
      <div className="absolute bottom-[20%] left-[8%] rounded-full blur-2xl pointer-events-none"
        style={{ width: 160, height: 160, background: 'radial-gradient(circle, rgba(140,190,150,0.08), transparent 70%)' }} />
      <div className="absolute top-[40%] right-[12%] rounded-full blur-2xl pointer-events-none"
        style={{ width: 140, height: 140, background: 'radial-gradient(circle, rgba(200,220,180,0.07), transparent 70%)' }} />

      {/* 柔和云朵 */}
      <div className="ghibli-cloud animate-cloud-drift" style={{ width: 240, height: 140, top: '5%', left: '3%', background: 'rgba(255,255,255,0.3)' }} />
      <div className="ghibli-cloud animate-float-slow" style={{ width: 180, height: 110, top: '45%', right: '4%', background: 'rgba(196,163,90,0.08)' }} />

      {/* 顶部光源 — 模拟阳光透过树叶 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center top, rgba(255,250,240,0.15), transparent 60%)' }} />

      {/* 种子成长动画 */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative animate-seed-sprout">
          <ParticleAvatar growth={growth} size={280} />
        </div>

        {/* 品牌文字 */}
        <div className="mt-10 text-center">
          {phase >= 0 && (
            <p className="text-3xl font-bold text-[#A08060] tracking-wide animate-soft-fade"
              style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}>
              TimeMirror
            </p>
          )}
          {phase >= 1 && (
            <p className="text-2xl font-semibold text-[#B89870] mt-3 animate-soft-fade">
              拾光镜
            </p>
          )}
          {phase >= 2 && (
            <p className="text-sm text-[#A09070]/80 mt-2 animate-soft-fade tracking-widest">
              时光不语，镜见自己
            </p>
          )}
        </div>
      </div>

      {/* 种子成长阶段进度 */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, i) => {
            const active = i <= activeStage;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  active ? 'bg-[#C4A35A] shadow-md shadow-[#C4A35A]/30 scale-125' : 'bg-[#8B7355]/15'
                }`} />
                <span className={`text-[10px] transition-colors duration-500 ${
                  active ? 'text-[#B89870] font-medium' : 'text-[#A09070]/40'
                }`}>{s}</span>
                {i < STAGES.length - 1 && <div className={`w-5 h-px transition-colors duration-400 ${i < activeStage ? 'bg-[#C4A35A]/30' : 'bg-[#8B7355]/8'}`} />}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[#8B7B65]/40 tracking-wide">种子萌芽，慢慢生长</p>
      </div>
    </div>
  );
}
