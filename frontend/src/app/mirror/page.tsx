'use client';

import { useState, useEffect, useMemo } from 'react';
import { BottomNav } from '@/components/bottom-nav';
import { ParticleAvatar } from '@/components/particle-avatar';
import {
  getMemories, getUser, CHILDREN_FIVE_TIMES, type Memory,
  getChildAgeString, syncMemoriesFromBackend,
} from '@/lib/store';

/* 金色系 + 绿色 — 五种时间 */
const GOLD_COLORS: Record<string, string> = {
  health: '#7B9E89',
  play: '#C4A35A',
  survival: '#8B7B4A',
  achievement: '#B8941F',
  flow: '#5B7D5A',
};

/* 吉卜力风格场景渐变 — 每种时间类型对应不同自然画面（金色系） */
const GHIBLI_SCENES: Record<string, string> = {
  health: 'linear-gradient(160deg, #E8F0E0 0%, #A3B599 35%, #7B9E89 65%, #5B7D5A 100%)',
  play: 'linear-gradient(160deg, #FFF8DC 0%, #E8D068 30%, #D4A843 60%, #B8941F 100%)',
  survival: 'linear-gradient(160deg, #FEF8E7 0%, #D4C88E 35%, #8B7B4A 70%, #6B5B30 100%)',
  achievement: 'linear-gradient(160deg, #FFF8DC 0%, #D4A843 30%, #B8941F 60%, #8B6914 100%)',
  flow: 'linear-gradient(160deg, #F0F4E8 0%, #A3B599 30%, #5B7D5A 60%, #3A5A3A 100%)',
};

/**
 * 生成随机不规则多边形 clip-path — 每个碎片形状唯一
 * 模拟真实破碎镜面：4-7 个随机顶点，不规则角度
 */
