'use client';

import {
  fetchMemoriesFromBackend,
  createMemoryBackend,
  clearBackendDB,
  fetchAnalysisFromBackend,
  getBackendMemoryCount,
  type ValueSignal,
} from './backend';

export type UserRole = 'parent' | 'child';

export interface UserProfile {
  id: string;
  parentName: string;
  childName: string;
  childBirthday: string;
  childGender: 'boy' | 'girl' | 'unspecified';
  avatarSeed: string;
  createdAt: string;
  role: UserRole;
  inheritedAt?: string | null;
  parentNameOriginal?: string;
  inheritedFrom?: string;
}

export type TimeTypeKey = 'health' | 'play' | 'survival' | 'achievement' | 'flow';

export interface Memory {
  id: string;
  date: string;
  content: string;
  timeTypes: TimeTypeKey[];
  emotion: string;
  scene: string;
  tags: string[];
  type: 'text' | 'image' | 'video' | 'voice';
  mediaName?: string;
  mediaPreview?: string;
  createdAt: string;
  author?: UserRole;
}

export interface TemperamentDimension {
  dimension: string;
  score: number;
  evidence: string;
}

export interface IntelligenceDimension {
  type: string;
  score: number;
  evidence: string;
}

export interface EriksonStage {
  stage: string;
  age: string;
  quality: string;
  status: 'completed' | 'current' | 'future';
}

export interface DevelopmentProfile {
  currentStage: string;
  currentAge: string;
  quality: string;
  description: string;
  previousStages: EriksonStage[];
}

export interface EmotionalPattern {
  trigger: string;
  response: string;
  frequency: string;
}

export interface PersonalityProfile {
  temperament: TemperamentDimension[];
  intelligence: IntelligenceDimension[];
  development: DevelopmentProfile;
  emotionalPatterns: EmotionalPattern[];
  valuesSeeds: string[];
}

const USER_KEY = 'time-mirror-user';
const MEMORIES_KEY = 'time-mirror-memories';
const BACKEND_MEMORIES_KEY = 'time-mirror-backend-memories';

/* ========== 儿童五种时间（王潇《小日常、大奇迹》） ========== */
export const CHILDREN_FIVE_TIMES = [
  { value: 'health' as TimeTypeKey, label: '健康', icon: '🏃', desc: '运动和生命力——奔跑、跳跃、身体发育', color: '#86EFAC', colorDeep: '#16A34A' },
  { value: 'play' as TimeTypeKey, label: '好玩', icon: '🎮', desc: '纯粹的玩和好奇——探索、发现、开心', color: '#93C5FD', colorDeep: '#2563EB' },
  { value: 'survival' as TimeTypeKey, label: '生存', icon: '🛡️', desc: '克服困难和恐惧——从被动到主动', color: '#D6D3D1', colorDeep: '#78716C' },
  { value: 'achievement' as TimeTypeKey, label: '成就', icon: '🏆', desc: '创造和完成——"我能行"的掌控感', color: '#FDE68A', colorDeep: '#D97706' },
  { value: 'flow' as TimeTypeKey, label: '心流', icon: '✨', desc: '全情投入、忘我——能力与挑战匹配', color: '#FECDD3', colorDeep: '#DB2777' },
] as const;

export const EMOTION_OPTIONS = ['开心', '难过', '害怕', '愤怒', '好奇', '平静', '兴奋'] as const;
export const SCENE_OPTIONS = ['家', '学校', '小区', '公园', '聚会', '户外'] as const;

/* ========== 气质九维度（托马斯&切斯） ========== */
export const TEMPERAMENT_DIMENSIONS = [
  { dimension: '活动水平', meaning: '活动时限vs安静时限' },
  { dimension: '节律性', meaning: '生理活动规律性' },
  { dimension: '趋避性', meaning: '对新事物接近vs退缩' },
  { dimension: '适应度', meaning: '适应新环境的速度' },
  { dimension: '反应强度', meaning: '情绪反应的力度' },
  { dimension: '情绪本质', meaning: '正面vs负面情绪比例' },
  { dimension: '注意分散度', meaning: '外界干扰对注意力影响' },
  { dimension: '坚持度', meaning: '持续活动的时长' },
  { dimension: '反应阈', meaning: '引发反应所需刺激强度' },
] as const;

/* ========== 智能八维（加德纳多元智能） ========== */
export const INTELLIGENCE_TYPES = [
  { type: '语言智能', meaning: '运用语言表达' },
  { type: '逻辑数学智能', meaning: '推理和模式识别' },
  { type: '空间智能', meaning: '视觉空间感知' },
  { type: '肢体动觉智能', meaning: '身体控制和协调' },
  { type: '音乐智能', meaning: '音准和节奏感' },
  { type: '人际智能', meaning: '理解他人情绪' },
  { type: '内省智能', meaning: '自我认知和反思' },
  { type: '自然观察智能', meaning: '辨识自然万物' },
] as const;

/* ========== 埃里克森发展阶段（0-7岁） ========== */
export const ERIKSON_STAGES = [
  { stage: '信任vs不信任', age: '0-1.5岁', quality: '希望', minAgeMonths: 0, maxAgeMonths: 18 },
  { stage: '自主vs羞愧怀疑', age: '1.5-3岁', quality: '意志', minAgeMonths: 18, maxAgeMonths: 36 },
  { stage: '主动vs内疚', age: '3-6岁', quality: '目的', minAgeMonths: 36, maxAgeMonths: 72 },
  { stage: '勤奋vs自卑', age: '6-7岁', quality: '能力', minAgeMonths: 72, maxAgeMonths: 96 },
] as const;

