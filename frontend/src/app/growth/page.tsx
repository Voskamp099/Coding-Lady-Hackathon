'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { ParticleAvatar } from '@/components/particle-avatar';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  getUser, getMemories, getTemperamentFromMemories, getIntelligenceFromMemories, getDevelopmentFromMemories,
  getEmotionalPatternsFromMemories, getGrowthStage, getTimeDistribution,
  getChildAgeString, getDigitalTwinProgress,
  inheritAccount, CHILDREN_FIVE_TIMES, Memory, UserProfile,
  syncMemoriesFromBackend, fetchBackendValueAnalysis,
} from '@/lib/store';
import type { ValueSignal } from '@/lib/backend';

/* 金色系 + 绿色 */
const GOLD = '#E8D8A8';
const GOLD_LIGHT = '#F0E8C8';
const GOLD_DEEP = '#D4BE7A';
const GREEN = '#D4E8D4';
const GREEN_LIGHT = '#E0F0E0';
const PINK = '#F0C8C8';
const PINK_LIGHT = '#F8D8D8';
const BLUE = '#D0E4F0';
const BLUE_LIGHT = '#E0ECF8';
const TEXT_MAIN = '#8A7B5A';
const TEXT_SUB = '#B0A080';

const emotionColors = [PINK, BLUE, GOLD, GREEN, 'rgba(212,200,142,0.3)'];
const emotionBgs = ['rgba(240,200,200,0.06)', 'rgba(200,224,240,0.06)', 'rgba(212,200,142,0.06)', 'rgba(200,224,200,0.06)', 'rgba(212,200,142,0.04)'];
const BG_CARD = 'rgba(255,252,248,0.5)';

const timeTypeColors: Record<string, string> = {
  health: GREEN,
  play: '#B0D0E8',
  survival: '#D0C0B0',
  achievement: GOLD_DEEP,
  flow: '#C0A880',
};