function generateShardShape(seed: number): string {
  // 用 seed 做确定性随机
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const numPoints = 5 + Math.floor(rand() * 3); // 5-7 个顶点
  const points: string[] = [];
  for (let i = 0; i < numPoints; i++) {
    const baseAngle = (i / numPoints) * 360;
    const angleJitter = (rand() - 0.5) * 50; // ±25° 抖动
    const angle = baseAngle + angleJitter;
    const radius = 35 + rand() * 30; // 35-65% 半径
    const rad = (angle * Math.PI) / 180;
    const x = 50 + Math.cos(rad) * radius;
    const y = 50 + Math.sin(rad) * radius;
    points.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  return `polygon(${points.join(', ')})`;
}

/**
 * 生成宝石切面内层渐变 — 模拟棱镜折射效果
 */
function generateGemFacets(seed: number): string {
  let s = seed * 12345 + 67890;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const angle1 = Math.floor(rand() * 360);
  const angle2 = angle1 + 60 + Math.floor(rand() * 60);
  const angle3 = angle2 + 40 + Math.floor(rand() * 40);
  return `conic-gradient(from ${angle1}deg at 40% 35%,
    rgba(255,255,255,0.35) 0deg,
    transparent 30deg,
    rgba(255,250,230,0.15) 60deg,
    transparent 90deg,
    rgba(255,255,255,0.2) 120deg,
    transparent 150deg,
    rgba(255,245,220,0.1) 180deg,
    transparent 210deg,
    rgba(255,255,255,0.25) 240deg,
    transparent 270deg,
    rgba(255,250,230,0.15) 300deg,
    transparent 330deg,
    rgba(255,255,255,0.3) 360deg)`;
}

export default function MirrorPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [user, setUser] = useState<{ childName: string; parentName: string; childBirthday: string } | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'mirror' | 'today'>('mirror');

  useEffect(() => {
    setMemories(getMemories());
    const u = getUser();
    if (u) setUser({ childName: u.childName, parentName: u.parentName, childBirthday: u.childBirthday });
    setMounted(true);
    // Sync memories from backend DB
    syncMemoriesFromBackend().then(() => {
      setMemories(getMemories());
    });
  }, []);

  const growth = useMemo(
    () => Math.min(1, 0.15 + memories.length * 0.06),
    [memories.length]
  );

  // 每个碎片有唯一的随机形状、大小、旋转、轨道
  const shardData = useMemo(() => {
    return memories.slice(0, 24).map((mem, i) => {
      const angle = (i * 137.5 * Math.PI) / 180; // 黄金角螺旋分布
      const ringIndex = Math.floor(i / 8);
      const radius = 28 + ringIndex * 14;
      const primaryType = mem.timeTypes?.[0] || 'survival';

      // 用 i 做种子生成唯一形状
      const shape = generateShardShape(i + 1);
      const gemFacets = generateGemFacets(i + 1);

      // 随机尺寸和宽高比
      const sizeVariation = 26 + (i * 7 + 3) % 16; // 26-42px
      const aspectRatio = 1.1 + ((i * 13) % 7) * 0.08; // 1.1-1.58 宽高比

      return {
        mem,
        left: 50 + Math.cos(angle) * radius,
        top: 50 + Math.sin(angle) * radius * 0.72,
        delay: i * 0.06,
        initialRotate: (i * 53 + 17) % 360,
        orbitDuration: 35 + (i % 5) * 9,
        selfRotateDuration: 12 + (i % 7) * 5,
        shape,
        gemFacets,
        size: sizeVariation,
        aspect: aspectRatio,
        color: GOLD_COLORS[primaryType] || '#8B7B4A',
        scene: GHIBLI_SCENES[primaryType] || GHIBLI_SCENES.survival,
      };
    });
  }, [memories]);

  const todayMemories = useMemo(() => {
    const today = new Date();
    const monthDay = today.toISOString().slice(5, 10);
    return memories.filter(m => m.date.slice(5, 10) === monthDay && m.date.slice(0, 4) < String(today.getFullYear()));
  }, [memories]);

  const getCategoryColor = (cat: string | undefined) => GOLD_COLORS[cat || 'survival'] || '#8B7B4A';
  const getCategoryLabel = (cat: string | undefined) =>
    CHILDREN_FIVE_TIMES.find(c => c.value === cat)?.label || '日常';
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (!mounted) return null;

  const TEXT_MAIN = '#5B4A1E';
  const TEXT_SOFT = '#8B7B4A';

  return (
    <div className="min-h-screen relative overflow-hidden morandi-dawn">
      {/* 宫崎骏云朵装饰 */}
      <div className="ghibli-cloud animate-cloud-drift" style={{ width: 220, height: 130, top: '5%', left: '4%', background: 'rgba(255,255,255,0.35)' }} />
      <div className="ghibli-cloud animate-float-slow" style={{ width: 180, height: 110, bottom: '8%', right: '4%', background: 'rgba(196,163,90,0.1)' }} />

      <div className="md:pl-20 pb-24 md:pb-0 relative z-10">
        <div className="max-w-4xl mx-auto px-5 py-6 md:py-10">
          {/* Header */}
          <header className="text-center mb-4">
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: TEXT_MAIN }}>
              {user ? `${user.childName}的镜像` : '回忆镜像'}
            </h1>
            <p className="text-xs md:text-sm mt-0.5" style={{ color: 'rgba(139,123,74,0.5)' }}>
              {memories.length > 0
                ? `${memories.length}段回忆 · 碎片汇聚成光`
                : '还没有回忆，去投喂第一段吧'}
            </p>
          </header>

          {/* Tab buttons */}
          <div className="flex justify-center gap-3 mb-6">
            <button
              onClick={() => setTab('mirror')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                tab === 'mirror'
                  ? 'bg-[#D4C88E]/40 border border-[#C4A35A]/30'
                  : 'border border-transparent hover:opacity-70'
              }`}
              style={{ color: tab === 'mirror' ? TEXT_MAIN : 'rgba(139,123,74,0.4)' }}
            >
              记忆碎片
            </button>
            <button
              onClick={() => setTab('today')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                tab === 'today'
                  ? 'bg-[#D4C88E]/40 border border-[#C4A35A]/30'
                  : 'border border-transparent hover:opacity-70'
              }`}
              style={{ color: tab === 'today' ? TEXT_MAIN : 'rgba(139,123,74,0.4)' }}
            >
              那年今日
            </button>
          </div>

          {memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ParticleAvatar growth={0.08} size={280} />
              <p className="text-sm mt-6 text-center leading-relaxed" style={{ color: 'rgba(139,123,74,0.5)' }}>
                光种刚刚发芽<br />
                投喂第一段回忆，让它开始成长
              </p>
            </div>
          ) : tab === 'mirror' ? (
            <>
              {/* 漂浮旋转镜子碎片 — 宝石切面风格 */}
              <div className="relative w-full aspect-square max-w-md mx-auto mb-6">
                {/* 中心种子 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <ParticleAvatar growth={growth} size={220} />
                    <div className="absolute inset-0 -z-10 rounded-full blur-3xl animate-breathe"
                      style={{ background: 'radial-gradient(circle, rgba(196,163,90,0.12), transparent 70%)' }} />
                  </div>
                </div>

                {/* 镜子碎片 — 每块形状唯一 */}
                {shardData.map((sd, i) => (
                  <div
                    key={sd.mem.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${sd.left}%`,
                      top: `${sd.top}%`,
                      animation: `soft-fade-in 0.8s ease-out ${sd.delay}s both, breathe 5s ease-in-out ${sd.delay}s infinite`,
                    }}
                  >
                    <button
                      onClick={() => setSelected(sd.mem)}
                      className="block shard-hover group relative"
                      style={{
                        width: `${sd.size}px`,
                        height: `${sd.size * sd.aspect}px`,
                        animation: `shard-self-rotate ${sd.selfRotateDuration}s linear infinite`,
                        '--rotate-duration': `${sd.selfRotateDuration}s`,
                      } as React.CSSProperties}
                    >
                      {/* 碎片主体 — 镜面反射 + 吉卜力场景 */}
                      <div
                        className="relative w-full h-full mirror-shard"
                        style={{
                          clipPath: sd.shape,
                          background: sd.scene,
                          filter: 'saturate(0.85) brightness(1.08)',
                          boxShadow: `0 0 10px ${sd.color}50, 0 2px 8px rgba(139,115,85,0.2), inset 0 0 6px rgba(255,255,255,0.15)`,
                        }}
                      >
                        {/* 宝石切面折射层 — conic-gradient 模拟棱镜 */}
                        <div
                          className="absolute inset-0"
                          style={{ clipPath: sd.shape, background: sd.gemFacets }}
                        />
                        {/* 镜面光泽层 — 主对角高光 */}
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: sd.shape,
                            background: `linear-gradient(135deg,
                              rgba(255,255,255,0.45) 0%,
                              rgba(255,250,240,0.08) 20%,
                              rgba(255,255,255,0.25) 38%,
                              transparent 55%,
                              rgba(255,245,220,0.12) 72%,
                              rgba(255,255,255,0.35) 100%)`,
                          }}
                        />
                        {/* 宝石棱线 — 模拟切割面交接线 */}
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: sd.shape,
                            background: `linear-gradient(30deg, transparent 48%, rgba(255,255,255,0.2) 49%, rgba(255,255,255,0.3) 49.5%, transparent 50.5%),
                                         linear-gradient(110deg, transparent 46%, rgba(255,255,255,0.15) 47%, rgba(255,255,255,0.2) 47.5%, transparent 48.5%),
                                         linear-gradient(75deg, transparent 62%, rgba(255,250,230,0.1) 63%, transparent 64%)`,
                          }}
                        />
                        {/* 顶部高光 — 模拟光源照射 */}
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: sd.shape,
                            background: `radial-gradient(ellipse 60% 40% at 35% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
                          }}
                        />
                        {/* 边缘内发光 — 宝石边框感 */}
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: sd.shape,
                            boxShadow: `inset 0 0 8px 1px rgba(255,255,255,0.25), inset 0 0 3px rgba(255,240,200,0.15)`,
                          }}
                        />
                        {/* 底部反射暗影 — 增强立体感 */}
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: sd.shape,
                            background: `linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.08) 100%)`,
                          }}
                        />
                      </div>
                      {/* 悬停提示 */}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{ color: 'rgba(139,123,74,0.5)' }}>
                        {formatDate(sd.mem.date)}
                      </span>
                    </button>
                  </div>
                ))}

                {/* 暖色光晕粒子 */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={`particle-${i}`}
                    className="absolute rounded-full pointer-events-none animate-twinkle"
                    style={{
                      width: '3px',
                      height: '3px',
                      left: `${15 + (i * 11) % 70}%`,
                      top: `${20 + (i * 17) % 60}%`,
                      background: 'rgba(196,163,90,0.4)',
                      animationDelay: `${i * 0.4}s`,
                    }}
                  />
                ))}
              </div>

              {/* 成长指示器 */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-warm">
                  <div className="w-2 h-2 rounded-full bg-[#C4A35A] animate-pulse" />
                  <span className="text-xs" style={{ color: 'rgba(139,123,74,0.6)' }}>
                    成长度 {Math.round(growth * 100)}%
                  </span>
                  {user && (
                    <span className="text-[10px] ml-1" style={{ color: 'rgba(139,123,74,0.4)' }}>
                      · {getChildAgeString(user.childBirthday)}
                    </span>
                  )}
                </div>
              </div>

              {/* 回忆时间线 */}
              <div className="space-y-3">
                <h2 className="text-sm font-medium px-1" style={{ color: 'rgba(139,123,74,0.6)' }}>回忆时间线</h2>
                {memories.map((mem) => {
                  const primaryType = mem.timeTypes?.[0];
                  const color = getCategoryColor(primaryType);
                  return (
                    <button
                      key={mem.id}
                      onClick={() => setSelected(mem)}
                      className="w-full text-left glass-warm rounded-2xl p-4 transition-all duration-300 group hover:glow-warm"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs" style={{ color: 'rgba(139,123,74,0.5)' }}>{formatDate(mem.date)}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${color}20`, color }}>
                              {getCategoryLabel(primaryType)}
                            </span>
                            {mem.emotion && (
                              <span className="text-[10px]" style={{ color: 'rgba(139,123,74,0.4)' }}>{mem.emotion}</span>
                            )}
                          </div>
                          <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: TEXT_MAIN }}>
                            {mem.content}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* 那年今日 */
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm" style={{ color: 'rgba(139,123,74,0.5)' }}>
                  {todayMemories.length > 0
                    ? `历史上的今天，有 ${todayMemories.length} 段回忆`
                    : '今天还没有发生过特别的故事'}
                </p>
              </div>

              {todayMemories.length === 0 && memories.length > 0 && (
                <div className="flex flex-col items-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#D4C88E]/30 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" style={{ color: 'rgba(139,123,74,0.4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(139,123,74,0.3)' }}>继续投喂，总有一天今天会变得特别</p>
                </div>
              )}

              {todayMemories.map((mem) => {
                const primaryType = mem.timeTypes?.[0];
                const color = getCategoryColor(primaryType);
                return (
                  <button
                    key={mem.id}
                    onClick={() => setSelected(mem)}
                    className="w-full text-left glass-warm rounded-2xl p-4 transition-all duration-300 hover:glow-warm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: 'rgba(139,123,74,0.6)' }}>{formatDate(mem.date)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${color}20`, color }}>
                            {getCategoryLabel(primaryType)}
                          </span>
                          <span className="text-[10px]" style={{ color: 'rgba(139,123,74,0.4)' }}>{mem.emotion}</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: TEXT_MAIN }}>{mem.content}</p>
                        {mem.tags && mem.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {mem.tags.map(tag => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,123,74,0.1)', color: 'rgba(139,123,74,0.5)' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/15 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-warm rounded-3xl p-6 max-w-md w-full shadow-2xl animate-soft-fade max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const primaryType = selected.timeTypes?.[0];
                  const color = getCategoryColor(primaryType);
                  return (
                    <>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm" style={{ color: 'rgba(139,123,74,0.7)' }}>{getCategoryLabel(primaryType)}</span>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center transition-colors"
                style={{ color: 'rgba(139,123,74,0.5)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TEXT_MAIN }}>
              {selected.content}
            </p>

            <div className="mt-4 pt-4 border-t space-y-1" style={{ borderColor: 'rgba(139,123,74,0.1)' }}>
              <p className="text-xs" style={{ color: 'rgba(139,123,74,0.4)' }}>{formatDate(selected.date)}</p>
              {selected.emotion && (
                <p className="text-xs" style={{ color: 'rgba(139,123,74,0.4)' }}>情绪: {selected.emotion}</p>
              )}
              {selected.scene && (
                <p className="text-xs" style={{ color: 'rgba(139,123,74,0.4)' }}>场景: {selected.scene}</p>
              )}
              {selected.tags && selected.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {selected.tags.map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,123,74,0.1)', color: 'rgba(139,123,74,0.5)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
