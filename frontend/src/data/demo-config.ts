/**
 * 演示数据配置 —— 改这一行即可切换演示数据集
 *
 * 'life'   → 人生决策版 (0-22岁, 40条)  ← 黑客松核心 Demo (上海工作问题)
 * 'child'  → 儿童成长版 (0-7岁, 30条)   → Demo 1 (人格雏形)
 *
 * 想改演示数据：直接编辑 src/data/demo-life.json 或 demo-child.json
 * 想切换数据集：把下面这行的值改掉即可
 */
export const DEMO_DATASET: 'life' | 'child' = 'life';

export const DEMO_LABELS: Record<'life' | 'child', { title: string; subtitle: string }> = {
  life: {
    title: '人生决策版 (0-22岁)',
    subtitle: '支持职业/迁移/教育等人生决策分析',
  },
  child: {
    title: '儿童成长版 (0-7岁)',
    subtitle: '展示人格雏形与早期兴趣来源',
  },
};

import demoLifeData from './demo-life.json';
import demoChildData from './demo-child.json';

export { demoLifeData, demoChildData };

export function getDemoData() {
  return DEMO_DATASET === 'life' ? demoLifeData : demoChildData;
}
