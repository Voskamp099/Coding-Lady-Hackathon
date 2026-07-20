'use client';

import { useState, useEffect } from 'react';

const QUOTES = [
  '每一片记忆，都是时光的种子',
  '在回忆的镜子里，我们看见成长的脉络',
  '时间是最温柔的园丁，耐心浇灌每一寸成长',
  '那些被记住的瞬间，终将长成生命的模样',
  '拾光镜里，岁月正在发芽',
  '记忆不是过去的回声，而是未来的种子',
  '每一滴时光，都在浇灌看不见的根',
];

const ROTATION_MS = 3500;

export function LoadingQuotes() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % QUOTES.length);
        setVisible(true);
      }, 400);
    }, ROTATION_MS);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="flex flex-col items-start gap-2 py-1">
      {/* 小树苗图标 + 呼吸光晕 */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-[#C4A35A] animate-bounce"
          style={{ animationDelay: '0s', animationDuration: '1.2s' }}
        />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4A35A" strokeWidth="2" strokeLinecap="round" className="animate-breathe">
          <path d="M12 22V12" />
          <path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" />
          <path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z" />
        </svg>
      </div>

      {/* 轮播语录 */}
      <p
        className="text-xs text-[#8B7B65]/70 leading-relaxed transition-opacity duration-400 max-w-[200px]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {QUOTES[index]}
      </p>
    </div>
  );
}