/* ========== 默认人格画像（基于芝麻胡种子数据提炼） ========== */
export function getDefaultPersonality(): PersonalityProfile {
  return {
    temperament: [
      { dimension: '活动水平', score: 85, evidence: '追玩具车、扒栏杆站立、精力旺盛' },
      { dimension: '节律性', score: 60, evidence: '作息相对规律但情绪波动明显' },
      { dimension: '趋避性', score: 65, evidence: '先退缩→观察→适应后积极参与，偏趋' },
      { dimension: '适应度', score: 55, evidence: '需要时间消化但最终能适应' },
      { dimension: '反应强度', score: 40, evidence: '沉默→眼眶红→用语言表达，不爆发' },
      { dimension: '情绪本质', score: 76, evidence: '开心46%、平静30%，正面为主' },
      { dimension: '注意分散度', score: 25, evidence: '看蚂蚁30分钟不易分散，低分散=高专注' },
      { dimension: '坚持度', score: 80, evidence: '反复掰胡萝卜三四次不放弃' },
      { dimension: '反应阈', score: 20, evidence: "问'叶子会不会疼'，低阈值=高敏感" },
    ],
    intelligence: [
      { type: '语言智能', score: 70, evidence: "3岁说'爱是软软的'、7岁自我描述准确" },
      { type: '逻辑数学智能', score: 0, evidence: '待观察' },
      { type: '空间智能', score: 0, evidence: '待观察' },
      { type: '肢体动觉智能', score: 55, evidence: '10月龄自主站立、精细动作发展' },
      { type: '音乐智能', score: 0, evidence: '待观察' },
      { type: '人际智能', score: 90, evidence: '11月龄反向喂饭、递饼干、送毛绒兔' },
      { type: '内省智能', score: 75, evidence: "5岁'我是一个会心疼别人的人'、7岁对小时候自己说话" },
      { type: '自然观察智能', score: 85, evidence: '看蚂蚁搬家30分钟、问叶子会不会疼' },
    ],
    development: {
      currentStage: '勤奋vs自卑',
      currentAge: '6-7岁',
      quality: '能力',
      description: "孩子正在发展'我能做好吗'的能力感",
      previousStages: [
        { stage: '信任vs不信任', age: '0-1.5岁', quality: '希望', status: 'completed' },
        { stage: '自主vs羞愧怀疑', age: '1.5-3岁', quality: '意志', status: 'completed' },
        { stage: '主动vs内疚', age: '3-6岁', quality: '目的', status: 'completed' },
      ],
    },
    emotionalPatterns: [
      { trigger: '新事物/陌生环境', response: '先害怕/退缩→需要时间消化→适应后积极参与', frequency: '高频' },
      { trigger: '别人受苦', response: '主动靠近安慰，甚至牺牲自己的东西', frequency: '高频' },
      { trigger: '人多的场合', response: '先兴奋→突然安静退缩→需要独处充电', frequency: '中频' },
      { trigger: '挫折/失败', response: '沉默→眼眶红但不哭→用语言表达需求→重试', frequency: '中频' },
    ],
    valuesSeeds: [
      '不认识的人也可以关心',
      '爱是软软的',
      '勇敢不是不害怕，是害怕了还去做',
      '牺牲自己的东西去安慰别人是一种力量',
      '对公平有天然的敏感',
    ],
  };
}

/* ========== 种子记录日期动态偏移 ========== */
// 最近一条真实记录的锚定日期，会被偏移到今天
const SEED_ANCHOR_DATE = '2026-07-18';