/* ========== CSS 条形图组件（替代 SVG 雷达图） ========== */
function DimensionBars({ data, title, color, memories }: {
  data: { label: string; score: number; evidence?: string }[];
  title: string;
  color: string;
  memories: Memory[];
}) {
  const [selectedDim, setSelectedDim] = useState<number | null>(null);

  const getEvidenceContent = (dimLabel: string): string[] => {
    try {
      const keyword = dimLabel?.slice(0, 2) || '';
      return memories
        .filter(m => (m?.tags?.some(t => t?.includes(keyword))) || m?.content?.includes(keyword))
        .slice(0, 3)
        .map(m => `[${m?.date || ''}] ${(m?.content || '').slice(0, 60)}`);
    } catch { return []; }
  };

  return (
    <div className="rounded-2xl p-4 mb-3 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.15)' }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: TEXT_MAIN }}>{title}</h3>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i}>
            <div
              className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-70"
              onClick={() => setSelectedDim(selectedDim === i ? null : i)}
            >
              <span className="text-xs flex-shrink-0 w-16 text-right" style={{ color: TEXT_MAIN }}>{d.label}</span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(139,123,85,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(3, d.score)}%`, background: color, opacity: selectedDim === i ? 1 : 0.8 }}
                />
              </div>
              <span className="text-xs font-bold flex-shrink-0 w-8" style={{ color }}>{d.score}</span>
            </div>
            {selectedDim === i && (
              <div className="ml-[72px] mt-1.5 mb-1 p-2 rounded-xl" style={{ background: 'rgba(255,251,240,0.5)' }}>
                {d.evidence && <p className="text-[11px] leading-relaxed mb-1" style={{ color: TEXT_SUB }}>{d.evidence}</p>}
                {(() => {
                  const ev = getEvidenceContent(d.label);
                  return ev.length > 0 ? (
                    <div className="space-y-1">
                      {ev.map((e, ei) => (
                        <p key={ei} className="text-[10px] leading-relaxed" style={{ color: 'rgba(139,123,85,0.5)' }}>{e}</p>
                      ))}
                    </div>
                  ) : <p className="text-[10px]" style={{ color: 'rgba(139,123,85,0.3)' }}>暂无更多证据</p>;
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== 发展阶段时间线 ========== */
function StageTimeline({ stages }: { stages: { stage: string; age: string; quality?: string; status?: string }[] }) {
  return (
    <div className="rounded-2xl p-4 mb-3 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.15)' }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: TEXT_MAIN }}>发展阶段 · 埃里克森</h3>
      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const isCompleted = s.status === 'completed' || s.status === '已通过';
          const isCurrent = s.status === 'current';
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: isCompleted ? GREEN : isCurrent ? GOLD : 'rgba(139,123,85,0.2)' }}
              />
              <span className="text-xs flex-shrink-0 w-14" style={{ color: 'rgba(139,123,85,0.5)' }}>{s.age}</span>
              <span className="text-xs flex-1" style={{ color: isCompleted ? TEXT_MAIN : isCurrent ? GOLD_DEEP : 'rgba(139,123,85,0.3)' }}>
                {s.stage}
              </span>
              {s.quality && <span className="text-[10px]" style={{ color: 'rgba(139,123,85,0.4)' }}>{s.quality}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GrowthPage() {
  return (
    <ErrorBoundary>
      <GrowthPageInner />
    </ErrorBoundary>
  );
}

function GrowthPageInner() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showInherit, setShowInherit] = useState(false);
  const [inheritConfirm, setInheritConfirm] = useState('');
  const [showInheritResult, setShowInheritResult] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [backendValues, setBackendValues] = useState<ValueSignal[]>([]);
  const [backendTrend, setBackendTrend] = useState('');

  useEffect(() => {
    try {
      const u = getUser();
      if (!u) { router.replace('/onboarding'); return; }
      setUser(u);
      setMemories(getMemories());
      setLoaded(true);
    } catch (e) {
      console.error('GrowthPage load error:', e);
      setLoaded(true);
    }
    // Sync memories from backend, then fetch Layer3 analysis
    syncMemoriesFromBackend().then(() => {
      setMemories(getMemories());
      // Fetch Layer3 value analysis from backend
      fetchBackendValueAnalysis().then(analysis => {
        if (analysis && analysis.values.length > 0) {
          setBackendValues(analysis.values);
          setBackendTrend(analysis.trend);
        }
      });
    });
  }, [router]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const temperament = useMemo(() => {
    try { return getTemperamentFromMemories(memories) || []; } catch { return []; }
  }, [memories]);
  const intelligence = useMemo(() => {
    try { return getIntelligenceFromMemories(memories) || []; } catch { return []; }
  }, [memories]);
  const development = useMemo(() => {
    try { return getDevelopmentFromMemories(); } catch { return null; }
  }, []);
  const emotionalPatterns = useMemo(() => {
    try { return getEmotionalPatternsFromMemories(memories) || []; } catch { return []; }
  }, [memories]);
  const growth = useMemo(() => {
    try { return getGrowthStage(memories.length); } catch { return { label: '萌芽期', icon: '🌱' }; }
  }, [memories.length]);
  const twinProgress = useMemo(() => {
    try { return getDigitalTwinProgress(memories.length); } catch { return { percent: 0, label: '播种', nextLevel: 5 }; }
  }, [memories.length]);

  const valueSeeds = useMemo(() => {
    // Prefer backend Layer3 value signals
    if (backendValues.length > 0) {
      return backendValues.map(v => v.label_cn || v.value);
    }
    try {
      const seeds = new Set<string>();
      memories.forEach(m => {
        const c = m?.content || '';
        if (/分享|帮助|保护|安慰/.test(c)) seeds.add('共情力');
        if (/坚持|练习|重复/.test(c)) seeds.add('坚韧');
        if (/为什么|好奇|研究/.test(c)) seeds.add('好奇心');
        if (/自己|独立|我来/.test(c)) seeds.add('自主性');
        if (/勇敢|不怕/.test(c)) seeds.add('勇气');
        if (/朋友|友谊|一起/.test(c)) seeds.add('社交力');
        if (/创造|画|做/.test(c)) seeds.add('创造力');
        if (/爱|抱抱|温暖/.test(c)) seeds.add('爱的能力');
      });
      return Array.from(seeds);
    } catch { return []; }
  }, [memories, backendValues]);

  const valueSeedMemories = useMemo(() => {
    try {
      const map: Record<string, Memory[]> = {};
      const patterns: [RegExp, string][] = [
        [/分享|帮助|保护|安慰/, '共情力'],
        [/坚持|练习|重复/, '坚韧'],
        [/为什么|好奇|研究/, '好奇心'],
        [/自己|独立|我来/, '自主性'],
        [/勇敢|不怕/, '勇气'],
        [/朋友|友谊|一起/, '社交力'],
        [/创造|画|做/, '创造力'],
        [/爱|抱抱|温暖/, '爱的能力'],
      ];
      memories.forEach(m => {
        const c = m?.content || '';
        patterns.forEach(([regex, seed]) => {
          if (regex.test(c)) {
            if (!map[seed]) map[seed] = [];
            map[seed].push(m);
          }
        });
      });
      return map;
    } catch { return {}; }
  }, [memories]);

  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);

  const milestones = useMemo(() => {
    try {
      return memories.filter(m => m?.tags?.includes('里程碑')).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
    } catch { return []; }
  }, [memories]);

  const handleInherit = () => {
    if (inheritConfirm !== user?.childName) {
      showToast('请输入准确的孩子名字', 'error');
      return;
    }
    inheritAccount();
    setShowInheritResult(true);
    showToast('账户已继承给' + user?.childName);
  };

  if (!loaded || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #F5EFD8 0%, #F0E8CC 50%, #F5EFE0 100%)' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: GOLD, borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'rgba(139,123,85,0.5)' }}>加载成长记录中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #F5EFD8 0%, #F0E8CC 20%, #F8F2E0 40%, #F5EFE0 60%, #EFF2E8 80%, #F0EAD8 100%)' }}>
      <div className="ghibli-cloud animate-cloud-drift" style={{ width: 200, height: 120, top: '5%', left: '5%', background: 'rgba(255,255,255,0.35)' }} />
      <div className="ghibli-cloud animate-float-slow" style={{ width: 160, height: 100, bottom: '10%', right: '5%', background: 'rgba(196,163,90,0.08)' }} />

      <div className="relative md:pl-20 pb-24 md:pb-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full overflow-hidden shadow-md flex items-center justify-center"
              style={{ width: 48, height: 48, boxShadow: '0 2px 8px rgba(196,163,90,0.2)' }}>
              <ParticleAvatar growth={0.75} size={48} animate={true} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: TEXT_MAIN }}>{user.childName}的成长</h1>
              <p className="text-xs" style={{ color: 'rgba(139,123,85,0.6)' }}>
                {getChildAgeString(user.childBirthday)} · {memories.length}条回忆 · {user.role === 'child' ? '孩子视角' : '家长视角'}
              </p>
            </div>
          </div>

          {/* Module 1: Twin Progress */}
          <div className="rounded-2xl p-4 mb-3 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.15)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold" style={{ color: TEXT_MAIN }}>
                数字分身 · {twinProgress.label}
              </span>
              <span className="text-xs" style={{ color: 'rgba(139,123,85,0.5)' }}>{twinProgress.percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(139,123,85,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${twinProgress.percent}%`, background: 'linear-gradient(90deg, #D4C88E, #C4A35A, #7B9E89)' }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(139,123,85,0.3)' }}>
              {twinProgress.percent < 100
                ? `再投喂 ${twinProgress.nextLevel - memories.length} 条回忆，分身将进入下一阶段`
                : '数字分身已完全成形！'}
            </p>
          </div>

          {/* Module 2: Temperament Bars */}
          {temperament.length > 0 && (
            <DimensionBars
              data={temperament.map(t => ({ label: t.dimension, score: t.score, evidence: t.evidence }))}
              title="人格底色 · 气质九维度"
              color={GOLD}
              memories={memories}
            />
          )}

          {/* Module 3: Intelligence Bars */}
          {intelligence.length > 0 && (
            <DimensionBars
              data={intelligence.map(i => ({ label: i.type, score: i.score, evidence: i.evidence }))}
              title="天赋潜能 · 多元智能"
              color={GREEN}
              memories={memories}
            />
          )}

          {/* Module 4: Development Timeline */}
          {development && (
            <StageTimeline stages={[
              ...development.previousStages,
              { stage: development.currentStage, age: development.currentAge, quality: development.quality, status: 'current' },
            ]} />
          )}

          {/* Module 5: Time Distribution */}
          <div className="rounded-2xl p-4 mb-3 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.15)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: TEXT_MAIN }}>五种时间分布</h3>
            <div className="grid grid-cols-5 gap-2 mb-1">
              {CHILDREN_FIVE_TIMES.map(t => {
                const count = memories.filter(m => (m?.timeTypes || []).includes(t.value)).length;
                const percent = memories.length > 0 ? Math.round((count / memories.length) * 100) : 0;
                const color = timeTypeColors[t.value] || '#B5A598';
                return (
                  <div key={t.value} className="flex flex-col items-center gap-1">
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[9px] text-center" style={{ color: 'rgba(139,123,85,0.6)' }}>{t.label}</span>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(139,123,85,0.1)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Module 6: Emotional Patterns */}
          {emotionalPatterns.length > 0 && (
            <div className="rounded-2xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(196,163,90,0.12)' }}>
              <h3 className="text-xs font-bold mb-2" style={{ color: TEXT_MAIN }}>
                <span className="inline-block w-1.5 h-3 rounded-full mr-1.5 align-middle" style={{ background: `linear-gradient(180deg, ${PINK}, ${BLUE}, ${GOLD}, ${GREEN})` }} />
                情绪模式
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {emotionalPatterns.map((ep, i) => {
                  const c = emotionColors[i % emotionColors.length];
                  const bg = emotionBgs[i % emotionBgs.length];
                  return (
                    <div key={i} className="rounded-xl px-2.5 py-1.5 relative overflow-hidden" style={{ background: bg, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                        <span className="text-[10px] font-medium leading-tight" style={{ color: c }}>{ep.trigger}</span>
                        <span className="text-[8px] ml-auto flex-shrink-0" style={{ color: 'rgba(139,123,85,0.35)' }}>{ep.frequency}</span>
                      </div>
                      <p className="text-[9px] leading-snug" style={{ color: 'rgba(139,123,85,0.6)' }}>{ep.response}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Module 7: Milestones */}
          {milestones.length > 0 && (
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.15)' }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: TEXT_MAIN }}>成长里程碑</h3>
              <div className="space-y-2">
                {milestones.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-start gap-2 rounded-xl p-2" style={{ background: 'rgba(255,251,240,0.4)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={GOLD} className="mt-0.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <div>
                      <p className="text-[10px]" style={{ color: 'rgba(139,123,85,0.4)' }}>{m.date}</p>
                      <p className="text-xs" style={{ color: TEXT_MAIN }}>{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Module 8: Value Seeds */}
          {valueSeeds.length > 0 && (
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.15)' }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: TEXT_MAIN }}>
                价值种子
                {backendValues.length > 0 && (
                  <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(123,158,137,0.15)', color: GREEN }}>AI深度分析</span>
                )}
              </h3>
              <p className="text-[10px] mb-2" style={{ color: 'rgba(139,123,85,0.3)' }}>点击词条查看对应的回忆记录</p>
              {backendTrend && (
                <p className="text-[10px] mb-2 leading-relaxed p-2 rounded-xl" style={{ background: 'rgba(212,200,142,0.08)', color: 'rgba(139,123,85,0.6)' }}>
                  {backendTrend}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {valueSeeds.map((seed, i) => {
                  const bv = backendValues[i];
                  const count = bv ? (bv.evidence?.length || 0) : (valueSeedMemories[seed]?.length || 0);
                  const conf = bv?.confidence;
                  return (
                    <span key={i}
                      className="px-2.5 py-1 rounded-xl text-xs border cursor-pointer transition-all hover:shadow-md"
                      style={{ borderColor: 'rgba(196,163,90,0.25)', backgroundColor: 'rgba(212,200,142,0.15)', color: TEXT_MAIN }}
                      onClick={() => setSelectedSeed(seed)}>
                      {seed}
                      <span className="ml-1 text-[9px]" style={{ color: conf ? GREEN : 'rgba(139,123,85,0.3)' }}>
                        {conf ? `${Math.round(conf * 100)}%` : `(${count})`}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Value Seed Detail Modal */}
          {selectedSeed && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              onClick={() => setSelectedSeed(null)}>
              <div className="rounded-2xl p-5 max-w-md w-full max-h-[70vh] overflow-y-auto"
                style={{ background: 'linear-gradient(180deg, #FFFBF0, #F5EFD8)', border: '1px solid rgba(196,163,90,0.2)', boxShadow: '0 8px 32px rgba(196,163,90,0.15)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold" style={{ color: TEXT_MAIN }}>{selectedSeed}</h3>
                  <button
                    onClick={() => setSelectedSeed(null)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: 'rgba(196,163,90,0.1)', color: TEXT_SUB }}>
                    ✕
                  </button>
                </div>
                <div className="space-y-2">
                  {(() => {
                    // Find matching backend value for evidence
                    const bv = backendValues.find(v => (v.label_cn || v.value) === selectedSeed);
                    if (bv && bv.evidence && bv.evidence.length > 0) {
                      return (
                        <>
                          {bv.confidence !== undefined && (
                            <p className="text-[10px] mb-2" style={{ color: GREEN }}>
                              置信度: {Math.round(bv.confidence * 100)}%
                              {bv.confidence_label ? ` (${bv.confidence_label})` : ''}
                            </p>
                          )}
                          {bv.supporting_behaviors && bv.supporting_behaviors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {bv.supporting_behaviors.map((b, bi) => (
                                <span key={bi} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(123,158,137,0.1)', color: GREEN }}>{b}</span>
                              ))}
                            </div>
                          )}
                          {bv.evidence.map((ev, ei) => (
                            <div key={ei} className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                              <p className="text-[10px] mb-1" style={{ color: 'rgba(139,123,85,0.4)' }}>证据 {ei + 1}</p>
                              <p className="text-xs leading-relaxed" style={{ color: TEXT_MAIN }}>{ev}</p>
                            </div>
                          ))}
                        </>
                      );
                    }
                    // Fall back to regex-matched memories
                    const matched = valueSeedMemories[selectedSeed] || [];
                    if (matched.length === 0) {
                      return <p className="text-xs" style={{ color: 'rgba(139,123,85,0.3)' }}>暂无匹配的回忆</p>;
                    }
                    return matched.map((m, i) => (
                      <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                        <p className="text-[10px] mb-1" style={{ color: 'rgba(139,123,85,0.4)' }}>{m.date}</p>
                        <p className="text-xs" style={{ color: TEXT_MAIN }}>{m.content}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Module 9: Inherit Entry */}
          {user.role === 'parent' && (
            <div className="rounded-2xl p-4 mb-3 border"
              style={{ background: 'linear-gradient(135deg, rgba(212,200,142,0.15), rgba(255,251,240,0.2))', borderColor: 'rgba(196,163,90,0.2)' }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: TEXT_MAIN }}>孪生继承</h3>
              <p className="text-xs mb-3" style={{ color: 'rgba(139,123,85,0.5)' }}>
                当{user.childName}准备好时，可以接手自己的数字孪生体，获得第一人称视角。
              </p>
              <button
                onClick={() => setShowInherit(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:shadow-lg"
                style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}
              >
                预览继承体验 →
              </button>
            </div>
          )}

          {user.role === 'child' && (
            <div className="rounded-2xl p-4 mb-3 border"
              style={{ background: 'linear-gradient(135deg, rgba(123,158,137,0.15), rgba(255,251,240,0.2))', borderColor: 'rgba(123,158,137,0.2)' }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: TEXT_MAIN }}>已继承</h3>
              <p className="text-xs" style={{ color: 'rgba(139,123,85,0.5)' }}>
                你已从{user.inheritedFrom || '家长'}那里接手了你的数字孪生体。
                {user.inheritedAt && ` 继承时间：${new Date(user.inheritedAt).toLocaleDateString('zh-CN')}`}
              </p>
            </div>
          )}

          <p className="text-[10px] text-center mt-4 leading-relaxed" style={{ color: 'rgba(139,123,85,0.2)' }}>
            探觅保护每一个孩子的数据。所有记录归监护人所有，孩子具备自主能力后可申请继承。
          </p>
        </div>
      </div>

      {/* Inherit Modal */}
      {showInherit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-sm p-4" onClick={() => setShowInherit(false)}>
          <div className="rounded-2xl w-full max-w-md p-6 border" style={{ background: BG_CARD, borderColor: 'rgba(196,163,90,0.2)' }} onClick={e => e.stopPropagation()}>
            {!showInheritResult ? (
              <>
                <h2 className="text-lg font-bold mb-2" style={{ color: TEXT_MAIN }}>继承确认</h2>
                <p className="text-sm mb-4" style={{ color: 'rgba(139,123,85,0.6)' }}>
                  继承意味着数据所有权从监护人转移给{user.childName}本人。
                  操作不可逆，{user.childName}将以第一人称视角使用孪生体。
                </p>
                <p className="text-xs mb-2" style={{ color: 'rgba(139,123,85,0.5)' }}>请输入孩子名字以确认：</p>
                <input
                  type="text"
                  value={inheritConfirm}
                  onChange={e => setInheritConfirm(e.target.value)}
                  placeholder={user.childName}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-4"
                  style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(196,163,90,0.2)', color: TEXT_MAIN }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowInherit(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                    style={{ borderColor: 'rgba(196,163,90,0.2)', color: 'rgba(139,123,85,0.6)' }}>
                    取消
                  </button>
                  <button onClick={handleInherit}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}>
                    确认继承
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #D4C88E, #7B9E89)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold mb-1" style={{ color: TEXT_MAIN }}>继承成功</h2>
                <p className="text-sm" style={{ color: 'rgba(139,123,85,0.6)' }}>{user.childName}已获得数字孪生体</p>
                <button onClick={() => router.push('/mirror')}
                  className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium text-white"
                  style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}>
                  查看回忆面板 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-lg"
          style={{ background: toast.type === 'error' ? '#C47A5A' : 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}>
          {toast.msg}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
