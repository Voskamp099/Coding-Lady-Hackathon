'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { ParticleAvatar } from '@/components/particle-avatar';
import {
  getUser, saveMemory, saveMemories, getMemories, generateId, Memory,
  CHILDREN_FIVE_TIMES, EMOTION_OPTIONS, SCENE_OPTIONS,
  UserProfile, TimeTypeKey,
  getChildAgeString, getDigitalTwinProgress, getRecentMemories,
  syncMemoriesFromBackend, syncMemoryToBackend, clearAllData,
  getCurrentIdentity, logoutUser,
} from '@/lib/store';
import { parseExcelFile, downloadTemplate, parsedRowsToMemories } from '@/lib/excel-utils';
import { DEMO_LABELS, DemoDatasetKey } from '@/data/demo-config';

const GOLD = '#C4A35A';
const GOLD_LIGHT = '#D4C88E';
const GOLD_DEEP = '#A88B3E';
const GREEN = '#7B9E89';
const GREEN_LIGHT = '#A3B599';
const TEXT_MAIN = '#5B4A2E';
const TEXT_SUB = '#8B7B55';
const CARD_BG = 'rgba(255,251,240,0.72)';
const CARD_BORDER = 'rgba(196,163,90,0.15)';

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [timeType, setTimeType] = useState<TimeTypeKey[]>([]);
  const [emotion, setEmotion] = useState('开心');
  const [scene, setScene] = useState('家');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autoClassifying, setAutoClassifying] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showSeedling, setShowSeedling] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{ valid: Memory[]; errors: { row: number; msg: string }[] } | null>(null);
  const [showClear, setShowClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [backendCount, setBackendCount] = useState<number | null>(null);
  const [importingDemo, setImportingDemo] = useState(false);
  const [showDemoSelect, setShowDemoSelect] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/onboarding'); return; }
    setUser(u);
    setMemories(getMemories());
    // Sync memories from backend on load
    syncMemoriesFromBackend().then(n => {
      if (n > 0) {
        setMemories(getMemories());
        setBackendCount(n);
      }
    });
  }, [router]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!content.trim()) { showToast('请写点什么', 'error'); return; }
    if (content.length > 500) { showToast('内容不超过500字', 'error'); return; }
    setSubmitting(true);
    const memory: Memory = {
      id: generateId(),
      date,
      content: content.trim(),
      timeTypes: timeType,
      emotion,
      scene,
      tags: tagsInput.split(/[,，\s]+/).filter(Boolean),
      type: 'text',
      createdAt: new Date().toISOString(),
      author: 'parent',
    };
    saveMemory(memory);
    // Sync to Python backend (Agent 1 extraction pipeline) — non-blocking
    syncMemoryToBackend(memory);
    setMemories(getMemories());
    setContent('');
    setTimeType([]);
    setEmotion('');
    setScene('');
    setTagsInput('');
    setSubmitting(false);
    showToast('回忆已投喂', 'success');
    // Show seedling growth animation
    setShowSeedling(true);
    setTimeout(() => setShowSeedling(false), 2500);
  }, [content, date, timeType, emotion, scene, tagsInput, showToast]);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseExcelFile(file);
      const valid = parsedRowsToMemories(rows);
      const errors = rows.filter(r => !r.success).map(r => ({ row: r.rowNumber, msg: r.error || '格式错误' }));
      setImportResult({ valid, errors });
    } catch (err: any) {
      showToast('导入失败：' + (err.message || '文件格式错误'), 'error');
    }
  }, [showToast]);

  const confirmImport = useCallback(async () => {
    if (!importResult) return;
    saveMemories(importResult.valid);
    setMemories(getMemories());
    setImportResult(null);
    setShowImport(false);
    showToast(`正在同步 ${importResult.valid.length} 条回忆到云端...`);
    // Sync to backend DB with child_name (instant, no LLM)
    try {
      const { importBatchData } = await import('@/lib/backend');
      const result = await importBatchData(
        importResult.valid.map(m => ({
          id: m.id,
          date: m.date,
          content: m.content,
          timeTypes: m.timeTypes,
          emotion: m.emotion,
          scene: m.scene,
          tags: m.tags,
        })),
        user?.childName ? getCurrentIdentity() : undefined
      );
      if (result.success) {
        const { syncMemoriesFromBackend } = await import('@/lib/store');
        await syncMemoriesFromBackend();
        setMemories(getMemories());
        setBackendCount(result.total || null);
        showToast(`成功导入 ${result.imported} 条回忆`, 'success');
      } else {
        showToast(result.message || '云端同步失败，数据已保存在本地', 'error');
      }
    } catch {
      showToast('云端同步失败，数据已保存在本地', 'error');
    }
  }, [importResult, showToast, user]);

  const handleAutoClassify = useCallback(async () => {
    if (!content.trim() || !user) return;
    setAutoClassifying(true);
    try {
      const res = await fetch('/api/classify-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content.trim() }),
      });
      const data = await res.json();
      const matchedType = data.type;
      const matchedLabel = data.label;
      if (matchedType && CHILDREN_FIVE_TIMES.find(t => t.value === matchedType)) {
        if (!timeType.includes(matchedType as TimeTypeKey)) {
          setTimeType(prev => [...prev, matchedType as TimeTypeKey]);
        }
        showToast(`识别为：${matchedLabel}`);
      } else {
        showToast('无法确定分类，请手动选择', 'error');
      }
    } catch {
      showToast('分类失败，请重试', 'error');
    }
    setAutoClassifying(false);
  }, [content, user, timeType, showToast]);

  const handleClearData = useCallback(async () => {
    setClearing(true);
    try {
      await clearAllData();
      setMemories(getMemories());
      setBackendCount(null);
      showToast('数据已清空', 'success');
    } catch {
      showToast('清空失败，请重试', 'error');
    }
    setClearing(false);
    setShowClear(false);
  }, [showToast]);

  const handleImportDemo = useCallback(async (datasetKey: 'life' | 'child') => {
    setImportingDemo(true);
    setShowDemoSelect(false);
    try {
      const { getDemoData, DEMO_LABELS } = await import('@/data/demo-config');
      const records = getDemoData(datasetKey) as Record<string, any>[];
      const { importDemoData } = await import('@/lib/backend');
      const result = await importDemoData(records, true, getCurrentIdentity());
      if (result.success) {
        const { syncMemoriesFromBackend } = await import('@/lib/store');
        await syncMemoriesFromBackend();
        setMemories(getMemories());
        setBackendCount(result.total || null);
        showToast(`已导入 ${DEMO_LABELS[datasetKey].title}（${result.imported} 条）`, 'success');
      } else {
        showToast(result.message || '导入失败', 'error');
      }
    } catch (err: any) {
      showToast('导入失败：' + (err.message || '未知错误'), 'error');
    }
    setImportingDemo(false);
  }, [showToast, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #F5EFD8 0%, #F0E8CC 20%, #F8F2E0 40%, #F5EFE0 60%, #EFF2E8 80%, #F0EAD8 100%)' }}>
      <div className="ghibli-cloud animate-cloud-drift" style={{ width: 180, height: 100, top: '5%', left: '5%', background: 'rgba(255,255,255,0.35)' }} />
      <div className="ghibli-cloud animate-float-slow" style={{ width: 140, height: 90, top: '50%', right: '3%', background: 'rgba(196,163,90,0.08)' }} />

      <div className="relative max-w-2xl mx-auto px-4 pb-24 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold mb-1" style={{ color: TEXT_MAIN }}>投喂时光</h1>
            <p className="text-xs" style={{ color: 'rgba(139,123,85,0.6)' }}>
              {user.childName} · {getChildAgeString(user.childBirthday)} · 已有{memories.length}条回忆
            </p>
            {/* Progress Bar */}
            {(() => {
              const progress = getDigitalTwinProgress(memories.length);
              return (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[9px] mb-0.5" style={{ color: 'rgba(139,123,85,0.5)' }}>
                    <span>{progress.label}</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(139,123,85,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progress.percent}%`, background: 'linear-gradient(90deg, #D4C88E, #C4A35A, #7B9E89)' }} />
                  </div>
                  {progress.percent < 100 && (
                    <p className="text-[8px] mt-0.5" style={{ color: 'rgba(139,123,85,0.3)' }}>
                      再投喂 {progress.nextLevel - memories.length} 条回忆，分身将进入下一阶段
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <button
              onClick={() => setShowImport(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              style={{ background: 'rgba(212,200,142,0.25)', borderColor: 'rgba(196,163,90,0.2)', color: TEXT_MAIN }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
              批量导入
            </button>
            <button
              onClick={() => setShowDemoSelect(true)}
              disabled={importingDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50"
              style={{ background: 'rgba(123,158,137,0.15)', borderColor: 'rgba(123,158,137,0.3)', color: '#5C7A68' }}
              title="选择演示数据集，一键导入"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {importingDemo ? '导入中...' : '演示数据'}
            </button>
            <button
              onClick={() => setShowClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              style={{ background: 'rgba(196,99,88,0.08)', borderColor: 'rgba(196,99,88,0.2)', color: '#C46358' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
              清空
            </button>
            <button
              onClick={() => setShowAccount(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              style={{ background: 'rgba(212,200,142,0.2)', borderColor: 'rgba(196,163,90,0.2)', color: TEXT_MAIN }}
              title="账户信息 / 切换账户"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {user.parentName}
            </button>
            <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm" style={{ background: 'rgba(255,251,240,0.4)' }}>
              <ParticleAvatar growth={Math.min(1, memories.length / 50)} size={36} />
            </div>
          </div>
        </div>

        {/* Input Card */}
        <div className="rounded-2xl p-4 mb-4 border" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm border mb-3 focus:outline-none transition-all"
            style={{ background: 'rgba(255,251,240,0.5)', color: TEXT_MAIN, borderColor: CARD_BORDER }}
          />

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs" style={{ color: 'rgba(139,123,85,0.6)' }}>时间类型（可多选）</label>
              <button
                onClick={handleAutoClassify}
                disabled={autoClassifying || !content.trim()}
                className="text-[10px] px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                style={{ background: 'rgba(212,200,142,0.35)', color: TEXT_MAIN }}
              >
                {autoClassifying ? '分析中...' : 'AI 帮我分类'}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {CHILDREN_FIVE_TIMES.map(t => {
                const isSelected = timeType.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      if (isSelected) {
                        setTimeType(timeType.filter(v => v !== t.value));
                      } else {
                        setTimeType([...timeType, t.value]);
                      }
                    }}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-medium transition-all ${
                      isSelected ? 'ring-2 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: isSelected ? t.color + '40' : 'rgba(255,255,255,0.3)',
                      borderColor: t.color,
                      borderWidth: 1.5,
                    }}
                  >
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[10px] leading-tight text-center">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {timeType.length > 0 && (
              <p className="text-[10px] mt-1" style={{ color: 'rgba(139,123,85,0.5)' }}>
                已选: {timeType.map(v => CHILDREN_FIVE_TIMES.find(t => t.value === v)?.label).filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgba(139,123,85,0.6)' }}>情绪</label>
              <select value={emotion} onChange={(e) => setEmotion(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none transition-all"
                style={{ background: 'rgba(255,251,240,0.5)', color: TEXT_MAIN, borderColor: CARD_BORDER }}>
                {EMOTION_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgba(139,123,85,0.6)' }}>场景</label>
              <select value={scene} onChange={(e) => setScene(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none transition-all"
                style={{ background: 'rgba(255,251,240,0.5)', color: TEXT_MAIN, borderColor: CARD_BORDER }}>
                {SCENE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="今天发生了什么？写下来吧..."
            maxLength={500}
            rows={3}
            className="w-full rounded-xl px-3 py-2 text-sm border resize-none focus:outline-none transition-all"
            style={{ background: 'rgba(255,251,240,0.4)', color: TEXT_MAIN, borderColor: CARD_BORDER }}
          />

          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="自定义标签（用逗号分隔）"
            className="w-full rounded-xl px-3 py-2 text-sm border mt-3 focus:outline-none transition-all"
            style={{ background: 'rgba(255,251,240,0.5)', color: TEXT_MAIN, borderColor: CARD_BORDER }}
          />

          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="w-full mt-3 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40 hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}
          >
            {submitting ? '投喂中...' : '投喂回忆'}
          </button>
        </div>

        {/* Empty State or Recent Memories */}
        {memories.length === 0 ? (
          <div className="text-center py-8 animate-soft-fade">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(212,200,142,0.15)' }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 28 C16 28, 6 22, 6 14 C6 10, 9 7, 13 7 C14.5 7, 15.5 7.5, 16 8.5 C16.5 7.5, 17.5 7, 19 7 C23 7, 26 10, 26 14 C26 22, 16 28, 16 28 Z" fill="#C4A35A" opacity="0.3" />
                <path d="M16 26 L16 16 M16 16 C16 12, 13 10, 10 11 M16 16 C16 12, 19 10, 22 11" stroke="#7B9E89" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                <circle cx="16" cy="9" r="2" fill="#D4C88E" opacity="0.6" />
              </svg>
            </div>
            <h2 className="text-base font-semibold mb-1" style={{ color: TEXT_MAIN }}>还没有回忆记录</h2>
            <p className="text-xs mb-5" style={{ color: 'rgba(139,123,85,0.5)' }}>
              为「{user.childName}」种下第一颗光种吧
            </p>
            <div className="flex gap-3 max-w-xs mx-auto">
              <button
                onClick={() => setShowDemoSelect(true)}
                disabled={importingDemo}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium disabled:opacity-50 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #7B9E89, #A3B599)' }}
              >
                {importingDemo ? '导入中...' : '导入示例数据'}
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium border transition-all active:scale-95"
                style={{ background: 'rgba(212,200,142,0.2)', borderColor: 'rgba(196,163,90,0.3)', color: TEXT_MAIN }}
              >
                上传我的数据
              </button>
            </div>
            <p className="text-[10px] mt-4" style={{ color: 'rgba(139,123,85,0.35)' }}>
              或在上方手动写下第一条回忆
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium" style={{ color: TEXT_MAIN }}>最近投喂</h2>
              <button
                onClick={() => router.push('/mirror')}
                className="text-[10px] underline underline-offset-2"
                style={{ color: 'rgba(139,123,85,0.5)' }}
              >
                查看全部 →
              </button>
            </div>
            {getRecentMemories(memories, 3).map(m => {
              const primaryType = m.timeTypes?.[0];
              const t = primaryType ? CHILDREN_FIVE_TIMES.find(t => t.value === primaryType) : undefined;
              return (
                <div key={m.id} className="rounded-xl p-3 border" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs">{t?.icon}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(139,123,85,0.5)' }}>{m.date}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: t?.color + '30' }}>{t?.label}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(139,123,85,0.5)' }}>{m.emotion}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(139,123,85,0.5)' }}>{m.scene}</span>
                  </div>
                  <p className="text-sm leading-relaxed line-clamp-2" style={{ color: TEXT_MAIN }}>{m.content}</p>
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {m.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,123,85,0.1)', color: 'rgba(139,123,85,0.6)' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-center mt-6 leading-relaxed" style={{ color: 'rgba(139,123,85,0.3)' }}>
          探觅保护每一个孩子的数据。所有记录归监护人所有，孩子具备自主能力后可申请继承。数据可随时导出或删除。
        </p>
      </div>

      {/* Seedling growth animation overlay */}
      {showSeedling && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            {/* Growing seedling SVG */}
            <svg width="80" height="100" viewBox="0 0 80 100" className="animate-breathe">
              {/* Pot */}
              <path d="M25 75 L55 75 L50 95 L30 95 Z" fill="#A88B3E" opacity="0.8" />
              {/* Soil */}
              <ellipse cx="40" cy="75" rx="15" ry="3" fill="#5B4A2E" opacity="0.6" />
              {/* Stem - grows upward */}
              <path d="M40 75 Q38 60 40 45 Q42 35 40 25" stroke="#7B9E89" strokeWidth="2.5" fill="none" strokeLinecap="round">
                <animate attributeName="stroke-dasharray" from="0 100" to="100 0" dur="1.5s" fill="freeze" />
              </path>
              {/* Left leaf */}
              <ellipse cx="28" cy="45" rx="10" ry="5" fill="#7B9E89" opacity="0" transform="rotate(-30 28 45)">
                <animate attributeName="opacity" from="0" to="0.85" begin="0.5s" dur="0.8s" fill="freeze" />
                <animateTransform attributeName="transform" type="rotate" from="-60 28 45" to="-30 28 45" begin="0.5s" dur="0.8s" fill="freeze" />
              </ellipse>
              {/* Right leaf */}
              <ellipse cx="52" cy="35" rx="10" ry="5" fill="#A3B599" opacity="0" transform="rotate(30 52 35)">
                <animate attributeName="opacity" from="0" to="0.85" begin="0.8s" dur="0.8s" fill="freeze" />
                <animateTransform attributeName="transform" type="rotate" from="60 52 35" to="30 52 35" begin="0.8s" dur="0.8s" fill="freeze" />
              </ellipse>
              {/* Top bud */}
              <circle cx="40" cy="22" r="4" fill="#C4A35A" opacity="0">
                <animate attributeName="opacity" from="0" to="1" begin="1.2s" dur="0.5s" fill="freeze" />
                <animate attributeName="r" from="2" to="4" begin="1.2s" dur="0.5s" fill="freeze" />
              </circle>
              {/* Sparkles */}
              <circle cx="20" cy="30" r="1.5" fill="#D4C88E">
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.3s" repeatCount="2" />
              </circle>
              <circle cx="60" cy="20" r="1.5" fill="#D4C88E">
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.6s" repeatCount="2" />
              </circle>
              <circle cx="55" cy="50" r="1" fill="#D4C88E">
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.9s" repeatCount="2" />
              </circle>
            </svg>
            <p className="text-sm font-medium" style={{ color: GREEN }}>小苗又长高了一点</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[55] px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all"
          style={{ background: toast.type === 'success' ? 'rgba(123,158,137,0.92)' : 'rgba(168,139,62,0.92)', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm p-4" onClick={() => { setShowImport(false); setImportResult(null); }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 border" style={{ background: CARD_BG, borderColor: CARD_BORDER }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: TEXT_MAIN }}>批量导入</h2>

            {!importResult ? (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: 'rgba(139,123,85,0.7)' }}>上传 Excel 文件（.xlsx），批量导入回忆记录。</p>
                <button onClick={() => { downloadTemplate().catch(e => console.error('下载模板失败:', e)); }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border transition-colors"
                  style={{ background: 'rgba(212,200,142,0.25)', color: TEXT_MAIN, borderColor: 'rgba(196,163,90,0.2)' }}>
                  下载模板（含下拉菜单）
                </button>
                <div className="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer"
                  style={{ borderColor: 'rgba(196,163,90,0.2)' }}
                  onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls'; input.onchange = (e: any) => handleImportFile(e as any); input.click(); }}>
                  <p className="text-sm" style={{ color: 'rgba(139,123,85,0.5)' }}>点击上传文件</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(139,123,85,0.3)' }}>支持 .xlsx 格式</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: GREEN }}>有效 {importResult.valid.length} 条</span>
                  {importResult.errors.length > 0 && <span className="text-sm" style={{ color: GOLD_DEEP }}>无效 {importResult.errors.length} 条</span>}
                </div>
                {importResult.valid.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.valid.slice(0, 10).map(m => (
                      <div key={m.id} className="text-xs rounded-lg p-2" style={{ background: 'rgba(255,251,240,0.4)', color: TEXT_MAIN }}>
                        <span style={{ color: 'rgba(139,123,85,0.5)' }}>{m.date}</span> · {m.content.slice(0, 40)}...
                      </div>
                    ))}
                    {importResult.valid.length > 10 && <p className="text-xs" style={{ color: 'rgba(139,123,85,0.3)' }}>...还有{importResult.valid.length - 10}条</p>}
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-[10px]" style={{ color: 'rgba(168,139,62,0.7)' }}>第{err.row}行：{err.msg}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setImportResult(null); }}
                    className="flex-1 py-2 rounded-xl text-sm border"
                    style={{ background: 'rgba(255,251,240,0.5)', color: 'rgba(139,123,85,0.6)', borderColor: CARD_BORDER }}>重新选择</button>
                  <button onClick={confirmImport}
                    disabled={importResult.valid.length === 0}
                    className="flex-1 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40"
                    style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}>
                    确认导入
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => { setShowImport(false); setImportResult(null); }}
              className="w-full mt-3 py-2 text-xs" style={{ color: 'rgba(139,123,85,0.4)' }}>取消</button>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation */}
      {showClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm p-4" onClick={() => !clearing && setShowClear(false)}>
          <div className="rounded-2xl w-full max-w-sm p-6 border" style={{ background: CARD_BG, borderColor: 'rgba(196,99,88,0.2)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2" style={{ color: TEXT_MAIN }}>清空当前账户数据</h2>
            <p className="text-sm mb-1" style={{ color: 'rgba(139,123,85,0.7)' }}>
              这将删除「{user.parentName}→{user.childName}」名下的所有记忆记录，不影响其他账户。
            </p>
            <p className="text-xs mb-4" style={{ color: 'rgba(196,99,88,0.6)' }}>
              ⚠️ 此操作不可逆。示例数据可随时重新导入。
            </p>
            {backendCount !== null && (
              <p className="text-xs mb-4" style={{ color: 'rgba(139,123,85,0.5)' }}>
                当前后端记忆数：{backendCount} 条
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowClear(false)}
                disabled={clearing}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border disabled:opacity-40"
                style={{ background: 'rgba(255,251,240,0.5)', color: 'rgba(139,123,85,0.6)', borderColor: CARD_BORDER }}>
                取消
              </button>
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
                style={{ background: 'linear-gradient(90deg, #C46358, #A05048)' }}>
                {clearing ? '清空中...' : '确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Account / Switch Account Modal */}
      {showAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm p-4" onClick={() => setShowAccount(false)}>
          <div className="rounded-2xl w-full max-w-sm p-6 border" style={{ background: CARD_BG, borderColor: CARD_BORDER }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: TEXT_MAIN }}>账户信息</h2>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(212,200,142,0.15)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #D4C88E, #C4A35A)' }}>
                  <span className="text-white text-sm font-bold">{user.parentName?.[0] || '?'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: TEXT_MAIN }}>{user.parentName}</p>
                  <p className="text-xs" style={{ color: 'rgba(139,123,85,0.5)' }}>守护者</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(123,158,137,0.1)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #A3B599, #7B9E89)' }}>
                  <span className="text-white text-sm font-bold">{user.childName?.[0] || '?'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: TEXT_MAIN }}>{user.childName}</p>
                  <p className="text-xs" style={{ color: 'rgba(139,123,85,0.5)' }}>{getChildAgeString(user.childBirthday)} · {memories.length}条回忆</p>
                </div>
              </div>
            </div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'rgba(139,123,85,0.4)' }}>
              切换账户会退出当前登录。数据按家长名+孩子名字安全保留，下次用同样的名字进入还能看到。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAccount(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                style={{ background: 'rgba(255,251,240,0.5)', color: 'rgba(139,123,85,0.6)', borderColor: CARD_BORDER }}
              >
                关闭
              </button>
              <button
                onClick={() => logoutUser()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}
              >
                切换账户
              </button>
            </div>
          </div>
        </div>
      )}
      {showDemoSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(91,74,46,0.45)' }} onClick={() => setShowDemoSelect(false)}>
          <div
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
            style={{ background: 'rgba(255,251,240,0.98)', border: `1px solid ${CARD_BORDER}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold" style={{ color: TEXT_MAIN }}>选择演示数据</h2>
              <button onClick={() => setShowDemoSelect(false)} className="text-xs" style={{ color: TEXT_SUB }}>取消</button>
            </div>
            <p className="text-xs mb-5" style={{ color: 'rgba(139,123,85,0.5)' }}>
              两套数据各有侧重，导入后可清空重来
            </p>
            <div className="space-y-3">
              {(['life', 'child'] as DemoDatasetKey[]).map(key => {
                const info = DEMO_LABELS[key];
                const isLife = key === 'life';
                return (
                  <button
                    key={key}
                    onClick={() => handleImportDemo(key)}
                    disabled={importingDemo}
                    className="w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: isLife ? 'rgba(123,158,137,0.10)' : 'rgba(196,163,90,0.10)',
                      borderColor: isLife ? 'rgba(123,158,137,0.35)' : 'rgba(196,163,90,0.35)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: TEXT_MAIN }}>{info.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: isLife ? 'rgba(123,158,137,0.2)' : 'rgba(196,163,90,0.2)', color: isLife ? GREEN : GOLD_DEEP }}>
                        {info.count} 条
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(139,123,85,0.6)' }}>{info.subtitle}</p>
                  </button>
                );
              })}
            </div>
            {importingDemo && (
              <p className="text-xs mt-4 text-center" style={{ color: TEXT_SUB }}>正在导入，请稍候…</p>
            )}
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