function shiftDate(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getSeedDateOffset(): number {
  const anchor = new Date(SEED_ANCHOR_DATE + 'T00:00:00Z');
  const now = new Date();
  // Use UTC to avoid timezone issues
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const anchorUTC = anchor.getTime();
  return Math.round((nowUTC - anchorUTC) / (1000 * 60 * 60 * 24));
}

function getAdjustedSeedRecords(): Memory[] {
  const offset = getSeedDateOffset();
  if (offset === 0) return SEED_RECORDS;
  return SEED_RECORDS.map(r => ({
    ...r,
    date: shiftDate(r.date, offset),
    createdAt: shiftDate(r.date, offset) + 'T00:00:00Z',
  }));
}

/* ========== 50条种子记录（内置） ========== */
export const SEED_RECORDS: Memory[] = [
  // === 真实记录 r001-r021（7月龄-12月龄） ===
  { id: 'r001', date: '2026-02-19', content: '7月龄开始出牙了，印象中就有一个晚上大闹了很久，然后牙就出来啦。出牙那晚特别烦躁，但牙冒出来后反而安静了，像是完成了一件大事。', timeTypes: ['survival'], emotion: '难过', scene: '家', tags: ['里程碑', '出牙', '情绪表达'], type: 'text', createdAt: '2026-02-19T00:00:00Z' },
  { id: 'r002', date: '2026-03-01', content: '7月龄，突然发现芝麻胡会追着玩具车爬了。眼睛里闪着光，嘴里发出"啊啊"的声音，像是在说"等等我"。', timeTypes: ['play'], emotion: '开心', scene: '家', tags: ['爬行', '探索'], type: 'text', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'r003', date: '2026-03-10', content: '第一次吃苹果泥，皱着小眉头，像在认真品味什么了不起的东西。', timeTypes: ['health'], emotion: '好奇', scene: '家', tags: ['辅食', '味觉探索'], type: 'text', createdAt: '2026-03-10T00:00:00Z' },
  { id: 'r004', date: '2026-03-15', content: '7月龄，芝麻胡看到我在吃面包，发出"啊啊啊"的声音，身体前倾，手伸得直直的。小眼神里满是渴望，像是发现了什么不得了的东西。', timeTypes: ['play'], emotion: '好奇', scene: '家', tags: ['模仿', '社交互动'], type: 'text', createdAt: '2026-03-15T00:00:00Z' },
  { id: 'r005', date: '2026-03-20', content: '7月龄，芝麻胡第一次学会了拍手。刚开始只是模仿我的动作，后来发现拍手会引发大家的笑声，就拍得更起劲了。', timeTypes: ['achievement'], emotion: '开心', scene: '家', tags: ['里程碑', '模仿'], type: 'text', createdAt: '2026-03-20T00:00:00Z' },
  { id: 'r006', date: '2026-04-02', content: '8月龄，芝麻胡开始认生了。见到不熟悉的人会把脸埋在我肩上，用余光偷偷观察。', timeTypes: ['survival'], emotion: '害怕', scene: '家', tags: ['认生', '社交发展'], type: 'text', createdAt: '2026-04-02T00:00:00Z' },
  { id: 'r007', date: '2026-04-07', content: '8月龄，喂饭时芝麻胡突然抓住我的手，把勺子往我嘴里送——"妈妈也吃"。这是他第一次"反向喂饭"，那一刻我的心都化了。', timeTypes: ['flow'], emotion: '开心', scene: '家', tags: ['共情', '互动'], type: 'text', createdAt: '2026-04-07T00:00:00Z' },
  { id: 'r008', date: '2026-04-15', content: '8月龄，芝麻胡开始对按摩椅的控制面板产生了浓厚兴趣。小手指在上面按来按去，听到"滴滴"声就咯咯笑。', timeTypes: ['play'], emotion: '开心', scene: '家', tags: ['探索', '因果关系'], type: 'text', createdAt: '2026-04-15T00:00:00Z' },
  { id: 'r009', date: '2026-04-22', content: '8月龄，芝麻胡发高烧了。小脸烧得通红，但还是在妈妈怀里挣扎着要站起来，像是在说"我还能行"。', timeTypes: ['survival'], emotion: '难过', scene: '家', tags: ['生病', '坚强'], type: 'text', createdAt: '2026-04-22T00:00:00Z' },
  { id: 'r010', date: '2026-05-01', content: '9月龄，芝麻胡第一次在小区草地上爬。小手抓住草，感受着草叶的触感，表情像是在做一项重要的科学研究。', timeTypes: ['health'], emotion: '好奇', scene: '小区', tags: ['户外', '探索'], type: 'text', createdAt: '2026-05-01T00:00:00Z' },
  { id: 'r011', date: '2026-05-10', content: '9月龄，芝麻胡开始懂"不给"的意思了。我说"不可以"，他会停下来看着我，小嘴一瘪，眼眶开始泛红——但不会哭出来。', timeTypes: ['survival'], emotion: '难过', scene: '家', tags: ['规则意识', '情绪表达'], type: 'text', createdAt: '2026-05-10T00:00:00Z' },
  { id: 'r012', date: '2026-05-18', content: '9月龄，芝麻胡开始对绘本产生兴趣。翻到动物那页，看到小兔子会"啊啊"地指着，然后看看我，像是在问"这是什么"。', timeTypes: ['flow'], emotion: '好奇', scene: '家', tags: ['绘本', '认知发展'], type: 'text', createdAt: '2026-05-18T00:00:00Z' },
  { id: 'r013', date: '2026-06-01', content: '10月龄，芝麻胡终于学会了"拜拜"。小手一张一合，虽然动作还不太标准，但配合上得意的表情，萌翻了所有人。', timeTypes: ['achievement'], emotion: '开心', scene: '家', tags: ['里程碑', '社交'], type: 'text', createdAt: '2026-06-01T00:00:00Z' },
  { id: 'r014', date: '2026-06-08', content: '10月龄，芝麻胡能扶着沙发站立了。小腿颤颤巍巍的，但脸上的表情是"快看我！我做到了！"', timeTypes: ['health'], emotion: '兴奋', scene: '家', tags: ['里程碑', '大运动'], type: 'text', createdAt: '2026-06-08T00:00:00Z' },
  { id: 'r015', date: '2026-06-15', content: '10月龄，芝麻胡扒着栏杆站了好久，小屁股一扭一扭的，像是在跳舞。', timeTypes: ['health'], emotion: '开心', scene: '家', tags: ['大运动', '探索'], type: 'text', createdAt: '2026-06-15T00:00:00Z' },
  { id: 'r016', date: '2026-06-20', content: '10月龄，芝麻胡学会了"递东西"这个社交技能。把自己啃过的磨牙棒递给我，眼神真挚——"给你尝尝，可好吃了"。', timeTypes: ['flow'], emotion: '开心', scene: '家', tags: ['社交', '分享'], type: 'text', createdAt: '2026-06-20T00:00:00Z' },
  { id: 'r017', date: '2026-07-01', content: '11月龄，芝麻胡在小区里看到一个小妹妹在哭，他爬过去，把自己最心爱的磨牙棒递给她。', timeTypes: ['flow'], emotion: '平静', scene: '小区', tags: ['共情', '社交'], type: 'text', createdAt: '2026-07-01T00:00:00Z' },
  { id: 'r018', date: '2026-07-10', content: '11月龄，芝麻胡对遥控器产生了执念。每次看到都啊啊叫着要拿，拿到后学着大人的样子对着电视按。', timeTypes: ['play'], emotion: '兴奋', scene: '家', tags: ['模仿', '探索'], type: 'text', createdAt: '2026-07-10T00:00:00Z' },
  { id: 'r019', date: '2026-07-18', content: '11月龄，芝麻胡在公园看到蚂蚁搬家，蹲（扶）在那里看了将近半小时。小脑袋跟着蚂蚁队伍转来转去，完全进入了另一个世界。', timeTypes: ['flow'], emotion: '好奇', scene: '公园', tags: ['自然观察', '专注'], type: 'text', createdAt: '2026-07-18T00:00:00Z' },
  { id: 'r020', date: '2026-08-01', content: '12月龄，芝麻胡迈出了人生第一步。摇摇晃晃走了三步，扑进我怀里。全过程他自己懵了，我哭了。', timeTypes: ['achievement'], emotion: '开心', scene: '家', tags: ['里程碑', '走路'], type: 'text', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'r021', date: '2026-08-05', content: '12月龄，芝麻胡周岁了。吹蜡烛的时候他不懂发生了什么，但看到大家笑他也跟着笑。', timeTypes: ['play'], emotion: '开心', scene: '家', tags: ['生日', '里程碑'], type: 'text', createdAt: '2026-08-05T00:00:00Z' },
  // === 推演数据 r022-r050（1-7岁，基于真实特质推演） ===
  { id: 'r022', date: '2026-09-10', content: '13月龄，芝麻胡开始尝试用勺子。虽然大部分食物都洒在了桌上，但他执着地把勺子一次次送进嘴里。', timeTypes: ['achievement'], emotion: '平静', scene: '家', tags: ['自理', '坚持'], type: 'text', createdAt: '2026-09-10T00:00:00Z' },
  { id: 'r023', date: '2026-10-15', content: '14月龄，芝麻胡在公园看到别的小朋友玩滑梯，一开始紧紧抱着我，观察了十分钟后开始尝试。', timeTypes: ['survival'], emotion: '害怕', scene: '公园', tags: ['社交', '克服恐惧'], type: 'text', createdAt: '2026-10-15T00:00:00Z' },
  { id: 'r024', date: '2026-11-20', content: '15月龄，芝麻胡开始有"我的"意识。别的小朋友拿他的玩具，他会着急地指着说"我的我的"。', timeTypes: ['survival'], emotion: '愤怒', scene: '小区', tags: ['自我意识', '社交'], type: 'text', createdAt: '2026-11-20T00:00:00Z' },
  { id: 'r025', date: '2027-01-05', content: '17月龄，芝麻胡在雪地里玩，第一次踩雪。踩下去咔嚓一声，他愣住了，然后小心翼翼地又踩了一脚，脸上露出惊喜的表情。', timeTypes: ['play'], emotion: '开心', scene: '户外', tags: ['感官体验', '探索'], type: 'text', createdAt: '2027-01-05T00:00:00Z' },
  { id: 'r026', date: '2027-03-01', content: '19月龄，芝麻胡开始说短句。"妈妈抱""不要""还要"。虽然发音不太标准，但意思已经很明确了。', timeTypes: ['achievement'], emotion: '开心', scene: '家', tags: ['语言发展', '里程碑'], type: 'text', createdAt: '2027-03-01T00:00:00Z' },
  { id: 'r027', date: '2027-04-10', content: '20月龄，芝麻胡看到我膝盖上的伤疤，凑过来轻轻吹了吹——这个动作是我平时给他吹伤口时做的。', timeTypes: ['flow'], emotion: '平静', scene: '家', tags: ['共情', '模仿'], type: 'text', createdAt: '2027-04-10T00:00:00Z' },
  { id: 'r028', date: '2027-05-20', content: '21月龄，芝麻胡在小区沙坑里玩了一个小时。用小铲子挖沙、装进桶里、倒出来——重复了无数次，乐此不疲。', timeTypes: ['flow'], emotion: '平静', scene: '小区', tags: ['专注', '探索'], type: 'text', createdAt: '2027-05-20T00:00:00Z' },
  { id: 'r029', date: '2027-07-01', content: '23月龄，芝麻胡第一次自己穿鞋。虽然左右穿反了，但他花了五分钟终于把脚塞进去了，然后骄傲地走到我面前。', timeTypes: ['achievement'], emotion: '开心', scene: '家', tags: ['自理', '独立'], type: 'text', createdAt: '2027-07-01T00:00:00Z' },
  { id: 'r030', date: '2027-08-15', content: '2岁，芝麻胡开始有"朋友"的概念。在小区里看到经常一起玩的小朋友，会主动跑过去拉手。', timeTypes: ['play'], emotion: '开心', scene: '小区', tags: ['社交', '友谊'], type: 'text', createdAt: '2027-08-15T00:00:00Z' },
  { id: 'r031', date: '2027-10-01', content: '2岁2月，芝麻胡在游乐场遇到一个哭闹的小妹妹，他把自己最爱的毛绒兔塞到她手里，拍着她的背说"不哭不哭"。', timeTypes: ['flow'], emotion: '平静', scene: '公园', tags: ['共情', '分享'], type: 'text', createdAt: '2027-10-01T00:00:00Z' },
  { id: 'r032', date: '2027-11-20', content: '2岁3月，芝麻胡第一次发烧后说"妈妈，我难受"——不是哭，是用语言表达。', timeTypes: ['survival'], emotion: '难过', scene: '家', tags: ['生病', '语言表达'], type: 'text', createdAt: '2027-11-20T00:00:00Z' },
  { id: 'r033', date: '2028-01-10', content: '2岁5月，芝麻胡在雪地里堆了一个歪歪扭扭的雪人，兴奋地拉着每个路过的人来看。"看！我做的！"', timeTypes: ['achievement'], emotion: '兴奋', scene: '户外', tags: ['创造', '成就感'], type: 'text', createdAt: '2028-01-10T00:00:00Z' },
  { id: 'r034', date: '2028-03-15', content: '2岁7月，芝麻胡开始问"为什么"。为什么天是蓝的？为什么鸟会飞？为什么叶子会掉？每一个为什么后面都跟着另一个为什么。', timeTypes: ['play'], emotion: '好奇', scene: '家', tags: ['好奇心', '认知'], type: 'text', createdAt: '2028-03-15T00:00:00Z' },
  { id: 'r035', date: '2028-05-01', content: '2岁9月，芝麻胡在公园跑得飞快，摔倒了膝盖破皮。他眼眶红红的，但没哭，自己爬起来说"没事没事"。', timeTypes: ['health'], emotion: '难过', scene: '公园', tags: ['大运动', '坚强'], type: 'text', createdAt: '2028-05-01T00:00:00Z' },
  { id: 'r036', date: '2028-07-01', content: '3岁，芝麻胡上幼儿园第一天。他紧紧攥着我的手，眼眶红红的，但忍着没哭。走进教室后回头看了我一眼，像是在说"我可以的"。', timeTypes: ['survival'], emotion: '害怕', scene: '学校', tags: ['入园', '分离焦虑'], type: 'text', createdAt: '2028-07-01T00:00:00Z' },
  { id: 'r037', date: '2028-09-10', content: '3岁2月，芝麻胡在幼儿园交到了第一个好朋友。"他叫豆豆，我们约好明天一起搭积木。"', timeTypes: ['play'], emotion: '开心', scene: '学校', tags: ['友谊', '社交'], type: 'text', createdAt: '2028-09-10T00:00:00Z' },
  { id: 'r038', date: '2028-11-20', content: '3岁4月，芝麻胡在幼儿园画画，画了一家三口手拉手。虽然画得歪歪扭扭，但每个人都笑得很开心。', timeTypes: ['achievement'], emotion: '开心', scene: '学校', tags: ['创造', '表达'], type: 'text', createdAt: '2028-11-20T00:00:00Z' },
  { id: 'r039', date: '2029-01-15', content: '3岁6月，芝麻胡第一次说"爱"。"妈妈，爱是软软的。"我问他为什么，他说"因为抱抱的时候是软软的"。', timeTypes: ['flow'], emotion: '平静', scene: '家', tags: ['语言', '情感'], type: 'text', createdAt: '2029-01-15T00:00:00Z' },
  { id: 'r040', date: '2029-04-01', content: '3岁9月，芝麻胡对数字产生了兴趣。走在路上看到车牌就要念，"这个是3，这个是8"。', timeTypes: ['play'], emotion: '好奇', scene: '户外', tags: ['认知', '数字'], type: 'text', createdAt: '2029-04-01T00:00:00Z' },
  { id: 'r041', date: '2029-07-01', content: '4岁，芝麻胡在幼儿园的表演中站在第一排，虽然有点紧张，但完整地唱完了一首歌。', timeTypes: ['achievement'], emotion: '平静', scene: '学校', tags: ['表演', '勇气'], type: 'text', createdAt: '2029-07-01T00:00:00Z' },
  { id: 'r042', date: '2029-10-10', content: '4岁3月，芝麻胡在小区里看到一只流浪猫，蹲下来轻轻地说"过来，我保护你"。', timeTypes: ['flow'], emotion: '平静', scene: '小区', tags: ['共情', '动物'], type: 'text', createdAt: '2029-10-10T00:00:00Z' },
  { id: 'r043', date: '2030-01-20', content: '4岁6月，芝麻胡第一次骑自行车（带辅助轮）。骑得飞快，风把头发吹起来，他大喊"妈妈你看我多快！"', timeTypes: ['health'], emotion: '兴奋', scene: '小区', tags: ['大运动', '成就'], type: 'text', createdAt: '2030-01-20T00:00:00Z' },
  { id: 'r044', date: '2030-04-05', content: '4岁9月，芝麻胡在幼儿园帮助了一个新来的小朋友适应环境，主动带他认识教室的每个角落。老师说他是"小小志愿者"。', timeTypes: ['flow'], emotion: '开心', scene: '学校', tags: ['领导力', '共情'], type: 'text', createdAt: '2030-04-05T00:00:00Z' },
  { id: 'r045', date: '2030-07-01', content: '5岁，芝麻胡在幼儿园毕业典礼上代表班级发言。虽然只有短短几句话，但说得清清楚楚，一点都不怯场。', timeTypes: ['achievement'], emotion: '平静', scene: '学校', tags: ['里程碑', '表达'], type: 'text', createdAt: '2030-07-01T00:00:00Z' },
  { id: 'r046', date: '2030-10-15', content: '5岁3月，芝麻胡在回家的路上说"妈妈，我是一个会心疼别人的人"。我问他为什么这么说，他说"因为看到别人难过，我心里也会难过"。', timeTypes: ['flow'], emotion: '平静', scene: '家', tags: ['自我认知', '共情'], type: 'text', createdAt: '2030-10-15T00:00:00Z' },
  { id: 'r047', date: '2031-01-20', content: '5岁6月，芝麻胡开始学跳绳。一开始总是被绳子绊倒，但他每天坚持练习，终于在一个月后连续跳了5个。', timeTypes: ['health'], emotion: '兴奋', scene: '小区', tags: ['坚持', '运动'], type: 'text', createdAt: '2031-01-20T00:00:00Z' },
  { id: 'r048', date: '2031-05-10', content: '5岁10月，芝麻胡在植物园看到一朵花，说"叶子会不会疼"。他轻轻地摸了摸叶子，像是在跟花说话。', timeTypes: ['flow'], emotion: '平静', scene: '户外', tags: ['敏感', '自然'], type: 'text', createdAt: '2031-05-10T00:00:00Z' },
  { id: 'r049', date: '2031-08-01', content: '6岁，芝麻胡上小学了。背着大书包，一脸认真地走进校门，回头朝我挥了挥手，像个小大人。', timeTypes: ['survival'], emotion: '平静', scene: '学校', tags: ['里程碑', '入学'], type: 'text', createdAt: '2031-08-01T00:00:00Z' },
  { id: 'r050', date: '2032-01-15', content: '6岁5月，芝麻胡在回家路上说"我觉得我小时候很勇敢，因为那时候什么都不怕"。我问他现在呢？他说"现在也勇敢，但现在是知道怕了还去做"。', timeTypes: ['flow'], emotion: '平静', scene: '家', tags: ['自我认知', '成长'], type: 'text', createdAt: '2032-01-15T00:00:00Z' },
];

/* ========== 用户操作 ========== */
export function getUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

export function saveUser(user: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * 退出/切换账户：清除 localStorage 中的用户和记忆缓存，返回到 onboarding。
 * 不清后端数据库——数据按名字安全保留，下次用同样的名字进入还能看到。
 */
export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(MEMORIES_KEY);
  localStorage.removeItem(BACKEND_MEMORIES_KEY);
  window.location.href = '/onboarding';
}

export function getMemories(): Memory[] {
  if (typeof window === 'undefined') return [];
  try {
    // Prefer backend memories if synced
    const backendRaw = localStorage.getItem(BACKEND_MEMORIES_KEY);
    if (backendRaw) {
      const backendMems: Memory[] = JSON.parse(backendRaw);
      if (backendMems.length > 0) {
        // Merge with any user-added memories not yet in backend
        const userRaw = localStorage.getItem(MEMORIES_KEY);
        const userMems: Memory[] = userRaw ? JSON.parse(userRaw) : [];
        const backendIds = new Set(backendMems.map(m => m.id));
        const newUserMems = userMems.filter(m => !backendIds.has(m.id));
        return [...newUserMems, ...backendMems];
      }
    }
    // Fall back to user records only (no seed records — new users start at 0)
    const raw = localStorage.getItem(MEMORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveMemory(memory: Memory): void {
  const raw = localStorage.getItem(MEMORIES_KEY);
  const stored: Memory[] = raw ? JSON.parse(raw) : [];
  stored.unshift(memory);
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(stored));
}

export function saveMemories(newMemories: Memory[]): void {
  const raw = localStorage.getItem(MEMORIES_KEY);
  const stored: Memory[] = raw ? JSON.parse(raw) : [];
  stored.unshift(...newMemories);
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(stored));
}

export function deleteMemory(id: string): void {
  const raw = localStorage.getItem(MEMORIES_KEY);
  const stored: Memory[] = raw ? JSON.parse(raw) : [];
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(stored.filter(m => m.id !== id)));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ========== 继承 ========== */
export function inheritAccount(): UserProfile | null {
  const user = getUser();
  if (!user) return null;
  const updated: UserProfile = {
    ...user,
    role: 'child',
    parentNameOriginal: user.parentName,
    inheritedAt: new Date().toISOString(),
  };
  saveUser(updated);
  return updated;
}

/* ========== 成长阶段 ========== */
export function getGrowthStage(memoryCount: number): {
  level: number; label: string; growth: number; nextLevelMemories: number;
} {
  const stages = [
    { level: 0, label: '种子期', min: 0, max: 3 },
    { level: 1, label: '萌芽期', min: 3, max: 8 },
    { level: 2, label: '幼苗期', min: 8, max: 15 },
    { level: 3, label: '成长期', min: 15, max: 30 },
    { level: 4, label: '繁茂期', min: 30, max: 50 },
    { level: 5, label: '参天', min: 50, max: 9999 },
  ];
  const stage = stages.find(s => memoryCount >= s.min && memoryCount < s.max) ?? stages[0];
  const progress = stage.max === 9999 ? 1 : (memoryCount - stage.min) / (stage.max - stage.min);
  return {
    level: stage.level,
    label: stage.label,
    growth: Math.min(1, memoryCount / 50),
    nextLevelMemories: stage.max,
  };
}

/* ========== 时间分布统计 ========== */
export function getTimeDistribution(memories: Memory[]): { key: TimeTypeKey; count: number; percentage: number }[] {
  const total = memories.length || 1;
  const counts: Record<string, number> = {};
  CHILDREN_FIVE_TIMES.forEach(t => { counts[t.value] = 0; });
  memories.forEach(m => { m.timeTypes.forEach(tt => { counts[tt] = (counts[tt] || 0) + 1; }); });
  return CHILDREN_FIVE_TIMES.map(t => ({
    key: t.value,
    count: counts[t.value] || 0,
    percentage: Math.round(((counts[t.value] || 0) / total) * 100),
  }));
}

/* ========== 记忆检索（关键词匹配） ========== */
export function searchMemories(query: string, memories: Memory[], topK = 5): Memory[] {
  const keywords = query.toLowerCase().split(/\s+/);
  const scored = memories.map(m => {
    const timeLabels = m.timeTypes.map(tt => CHILDREN_FIVE_TIMES.find(t => t.value === tt)?.label || '').join(' ');
    const text = `${m.content} ${m.tags.join(' ')} ${m.emotion} ${timeLabels}`.toLowerCase();
    let score = 0;
    keywords.forEach(kw => {
      if (text.includes(kw)) score += 1;
      if (m.content.toLowerCase().includes(kw)) score += 2;
    });
    // Time weight: recent memories score higher
    const daysAgo = (Date.now() - new Date(m.date).getTime()) / (1000 * 86400);
    const timeWeight = Math.max(0, 1 - daysAgo / 3650);
    return { memory: m, score: score * (1 + timeWeight * 0.3) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, topK).map(s => s.memory);
}

/* ========== 统计 ========== */
export function getMemoryCountByType(memories: Memory[], type: TimeTypeKey): number {
  return memories.filter(m => m.timeTypes.includes(type)).length;
}

export function getTotalMemoryCount(memories: Memory[]): number {
  return memories.length;
}

/* ========== 旧版兼容别名 ========== */
export const MEMORY_CATEGORIES = CHILDREN_FIVE_TIMES;

/* ========== 人格画像提炼函数 ========== */
export function getTemperament(): PersonalityProfile['temperament'] {
  return getDefaultPersonality().temperament;
}

export function getIntelligence(): PersonalityProfile['intelligence'] {
  return getDefaultPersonality().intelligence;
}

export function getDevelopment(): DevelopmentProfile {
  return getDefaultPersonality().development;
}

export function getEmotionalPatterns(): PersonalityProfile['emotionalPatterns'] {
  return getDefaultPersonality().emotionalPatterns;
}

export function getValueSeeds(): PersonalityProfile['valuesSeeds'] {
  return getDefaultPersonality().valuesSeeds;
}

/* ========== 年龄计算 ========== */
export function calculateAge(birthDate: string, referenceDate?: string): { days: number; months: number; years: number } {
  const birth = new Date(birthDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const diffMs = ref.getTime() - birth.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 86400));
  const diffMonths = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  const diffYears = ref.getFullYear() - birth.getFullYear();
  return { days: Math.max(0, diffDays), months: Math.max(0, diffMonths), years: Math.max(0, diffYears) };
}

export function getChildAgeString(birthDate: string, referenceDate?: string): string {
  const age = calculateAge(birthDate, referenceDate);
  if (age.days <= 30) return `${age.days}天`;
  if (age.days <= 730) return `${age.months}个月`;
  return `${age.years}岁${age.years < 7 ? `${age.months % 12}个月` : ''}`;
}

/* ========== 数字分身进度 ========== */
export function getDigitalTwinProgress(memoryCount: number): { percent: number; label: string; nextLevel: number } {
  const stages = [
    { min: 0, max: 3, label: '种下光种', nextLevel: 3 },
    { min: 3, max: 8, label: '光点初现', nextLevel: 8 },
    { min: 8, max: 15, label: '轮廓渐显', nextLevel: 15 },
    { min: 15, max: 30, label: '形神初具', nextLevel: 30 },
    { min: 30, max: 50, label: '清晰可辨', nextLevel: 50 },
    { min: 50, max: 99999, label: '孪生已成', nextLevel: 99999 },
  ];
  const stage = stages.find(s => memoryCount >= s.min && memoryCount < s.max) ?? stages[0];
  const progress = stage.nextLevel === 99999 ? 1 : Math.min(1, (memoryCount - stage.min) / (stage.nextLevel - stage.min));
  return { percent: Math.round(progress * 100), label: stage.label, nextLevel: stage.nextLevel };
}

/* ========== 孪生等级 ========== */
export function getTwinLevel(memoryCount: number): { level: number; label: string; growth: number } {
  const maxLevel = 6;
  const level = Math.min(maxLevel, Math.floor(memoryCount / 8) + 1);
  const growth = Math.min(1, memoryCount / 50);
  const labels = ['种子', '萌芽', '幼苗', '成长', '绽放', '参天'];
  return { level, label: labels[Math.min(level - 1, labels.length - 1)], growth };
}

/* ========== 最近回忆 ========== */
export function getRecentMemories(memories: Memory[], limit = 3): Memory[] {
  return [...memories].sort((a, b) => {
    const ta = new Date(a.createdAt || a.date).getTime();
    const tb = new Date(b.createdAt || b.date).getTime();
    return tb - ta;
  }).slice(0, limit);
}

/* ========== 那年今日 ========== */
export function getMemoriesByDate(memories: Memory[], monthsAgo: number): Memory[] {
  const target = new Date();
  target.setMonth(target.getMonth() - monthsAgo);
  const targetDate = target.toISOString().slice(0, 10);
  // Match month and day (ignore year)
  const targetMD = targetDate.slice(5);
  return memories.filter(m => m.date.slice(5) === targetMD);
}

/* ========== 从记忆中动态提炼人格 ========== */
export function getTemperamentFromMemories(memories: Memory[]): PersonalityProfile['temperament'] {
  // Start with default, then adjust based on actual memories
  const base = getDefaultPersonality().temperament;
  if (memories.length < 3) return base;
  
  // Analyze content to estimate dimensions
  const allText = memories.map(m => m.content).join(' ');
  const isActive = /跑|跳|爬|追|运动|精力|动来动去/.test(allText);
  const isRoutine = /规律|定时|每天|按时/.test(allText);
  const isApproach = /好奇|主动|探索|接近|尝试/.test(allText);
  const isAdaptable = /适应|融入|习惯|接受/.test(allText);
  const isIntense = /大哭|尖叫|大笑|激动/.test(allText);
  const isPositive = /开心|笑|高兴|喜欢|爱/.test(allText);
  const isFocused = /专注|一直|不动|认真|入迷/.test(allText);
  const isPersistent = /坚持|反复|再来|不放弃|努力/.test(allText);
  const isSensitive = /敏感|小心|害怕|在意|担心/.test(allText);

  return base.map(d => {
    let score = d.score;
    if (d.dimension === '活动水平') score = isActive ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.dimension === '节律性') score = isRoutine ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.dimension === '趋避性') score = isApproach ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.dimension === '适应度') score = isAdaptable ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.dimension === '反应强度') score = isIntense ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.dimension === '情绪本质') score = isPositive ? Math.min(100, score + 10) : Math.max(0, score - 10);
    if (d.dimension === '注意分散度') score = isFocused ? Math.max(0, score - 10) : Math.min(100, score + 10);
    if (d.dimension === '坚持度') score = isPersistent ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.dimension === '反应阈') score = isSensitive ? Math.max(0, score - 10) : Math.min(100, score + 10);
    return { ...d, score: Math.max(0, Math.min(100, score)) };
  });
}

