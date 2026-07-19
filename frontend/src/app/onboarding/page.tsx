'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ParticleAvatar } from '@/components/particle-avatar';
import { saveUser, generateId, type UserProfile } from '@/lib/store';

type Step = 'welcome' | 'parent' | 'child' | 'growing';

const BTN_STYLE = {
  background: 'linear-gradient(90deg, #C4A35A, #7B9E89)',
  boxShadow: '0 4px 12px rgba(196,163,90,0.2)',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [childBirthday, setChildBirthday] = useState('');
  const [childGender, setChildGender] = useState<'boy' | 'girl' | 'unspecified'>('unspecified');
  const [growth, setGrowth] = useState(0);

  const handleStart = () => setStep('parent');
  const handleParentNext = () => {
    if (parentName.trim()) setStep('child');
  };
  const handleChildNext = () => {
    if (childName.trim() && childBirthday) setStep('growing');
  };

  useEffect(() => {
    if (step === 'growing') {
      const interval = setInterval(() => {
        setGrowth((g) => {
          if (g >= 1) {
            clearInterval(interval);
            return 1;
          }
          return g + 0.02;
        });
      }, 40);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleComplete = () => {
    const user: UserProfile = {
      id: generateId(),
      parentName: parentName.trim(),
      childName: childName.trim(),
      childBirthday,
      childGender,
      avatarSeed: generateId(),
      createdAt: new Date().toISOString(),
      role: 'parent',
      inheritedAt: null,
    };
    saveUser(user);
    router.replace('/feed');
  };

  const inputClass = "w-full px-5 py-3.5 rounded-2xl bg-white/50 border text-[#6B5B45] text-base focus:outline-none transition-all";
  const inputStyle = { borderColor: 'rgba(196,163,90,0.2)' };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden morandi-dawn">
      {/* 莫兰迪云朵装饰 */}
      <div className="ghibli-cloud animate-cloud-drift" style={{ width: 200, height: 120, top: '10%', left: '8%', background: 'rgba(255,255,255,0.35)' }} />
      <div className="ghibli-cloud animate-float-slow" style={{ width: 160, height: 100, bottom: '15%', right: '10%', background: 'rgba(196,163,90,0.1)' }} />
      <div className="ghibli-cloud" style={{ width: 120, height: 80, top: '40%', right: '12%', background: 'rgba(168,197,214,0.15)' }} />

      {/* 种子动画 */}
      <div className="relative flex items-center justify-center mb-8">
        <ParticleAvatar
          growth={step === 'welcome' ? 0.05 : step === 'parent' ? 0.15 : step === 'child' ? 0.4 : growth}
          size={260}
        />
        <div
          className="absolute inset-0 -z-10 rounded-full blur-3xl animate-breathe"
          style={{ background: 'radial-gradient(circle, rgba(196,163,90,0.1), transparent 70%)' }}
        />
      </div>

      {/* Welcome step */}
      {step === 'welcome' && (
        <div className="text-center max-w-md animate-soft-fade">
          <h1 className="text-2xl md:text-3xl font-bold text-[#6B5B45] mb-3 tracking-wide">
            Time Mirror
          </h1>
          <p className="text-[#8B7B65] text-sm md:text-base leading-relaxed mb-2">
            用光种下一颗种子
          </p>
          <p className="text-[#8B7B65]/50 text-xs md:text-sm leading-relaxed mb-8">
            每一次投喂回忆，光点便多一粒<br />
            孩子的轮廓，便清晰一分
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 rounded-full text-white font-medium text-sm shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            style={BTN_STYLE}
          >
            开始种下光种
          </button>
        </div>
      )}

      {/* Parent info step */}
      {step === 'parent' && (
        <div className="w-full max-w-md animate-soft-fade">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-[#6B5B45] mb-2">你的名字</h2>
            <p className="text-[#8B7B65]/60 text-sm">守护者，请告诉我你是谁</p>
          </div>
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleParentNext()}
            placeholder="输入你的名字"
            autoFocus
            className={inputClass}
            style={inputStyle}
          />
          <button
            onClick={handleParentNext}
            disabled={!parentName.trim()}
            className="w-full mt-6 py-3.5 rounded-2xl text-white font-medium text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
            style={BTN_STYLE}
          >
            继续
          </button>
        </div>
      )}

      {/* Child info step */}
      {step === 'child' && (
        <div className="w-full max-w-md animate-soft-fade space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[#6B5B45] mb-2">关于孩子</h2>
            <p className="text-[#8B7B65]/60 text-sm">为谁种下这颗光之种子？</p>
          </div>

          <div>
            <label className="block text-[#8B7B65]/70 text-xs mb-1.5 ml-1">孩子的名字</label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="孩子的小名"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-[#8B7B65]/70 text-xs mb-1.5 ml-1">出生日期</label>
            <input
              type="date"
              value={childBirthday}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setChildBirthday(e.target.value)}
              className={inputClass}
              style={{ ...inputStyle, colorScheme: 'light' }}
            />
          </div>

          <div>
            <label className="block text-[#8B7B65]/70 text-xs mb-1.5 ml-1">性别（可选）</label>
            <div className="flex gap-3">
              {[
                { value: 'boy' as const, label: '男孩' },
                { value: 'girl' as const, label: '女孩' },
                { value: 'unspecified' as const, label: '保密' },
              ].map((g) => (
                <button
                  key={g.value}
                  onClick={() => setChildGender(g.value)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                    childGender === g.value
                      ? 'text-white shadow-md'
                      : 'bg-white/40 text-[#8B7B65]/60 border'
                  }`}
                  style={childGender === g.value ? BTN_STYLE : { borderColor: 'rgba(139,123,101,0.1)' }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleChildNext}
            disabled={!childName.trim() || !childBirthday}
            className="w-full py-3.5 rounded-2xl text-white font-medium text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
            style={BTN_STYLE}
          >
            种下光种
          </button>
        </div>
      )}

      {/* Growing step */}
      {step === 'growing' && (
        <div className="text-center max-w-md animate-soft-fade">
          {growth < 1 ? (
            <>
              <h2 className="text-xl font-semibold text-[#6B5B45] mb-2">光种正在汇聚...</h2>
              <p className="text-[#8B7B65]/60 text-sm">
                {childName}的轮廓正在一点点变清晰
              </p>
              <div className="mt-6 w-48 h-1.5 bg-[#8B7B65]/10 rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full transition-all duration-100 rounded-full"
                  style={{ width: `${growth * 100}%`, background: 'linear-gradient(90deg, #D4C88E, #C4A35A)' }}
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#6B5B45] mb-3">光种已成型</h2>
              <p className="text-[#8B7B65]/70 text-sm leading-relaxed mb-1">
                {parentName}，你为{childName}种下的光之种子
              </p>
              <p className="text-[#8B7B65]/40 text-xs leading-relaxed mb-8">
                将随着每一次回忆投喂，慢慢长大<br />
                轮廓会越来越清晰，越来越温暖
              </p>
              <button
                onClick={handleComplete}
                className="px-10 py-3.5 rounded-full text-white font-medium text-sm shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                style={BTN_STYLE}
              >
                开始投喂回忆
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
