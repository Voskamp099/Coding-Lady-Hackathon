/**
 * 演示数据配置 —— 两套数据集，用户可在投喂界面选择导入哪一套
 *
 * 'life'   → 人生决策版 (0-22岁, 40条)  ← 支持职业/迁移/教育等人生决策分析
 * 'child'  → 儿童成长版 (0-7岁, 30条)   → 展示人格雏形与早期兴趣来源
 */
export type DemoDatasetKey = 'life' | 'child';

export const DEMO_LABELS: Record<DemoDatasetKey, { title: string; subtitle: string; count: number }> = {
  life: {
    title: '人生决策版',
    subtitle: '0-22岁 · 支持职业/迁移/教育等人生决策分析',
    count: 40,
  },
  child: {
    title: '儿童成长版',
    subtitle: '0-7岁 · 展示人格雏形与早期兴趣来源',
    count: 30,
  },
};

import demoLifeData from './demo-life.json';
import demoChildData from './demo-child.json';

export { demoLifeData, demoChildData };

export function getDemoData(key?: DemoDatasetKey) {
  // 不传 key 时默认返回 life 版
  const k = key || 'life';
  return k === 'life' ? demoLifeData : demoChildData;
}