export function getIntelligenceFromMemories(memories: Memory[]): PersonalityProfile['intelligence'] {
  const base = getDefaultPersonality().intelligence;
  if (memories.length < 3) return base;
  
  const allText = memories.map(m => m.content).join(' ');
  const isLinguistic = /说|讲|语言|话|表达|词|句/.test(allText);
  const isLogical = /数|逻辑|推理|原因|因为|所以|规律/.test(allText);
  const isSpatial = /画|拼图|积木|空间|形状|地图/.test(allText);
  const isPhysical = /跑|跳|爬|运动|身体|手|脚/.test(allText);
  const isMusical = /音乐|唱歌|节奏|旋律|歌/.test(allText);
  const isInterpersonal = /分享|一起|朋友|帮助|安慰|抱/.test(allText);
  const isIntrapersonal = /我|自己|想|觉得|知道|明白/.test(allText);
  const isNaturalist = /动物|植物|自然|蚂蚁|叶子|花|草/.test(allText);

  return base.map(d => {
    let score = d.score;
    if (d.type === '语言智能') score = isLinguistic ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '逻辑数学智能') score = isLogical ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '空间智能') score = isSpatial ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '肢体动觉智能') score = isPhysical ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '音乐智能') score = isMusical ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '人际智能') score = isInterpersonal ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '内省智能') score = isIntrapersonal ? Math.min(100, score + 15) : Math.max(0, score - 5);
    if (d.type === '自然观察智能') score = isNaturalist ? Math.min(100, score + 15) : Math.max(0, score - 5);
    return { ...d, score: Math.max(0, Math.min(100, score)) };
  });
}

