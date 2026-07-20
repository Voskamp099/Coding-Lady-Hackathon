'use client';

import { useEffect, useRef } from 'react';

interface ParticleAvatarProps {
  growth?: number;
  size?: number;
  animate?: boolean;
}

// ─── 水彩树苗 Canvas 绘制 ──────────────────────────────────────────
// 参考真实树苗照片：灌木状轮廓，短壮主茎，3-4根一级枝条分叉，
// 30-40片椭圆叶片，深褐色不规则土丘，柔光绿色背景虚化
// 水彩技法：多层半透明叠加、柔边晕染、色粒沉淀
// ────────────────────────────────────────────────────────────────────

// 确定性伪随机（固定位置，不随帧变化）
function sr(seed: number): number {
  const x = Math.sin(seed * 9999.137) * 10000;
  return x - Math.floor(x);
}

// ─── 水彩叶片 ──────────────────────────────────────────────
function drawWatercolorLeaf(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  len: number,
  baseColor: string,
  lightColor: string,
  shadowColor: string,
  swayOffset: number
) {
  const w = len * 0.42;
  const h = len * 0.28;
  const a = angle + swayOffset;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);

  // 1. 水彩边缘晕染 — 比叶片大一圈，极低透明度
  ctx.globalAlpha = 0.06;
  ctx.beginPath();
  ctx.ellipse(0.5, 0.5, w * 1.2, h * 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = baseColor;
  ctx.fill();

  // 2. 柔边阴影层
  ctx.globalAlpha = 0.15;
  ctx.shadowBlur = 3;
  ctx.shadowColor = shadowColor;
  ctx.beginPath();
  ctx.ellipse(1, 1.5, w * 0.95, h * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadowColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 3. 叶片底色 — 径向渐变
  ctx.globalAlpha = 0.55;
  const grad = ctx.createRadialGradient(-w * 0.2, -h * 0.2, 0, 0, 0, w);
  grad.addColorStop(0, lightColor);
  grad.addColorStop(0.5, baseColor);
  grad.addColorStop(1, shadowColor);
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 4. 叶片主色叠加 — 增加水彩的厚重感
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.85, h * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = baseColor;
  ctx.fill();

  // 5. 高光 — 受光面
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(-w * 0.25, -h * 0.3, w * 0.35, h * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = lightColor;
  ctx.fill();

  // 6. 叶脉 — 细线
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.moveTo(-w * 0.8, 0);
  ctx.lineTo(w * 0.8, 0);
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = 0.4;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── 水彩枝条 ──────────────────────────────────────────────
function drawWatercolorBranch(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  w1: number, w2: number,
  sway: number,
  colorDark: string, colorLight: string
) {
  const mx = (x1 + x2) / 2 + sway;
  const my = (y1 + y2) / 2;

  ctx.save();

  // 1. 柔边底层 — 宽，低透明度
  ctx.globalAlpha = 0.12;
  ctx.shadowBlur = 4;
  ctx.shadowColor = colorDark;
  ctx.beginPath();
  ctx.moveTo(x1 - w1 / 2 - 1, y1);
  ctx.quadraticCurveTo(mx - w1 / 2 - 1, my, x2 - w2 / 2 - 1, y2);
  ctx.lineTo(x2 + w2 / 2 + 1, y2);
  ctx.quadraticCurveTo(mx + w1 / 2 + 1, my, x1 + w1 / 2 + 1, y1);
  ctx.closePath();
  ctx.fillStyle = colorDark;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 2. 主色层 — 渐变
  ctx.globalAlpha = 0.6;
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, colorDark);
  grad.addColorStop(1, colorLight);
  ctx.beginPath();
  ctx.moveTo(x1 - w1 / 2, y1);
  ctx.quadraticCurveTo(mx - w1 / 2, my, x2 - w2 / 2, y2);
  ctx.lineTo(x2 + w2 / 2, y2);
  ctx.quadraticCurveTo(mx + w1 / 2, my, x1 + w1 / 2, y1);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 3. 高光 — 受光侧
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(x1 - w1 / 4, y1);
  ctx.quadraticCurveTo(mx - w1 / 4, my, x2 - w2 / 4, y2);
  ctx.strokeStyle = colorLight;
  ctx.lineWidth = Math.max(w2 * 0.3, 0.5);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── 水彩土壤（完全静态） ──────────────────────────────────
function drawWatercolorSoil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const soilY = h * 0.72;

  ctx.save();

  // 1. 土壤边缘晕染 — 不规则轮廓，低透明度
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.ellipse(w / 2, soilY + 6, w * 0.38, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3D2B1E';
  ctx.fill();

  // 2. 土丘主体 — 多层叠加水彩
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(w / 2, soilY + 4, w * 0.34, h * 0.11, 0, 0.2, Math.PI * 1.8);
  ctx.fillStyle = '#3D2B1E';
  ctx.fill();

  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(w / 2 - 2, soilY + 2, w * 0.30, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4A3520';
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(w / 2 + 3, soilY + 5, w * 0.26, h * 0.08, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#2D1E12';
  ctx.fill();

  // 3. 土壤颗粒 — 沉淀效果
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const r = w * (0.08 + sr(i + 1) * 0.22);
    const px = w / 2 + Math.cos(angle) * r;
    const py = soilY + 3 + Math.sin(angle) * r * 0.35;
    const sz = 2 + sr(i + 10) * 5;
    ctx.globalAlpha = 0.3 + sr(i + 20) * 0.3;
    ctx.beginPath();
    ctx.ellipse(px, py, sz, sz * 0.6, sr(i + 30) * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = sr(i + 40) > 0.5 ? '#5A4030' : '#2D1E12';
    ctx.fill();
  }

  // 4. 浅色土块 — 右侧偏灰褐
  for (let i = 0; i < 6; i++) {
    const px = w * 0.55 + sr(i + 60) * w * 0.15;
    const py = soilY + 4 + sr(i + 70) * h * 0.06;
    const sz = 3 + sr(i + 80) * 4;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(px, py, sz, sz * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7A6A5A';
    ctx.fill();
  }

  // 5. 高光颗粒
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.5;
    const r = w * (0.1 + sr(i + 90) * 0.15);
    const px = w / 2 + Math.cos(angle) * r;
    const py = soilY + 3 + Math.sin(angle) * r * 0.3;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(px, py, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9A8A7A';
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── 水彩柔光背景 ──────────────────────────────────────────
function drawBokehBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();

  // 大面积绿色虚化色块
  const blobs = [
    { x: 0.3, y: 0.25, r: 0.28, c: 'rgba(160,200,160,0.08)' },
    { x: 0.7, y: 0.35, r: 0.25, c: 'rgba(180,210,170,0.06)' },
    { x: 0.5, y: 0.15, r: 0.22, c: 'rgba(200,220,180,0.05)' },
    { x: 0.2, y: 0.5, r: 0.20, c: 'rgba(140,190,150,0.07)' },
    { x: 0.8, y: 0.55, r: 0.18, c: 'rgba(170,200,160,0.05)' },
  ];
  for (const b of blobs) {
    const grad = ctx.createRadialGradient(w * b.x, h * b.y, 0, w * b.x, h * b.y, w * b.r);
    grad.addColorStop(0, b.c);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // 顶部光源
  const lightGrad = ctx.createRadialGradient(w * 0.5, h * 0.1, 0, w * 0.5, h * 0.1, w * 0.3);
  lightGrad.addColorStop(0, 'rgba(255,250,240,0.12)');
  lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

// ─── 草叶 ──────────────────────────────────────────────────
function drawGrass(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const soilY = h * 0.72;
  const grassColors = ['#5A8A3A', '#6A9A4A', '#4A7A2A', '#7AAB5A'];
  for (let i = 0; i < 8; i++) {
    const gx = w / 2 + (i - 3.5) * w * 0.05 + Math.sin(t * 0.4 + i * 1.7) * 0.8;
    const gy = soilY + 1;
    const gh = 5 + (i % 4) * 3;
    const sway = Math.sin(t * 0.7 + i * 2.3) * 1.5;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + sway, gy - gh * 0.6, gx + sway * 1.5, gy - gh);
    ctx.strokeStyle = grassColors[i % grassColors.length];
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

// ─── 魔法光粒子 ─────────────────────────────────────────────
function drawMagicParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, progress: number) {
  for (let i = 0; i < 14; i++) {
    const seed = i * 137.5;
    const angle = seed + t * 0.12;
    const r = w * 0.22 + Math.sin(seed + t * 0.18) * w * 0.08;
    const px = w / 2 + Math.cos(angle) * r;
    const py = h * 0.38 + Math.sin(angle * 0.7 + t * 0.08) * r * 0.5;
    const alpha = 0.12 + 0.12 * Math.sin(seed + t * 1.2);
    const ps = 1.2 + Math.sin(seed + t * 1.8) * 0.6;
    ctx.beginPath();
    ctx.arc(px, py, ps, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,230,180,${alpha * (0.5 + progress * 0.5)})`;
    ctx.fill();
  }
}

// ─── 叶片色系 ──────────────────────────────────────────────
const LEAF_PALETTES = [
  { base: '#6AAA50', light: '#A0D060', shadow: '#3A6A3A' }, // 翠绿
  { base: '#5A9A40', light: '#90C850', shadow: '#2D5A2D' }, // 深绿
  { base: '#7AB85A', light: '#B8E070', shadow: '#4A8A3A' }, // 嫩绿
  { base: '#4A8A3A', light: '#80B850', shadow: '#2D5A2D' }, // 暗绿
  { base: '#8AC86A', light: '#C0E880', shadow: '#5A9A40' }, // 亮绿
  { base: '#6A9A4A', light: '#A8D860', shadow: '#3A6A30' }, // 中绿
];

// ─── 植物绘制（茎 + 枝 + 叶），可离屏缓存 ──────────────────
function drawPlant(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, t: number) {
  const soilY = h * 0.72;
  const stemH = h * (0.12 + progress * 0.22);  // 短壮主茎
  const baseX = w / 2;
  const sway = Math.sin(t * 0.4) * 0.6;

  // 主茎 — 短壮，深褐色
  const stemTop = soilY - stemH;
  drawWatercolorBranch(
    ctx,
    baseX, soilY + 2,
    baseX + sway * 0.3, stemTop,
    w * 0.045, w * 0.022,
    sway,
    '#2D1E12', '#4A3520'
  );

  // 一级枝条（3-4根）— 在茎中上部开始分叉
  const branchProg = Math.max(0, (progress - 0.12) / 0.88);
  if (branchProg > 0) {
    const bs = Math.min(branchProg * 1.4, 1); // branch scale
    const forkY = stemTop + stemH * 0.15; // 分叉点

    // 枝条1: 左侧
    const b1EndX = baseX - w * 0.13 * bs;
    const b1EndY = forkY - h * 0.12 * bs;
    drawWatercolorBranch(ctx, baseX - 1, forkY, b1EndX, b1EndY, w * 0.028, w * 0.012, sway * 0.5, '#4A3520', '#6A4A3A');

    // 枝条2: 左中
    const b2EndX = baseX - w * 0.05 * bs;
    const b2EndY = forkY - h * 0.16 * bs;
    drawWatercolorBranch(ctx, baseX, forkY - 2, b2EndX, b2EndY, w * 0.025, w * 0.01, sway * 0.4, '#4A3520', '#5A4A30');

    // 枝条3: 右中
    const b3EndX = baseX + w * 0.06 * bs;
    const b3EndY = forkY - h * 0.15 * bs;
    drawWatercolorBranch(ctx, baseX + 1, forkY - 2, b3EndX, b3EndY, w * 0.025, w * 0.01, sway * 0.4, '#4A3520', '#5A4A30');

    // 枝条4: 右侧
    const b4EndX = baseX + w * 0.14 * bs;
    const b4EndY = forkY - h * 0.13 * bs;
    drawWatercolorBranch(ctx, baseX + 1, forkY, b4EndX, b4EndY, w * 0.028, w * 0.012, sway * 0.5, '#4A3520', '#6A4A3A');

    // 二级枝条
    if (branchProg > 0.35) {
      const ss = Math.min((branchProg - 0.35) / 0.65, 1);

      // 左侧二级
      const s1EndX = b1EndX - w * 0.06 * ss;
      const s1EndY = b1EndY - h * 0.08 * ss;
      drawWatercolorBranch(ctx, b1EndX, b1EndY, s1EndX, s1EndY, w * 0.014, w * 0.006, sway * 0.3, '#5A3A2A', '#6A5A3A');

      const s2EndX = b1EndX + w * 0.02 * ss;
      const s2EndY = b1EndY - h * 0.06 * ss;
      drawWatercolorBranch(ctx, b1EndX, b1EndY, s2EndX, s2EndY, w * 0.012, w * 0.005, sway * 0.3, '#5A3A2A', '#7A6A4A');

      // 右侧二级
      const s3EndX = b4EndX + w * 0.07 * ss;
      const s3EndY = b4EndY - h * 0.07 * ss;
      drawWatercolorBranch(ctx, b4EndX, b4EndY, s3EndX, s3EndY, w * 0.014, w * 0.006, sway * 0.3, '#5A3A2A', '#6A5A3A');

      const s4EndX = b4EndX - w * 0.03 * ss;
      const s4EndY = b4EndY - h * 0.05 * ss;
      drawWatercolorBranch(ctx, b4EndX, b4EndY, s4EndX, s4EndY, w * 0.012, w * 0.005, sway * 0.3, '#5A3A2A', '#7A6A4A');

      // 中部二级
      const s5EndX = b2EndX - w * 0.03 * ss;
      const s5EndY = b2EndY - h * 0.06 * ss;
      drawWatercolorBranch(ctx, b2EndX, b2EndY, s5EndX, s5EndY, w * 0.012, w * 0.005, sway * 0.25, '#5A3A2A', '#7A6A4A');

      const s6EndX = b3EndX + w * 0.03 * ss;
      const s6EndY = b3EndY - h * 0.05 * ss;
      drawWatercolorBranch(ctx, b3EndX, b3EndY, s6EndX, s6EndY, w * 0.012, w * 0.005, sway * 0.25, '#5A3A2A', '#7A6A4A');
    }
  }

  // ── 叶片（30-40片，随进度展开）──
  const leafProg = Math.max(0, (progress - 0.2) / 0.8);
  if (leafProg > 0) {
    const ls = Math.min(leafProg * 1.3, 1); // leaf scale
    const baseLeaf = w * 0.05; // 基础叶片大小

    // 定义所有叶片位置（相对于枝条结构）
    const leaves: { x: number; y: number; angle: number; size: number; palette: number; threshold: number }[] = [];

    // 主茎叶片
    leaves.push({ x: baseX + 2, y: soilY - stemH * 0.4, angle: -0.3, size: baseLeaf * 0.9, palette: 0, threshold: 0.1 });
    leaves.push({ x: baseX - 2, y: soilY - stemH * 0.5, angle: 0.4, size: baseLeaf * 0.85, palette: 1, threshold: 0.15 });
    leaves.push({ x: baseX + 3, y: soilY - stemH * 0.65, angle: -0.5, size: baseLeaf * 0.8, palette: 2, threshold: 0.2 });

    // 分叉处叶片
    const forkY = (soilY - stemH) + stemH * 0.15;
    leaves.push({ x: baseX + 1, y: forkY, angle: -0.2, size: baseLeaf * 0.85, palette: 3, threshold: 0.25 });
    leaves.push({ x: baseX - 1, y: forkY + 3, angle: 0.3, size: baseLeaf * 0.8, palette: 4, threshold: 0.3 });
    leaves.push({ x: baseX, y: forkY - 2, angle: 0.1, size: baseLeaf * 0.75, palette: 5, threshold: 0.35 });

    // 一级枝条上的叶片（每根枝条3-4片）
    const bs = Math.min(branchProg * 1.4, 1);
    // 枝条1（左）
    const b1x = baseX - w * 0.13 * bs;
    const b1y = forkY - h * 0.12 * bs;
    leaves.push({ x: b1x, y: b1y, angle: 0.5, size: baseLeaf * 0.9, palette: 0, threshold: 0.3 });
    leaves.push({ x: b1x + 2, y: b1y + 4, angle: -0.2, size: baseLeaf * 0.75, palette: 1, threshold: 0.35 });
    leaves.push({ x: b1x - 2, y: b1y + 2, angle: 0.3, size: baseLeaf * 0.7, palette: 2, threshold: 0.4 });
    leaves.push({ x: b1x * 0.7 + baseX * 0.3, y: (b1y + forkY) / 2, angle: 0.6, size: baseLeaf * 0.7, palette: 3, threshold: 0.35 });

    // 枝条2（左中）
    const b2x = baseX - w * 0.05 * bs;
    const b2y = forkY - h * 0.16 * bs;
    leaves.push({ x: b2x, y: b2y, angle: 0.2, size: baseLeaf * 0.85, palette: 4, threshold: 0.3 });
    leaves.push({ x: b2x - 2, y: b2y + 3, angle: -0.3, size: baseLeaf * 0.7, palette: 5, threshold: 0.35 });
    leaves.push({ x: b2x + 1, y: b2y - 2, angle: 0.4, size: baseLeaf * 0.65, palette: 0, threshold: 0.4 });

    // 枝条3（右中）
    const b3x = baseX + w * 0.06 * bs;
    const b3y = forkY - h * 0.15 * bs;
    leaves.push({ x: b3x, y: b3y, angle: -0.2, size: baseLeaf * 0.85, palette: 1, threshold: 0.3 });
    leaves.push({ x: b3x + 2, y: b3y + 3, angle: 0.3, size: baseLeaf * 0.7, palette: 2, threshold: 0.35 });
    leaves.push({ x: b3x - 1, y: b3y - 2, angle: -0.4, size: baseLeaf * 0.65, palette: 3, threshold: 0.4 });

    // 枝条4（右）
    const b4x = baseX + w * 0.14 * bs;
    const b4y = forkY - h * 0.13 * bs;
    leaves.push({ x: b4x, y: b4y, angle: -0.5, size: baseLeaf * 0.9, palette: 4, threshold: 0.3 });
    leaves.push({ x: b4x + 2, y: b4y + 4, angle: 0.2, size: baseLeaf * 0.75, palette: 5, threshold: 0.35 });
    leaves.push({ x: b4x - 2, y: b4y + 2, angle: -0.3, size: baseLeaf * 0.7, palette: 0, threshold: 0.4 });
    leaves.push({ x: b4x * 0.7 + baseX * 0.3, y: (b4y + forkY) / 2, angle: -0.6, size: baseLeaf * 0.7, palette: 1, threshold: 0.35 });

    // 二级枝条末端叶片（仅当二级枝条出现时）
    if (branchProg > 0.35) {
      const ss2 = Math.min((branchProg - 0.35) / 0.65, 1);
      // 左侧二级末端
      const sl1x = b1x - w * 0.06 * ss2;
      const sl1y = b1y - h * 0.08 * ss2;
      leaves.push({ x: sl1x, y: sl1y, angle: 0.3, size: baseLeaf * 0.7, palette: 2, threshold: 0.45 });
      leaves.push({ x: sl1x - 1, y: sl1y + 2, angle: -0.2, size: baseLeaf * 0.6, palette: 3, threshold: 0.5 });

      const sl2x = b1x + w * 0.02 * ss2;
      const sl2y = b1y - h * 0.06 * ss2;
      leaves.push({ x: sl2x, y: sl2y, angle: 0.1, size: baseLeaf * 0.65, palette: 4, threshold: 0.5 });

      // 右侧二级末端
      const sr1x = b4x + w * 0.07 * ss2;
      const sr1y = b4y - h * 0.07 * ss2;
      leaves.push({ x: sr1x, y: sr1y, angle: -0.3, size: baseLeaf * 0.7, palette: 5, threshold: 0.45 });
      leaves.push({ x: sr1x + 1, y: sr1y + 2, angle: 0.2, size: baseLeaf * 0.6, palette: 0, threshold: 0.5 });

      const sr2x = b4x - w * 0.03 * ss2;
      const sr2y = b4y - h * 0.05 * ss2;
      leaves.push({ x: sr2x, y: sr2y, angle: -0.1, size: baseLeaf * 0.65, palette: 1, threshold: 0.5 });

      // 中部二级末端
      const sm1x = b2x - w * 0.03 * ss2;
      const sm1y = b2y - h * 0.06 * ss2;
      leaves.push({ x: sm1x, y: sm1y, angle: 0.2, size: baseLeaf * 0.65, palette: 2, threshold: 0.5 });

      const sm2x = b3x + w * 0.03 * ss2;
      const sm2y = b3y - h * 0.05 * ss2;
      leaves.push({ x: sm2x, y: sm2y, angle: -0.2, size: baseLeaf * 0.65, palette: 3, threshold: 0.5 });
    }

    // 顶端嫩叶
    leaves.push({ x: baseX, y: soilY - stemH - 2, angle: -0.05, size: baseLeaf * 0.7, palette: 4, threshold: 0.55 });
    leaves.push({ x: baseX + 1, y: soilY - stemH, angle: 0.15, size: baseLeaf * 0.6, palette: 5, threshold: 0.6 });
    leaves.push({ x: baseX - 1, y: soilY - stemH - 1, angle: 0.25, size: baseLeaf * 0.55, palette: 4, threshold: 0.65 });

    // 绘制叶片
    for (const leaf of leaves) {
      if (leafProg < leaf.threshold) continue;
      const leafScale = Math.min((leafProg - leaf.threshold) * 3 + 0.3, 1) * ls;
      const palette = LEAF_PALETTES[leaf.palette];
      const swayOffset = Math.sin(t * 0.5 + leaf.x * 0.08) * 0.03;
      drawWatercolorLeaf(
        ctx,
        leaf.x, leaf.y,
        leaf.angle,
        leaf.size * leafScale,
        palette.base,
        palette.light,
        palette.shadow,
        swayOffset
      );
    }
  }
}

// ─── 主组件（性能优化版：离屏缓存 + 帧率节流 + reduced-motion）──
function ParticleAvatar({ growth = 0.5, size = 200, animate = true }: ParticleAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR 上限：小头像 1x，其他 1.5x（原来统一 2x 像素量减半）
    const dpr = Math.min(window.devicePixelRatio || 1, size < 60 ? 1 : 1.5);
    const w = size;
    const h = size;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const progress = Math.min(growth, 1);

    // 检测 reduced-motion 偏好；小头像（< 60px）也不需要动画
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = animate && !prefersReducedMotion && size >= 60;

    // ── 离屏画布：静态层（背景 + 光晕 + 土壤 + 植物）只渲染一次 ──
    // 原来每帧重绘 ~250 次 canvas 操作，现在改为 1 次 drawImage + ~22 次动态绘制
    const staticCanvas = document.createElement('canvas');
    staticCanvas.width = w * dpr;
    staticCanvas.height = h * dpr;
    const sCtx = staticCanvas.getContext('2d');
    if (!sCtx) return;
    sCtx.scale(dpr, dpr);

    // 柔光背景（仅大尺寸时显示）
    if (size >= 120) {
      drawBokehBackground(sCtx, w, h);
    }

    // 金色光晕
    const glowGrad = sCtx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.45);
    glowGrad.addColorStop(0, `rgba(255,240,200,${0.06 + progress * 0.04})`);
    glowGrad.addColorStop(1, 'rgba(255,240,200,0)');
    sCtx.fillStyle = glowGrad;
    sCtx.fillRect(0, 0, w, h);

    // 土壤（完全静态）
    drawWatercolorSoil(sCtx, w, h);

    // 植物：茎 + 枝 + 叶（静态渲染，t=0）
    drawPlant(sCtx, w, h, progress, 0);

    // ── 渲染循环（仅动态元素：粒子 + 草叶）──
    let lastTime = 0;
    const targetFPS = 20; // 水彩动画很柔和，20fps 足够流畅（原 60fps → CPU 降 66%）
    const frameInterval = 1000 / targetFPS;

    const render = (time: number) => {
      if (shouldAnimate && time - lastTime < frameInterval) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }
      lastTime = time;
      const t = shouldAnimate ? time * 0.001 : 0;

      ctx.clearRect(0, 0, w, h);

      // 1 次 drawImage 替代原来每帧 ~200 次静态绘制
      ctx.drawImage(staticCanvas, 0, 0, w, h);

      // 动态元素：魔法光粒子 + 草叶（约 22 次绘制操作）
      drawMagicParticles(ctx, w, h, t, progress);
      drawGrass(ctx, w, h, t);

      if (!shouldAnimate) return; // 静态帧，不启动循环

      frameRef.current = requestAnimationFrame(render);
    };

    if (shouldAnimate) {
      frameRef.current = requestAnimationFrame(render);
    } else {
      render(0); // 渲染一帧静态画面
    }

    return () => cancelAnimationFrame(frameRef.current);
  }, [growth, size, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}

export default ParticleAvatar;
export { ParticleAvatar };
