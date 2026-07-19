/**
 * Backend API client — bridges the Next.js frontend to the Python FastAPI backend.
 *
 * Architecture:
 *   Frontend pages → backend.ts → Next.js API routes (/api/memories/*, /api/analysis/*)
 *                                        → Python FastAPI (localhost:8000)
 *
 * The Next.js API routes act as proxies, keeping the backend URL server-side only.
 */

import type { Memory, TimeTypeKey } from './store';

const BACKEND_BASE = '';  // relative URLs — proxied through Next.js API routes

/* ========== Type mappings ========== */

export interface BackendMemory {
  id: string;
  timestamp: string;
  event: string;
  raw_text?: string;
  behaviors: string[];
  emotion_patterns: string[];
  motivation?: string;
  learning_style?: string;
  social_behavior?: string;
  importance: number;
  metadata?: Record<string, any>;
}

export interface ValueSignal {
  value: string;
  label_cn?: string;
  confidence: number;
  confidence_label?: string;
  evidence: string[];
  supporting_behaviors?: string[];
}

export interface AnalysisResult {
  success: boolean;
  values: ValueSignal[];
  trend: string;
  message: string;
}

/* ========== Memory format conversion ========== */

/**
 * Convert a backend Memory (layered extraction) to the frontend Memory format.
 * The frontend expects: { id, date, content, timeTypes, emotion, scene, tags, type, createdAt }
 */
export function backendMemoryToFrontend(bm: BackendMemory): Memory {
  const meta = bm.metadata || {};
  // Prefer raw_text for display (richer), fall back to event
  const content = bm.raw_text || bm.event || '';
  // Extract date from timestamp (ISO string → YYYY-MM-DD)
  const date = (bm.timestamp || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  // Map behaviors → tags for display
  const tags = [...(bm.behaviors || []), ...(meta.tags || [])].slice(0, 8);
  // Map emotion_patterns → emotion (first one or from metadata)
  const emotion = meta.emotion || (bm.emotion_patterns?.[0] || '平静');
  // Scene from metadata
  const scene = meta.scene || '家';
  // TimeTypes from metadata
  const timeTypes: TimeTypeKey[] = meta.timeTypes || [];

  return {
    id: bm.id,
    date,
    content,
    timeTypes: timeTypes.length > 0 ? timeTypes : inferTimeTypes(content, tags),
    emotion,
    scene,
    tags,
    type: 'text',
    createdAt: bm.timestamp || new Date().toISOString(),
    author: 'parent',
  };
}

/** Infer time types from content keywords if metadata is missing. */
function inferTimeTypes(content: string, tags: string[]): TimeTypeKey[] {
  const text = (content + ' ' + tags.join(' ')).toLowerCase();
  const types: TimeTypeKey[] = [];
  if (/跑|跳|爬|运动|身体|健康|大运动/.test(text)) types.push('health');
  if (/玩|好奇|探索|发现|游戏|开心/.test(text)) types.push('play');
  if (/害怕|克服|困难|生病|认生|分离/.test(text)) types.push('survival');
  if (/成就|完成|学会|第一次|里程碑|成功/.test(text)) types.push('achievement');
  if (/专注|投入|忘我|沉浸|研究|认真/.test(text)) types.push('flow');
  return types.length > 0 ? types : ['play'];
}

/* ========== API calls (via Next.js proxy routes) ========== */

/**
 * Create a memory via Agent 1 (3-layer extraction pipeline).
 * Sends raw_text to Python backend, which runs Layer1+Layer2.
 */
export async function createMemoryBackend(
  content: string,
  date: string,
  emotion: string,
  scene: string,
  timeTypes: TimeTypeKey[],
  tags: string[]
): Promise<{ success: boolean; memory?: BackendMemory; message: string }> {
  try {
    const rawText = `时间：${date}\n场景：${scene}\n情绪：${emotion}\n记录：${content}`;
    const res = await fetch(`${BACKEND_BASE}/api/memories/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_text: rawText,
        metadata: {
          source: 'frontend',
          date,
          emotion,
          scene,
          timeTypes,
          tags,
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[backend] createMemory failed:', err);
    return { success: false, message: err.message || 'Backend unavailable' };
  }
}

/**
 * Fetch all memories from the backend DB.
 * Returns frontend-format Memory[] sorted newest-first.
 */
export async function fetchMemoriesFromBackend(): Promise<Memory[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/memories/list?limit=200`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.memories || data.memories.length === 0) return [];
    const memories = data.memories.map((bm: BackendMemory) => backendMemoryToFrontend(bm));
    // Sort newest first
    memories.sort((a: Memory, b: Memory) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return memories;
  } catch (err: any) {
    console.error('[backend] fetchMemories failed:', err);
    return [];
  }
}

/**
 * Clear the backend database (all memories + value analyses).
 */
export async function clearBackendDB(): Promise<{ success: boolean; cleared?: any }> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/memories/clear`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, cleared: data.cleared };
  } catch (err: any) {
    console.error('[backend] clearDB failed:', err);
    return { success: false };
  }
}

/**
 * Run Layer3 value synthesis on the backend and get the analysis result.
 */
export async function fetchAnalysisFromBackend(): Promise<AnalysisResult | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/analysis/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'all' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[backend] fetchAnalysis failed:', err);
    return null;
  }
}

/**
 * Get memory count from backend.
 */
export async function getBackendMemoryCount(): Promise<number> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/memories/count`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.count || 0;
  } catch (err: any) {
    console.error('[backend] getCount failed:', err);
    return 0;
  }
}

/* ========== Demo data import ========== */

/**
 * One-click import demo data into the backend (no LLM, instant).
 * Judges click once → all memories populated → can chat immediately.
 */
export async function importDemoData(
  records: Record<string, any>[],
  clearFirst = true
): Promise<{ success: boolean; imported?: number; skipped?: number; total?: number; message?: string }> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/memories/import-demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, clear_first: clearFirst }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[backend] importDemo failed:', err);
    return { success: false, message: err.message || 'Backend unavailable' };
  }
}

/* ========== Health check ========== */

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/memories/test`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