export function getDevelopmentFromMemories(): DevelopmentProfile {
  return getDefaultPersonality().development;
}

export function getEmotionalPatternsFromMemories(memories: Memory[]): PersonalityProfile['emotionalPatterns'] {
  if (memories.length < 3) return getDefaultPersonality().emotionalPatterns;
  const emotions = memories.map(m => m.emotion);
  const uniqueEmotions = [...new Set(emotions)];
  const patterns: PersonalityProfile['emotionalPatterns'] = [];
  
  uniqueEmotions.forEach(em => {
    const count = emotions.filter(e => e === em).length;
    if (count >= 2) {
      patterns.push({
        trigger: em === '开心' ? '愉悦体验' : em === '难过' ? '挫折/失落' : em === '害怕' ? '陌生/危险' : em === '愤怒' ? '需求受阻' : em === '好奇' ? '新事物' : em === '平静' ? '安全环境' : em === '兴奋' ? '期待/惊喜' : '日常',
        response: `${em}的情绪`,
        frequency: count >= 5 ? '高频' : count >= 3 ? '中频' : '低频',
      });
    }
  });
  
  return patterns.length > 0 ? patterns : getDefaultPersonality().emotionalPatterns;
}

export function generateValueSeedsFromMemories(memories: Memory[]): string[] {
  if (memories.length < 2) return getDefaultPersonality().valuesSeeds;
  const seeds: string[] = [];
  // Extract meaningful phrases from memories
  memories.forEach(m => {
    const sentences = m.content.split(/[。！？，、]/);
    sentences.forEach(s => {
      const trimmed = s.trim();
      if (trimmed.length >= 6 && trimmed.length <= 25 && /爱|懂|知道|相信|可以|应该|想|能|会/.test(trimmed)) {
        seeds.push(trimmed);
      }
    });
  });
  return seeds.length > 0 ? [...new Set(seeds)].slice(0, 10) : getDefaultPersonality().valuesSeeds;
}

/* ========== 后端同步 (Backend Sync) ========== */

/**
 * 当前用户的复合身份键（parentName::childName），用于 API 数据隔离。
 * 不同家长+孩子组合天然隔离。未登录返回 undefined。
 */
function _currentIdentity(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const u = getUser();
  if (!u?.childName) return undefined;
  // 复合键：parentName::childName，确保不同家长+孩子组合隔离
  const parent = u.parentName || '';
  return parent ? `${parent}::${u.childName}` : u.childName;
}

/**
 * 当前用户的复合身份键（parentName::childName），用于 API 数据隔离。
 * 不同家长+孩子组合天然隔离。未登录返回 undefined。
 */
export function getCurrentIdentity(): string | undefined {
  return _currentIdentity();
}

/**
 * 兼容旧名：返回复合身份键。
 */
function _currentChildName(): string | undefined {
  return _currentIdentity();
}

/**
 * Sync memories from the Python backend into localStorage.
 * Call this on page load to populate the frontend with backend DB data.
 * Returns the number of memories fetched.
 */
export async function syncMemoriesFromBackend(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const backendMems = await fetchMemoriesFromBackend(_currentChildName());
    if (backendMems.length > 0) {
      localStorage.setItem(BACKEND_MEMORIES_KEY, JSON.stringify(backendMems));
    } else {
      localStorage.removeItem(BACKEND_MEMORIES_KEY);
    }
    return backendMems.length;
  } catch (err) {
    console.error('[store] syncMemoriesFromBackend failed:', err);
    return 0;
  }
}

/**
 * Sync a single memory to the Python backend (Agent 1 extraction pipeline).
 * Non-blocking — does not wait for backend response before returning.
 */
export function syncMemoryToBackend(memory: Memory): void {
  if (typeof window === 'undefined') return;
  // Fire-and-forget — don't block the UI
  createMemoryBackend(
    memory.content,
    memory.date,
    memory.emotion,
    memory.scene,
    memory.timeTypes,
    memory.tags,
    _currentChildName()
  ).then(result => {
    if (result.success) {
      console.log('[store] Memory synced to backend:', memory.id);
    } else {
      console.warn('[store] Backend sync failed:', result.message);
    }
  }).catch(err => {
    console.warn('[store] Backend sync error:', err);
  });
}

/**
 * Clear data — by default only clears the current child's data (not other users').
 * Used by the frontend "清空" button.
 */
export async function clearAllData(): Promise<{ backend: boolean; count: number }> {
  const childName = _currentChildName();
  const backendResult = await clearBackendDB(childName);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MEMORIES_KEY);
    localStorage.removeItem(BACKEND_MEMORIES_KEY);
  }
  return { backend: backendResult.success, count: 0 };
}

/**
 * Check if backend is connected and has data.
 */
export async function checkBackendStatus(): Promise<{ connected: boolean; count: number }> {
  const count = await getBackendMemoryCount(_currentChildName());
  return { connected: count > 0, count };
}

/**
 * Fetch Layer3 value analysis from the backend.
 * Returns value signals that can be displayed in the growth page.
 */
export async function fetchBackendValueAnalysis(): Promise<{
  values: ValueSignal[];
  trend: string;
} | null> {
  try {
    const analysis = await fetchAnalysisFromBackend(_currentChildName());
    if (!analysis || !analysis.success) return null;
    return {
      values: analysis.values || [],
      trend: analysis.trend || '',
    };
  } catch {
    return null;
  }
}

/**
 * Check if backend memories are currently loaded in localStorage.
 */
export function hasBackendMemories(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(BACKEND_MEMORIES_KEY);
    return raw ? JSON.parse(raw).length > 0 : false;
  } catch { return false; }
}