/**
 * Excel template generation and parsing utilities.
 * Uses SheetJS (xlsx) for base I/O and JSZip for data validation injection.
 */
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { CHILDREN_FIVE_TIMES, type TimeTypeKey, type Memory, generateId } from './store';

/**
 * Generate and download the Excel template with:
 * - Headers: 日期 / 分类 / 内容
 * - Dropdown data validation on the 分类 column
 * - Example rows
 * - Date format: YYYY-MM-DD
 */
export async function downloadTemplate(): Promise<void> {
  const headers = ['日期', '分类', '内容'];
  const examples = [
    ['2024-07-18', '生存时间', '小宝第一次自己穿鞋，花了二十分钟，但坚持完成了'],
    ['2024-07-20', '好玩时间', '今天在公园喂鸽子，小宝笑得特别开心'],
    ['2024-07-22', '心流时间', '小宝专注地搭了一个小时积木，完全沉浸其中'],
  ];

  const wsData = [headers, ...examples];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '回忆记录');

  // Write to array buffer
  const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Use JSZip to inject data validation XML
  const zip = await JSZip.loadAsync(wbArray);
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('找不到工作表文件');
  }
  let sheetXml = await sheetFile.async('string');

  // Build the data validation XML for the dropdown
  const categoryLabels = CHILDREN_FIVE_TIMES.map((c) => c.label);
  const formula1 = categoryLabels.join(',');
  const dataValidationXml = [
    '<dataValidations count="1">',
    '  <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="B2:B2000">',
    `    <formula1>"${formula1}"</formula1>`,
    '  </dataValidation>',
    '</dataValidations>',
  ].join('\n');

  // Insert before the closing worksheet tag
  sheetXml = sheetXml.replace('</worksheet>', dataValidationXml + '\n</worksheet>');
  zip.file(sheetPath, sheetXml);

  // Generate the final blob
  const finalArray = await zip.generateAsync({ type: 'arraybuffer' });
  const blob = new Blob([finalArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '时光镜像-回忆导入模板.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedRow {
  success: boolean;
  rowNumber: number;
  date?: string;
  timeType?: string;
  timeTypeLabel?: string;
  content?: string;
  error?: string;
}

/**
 * Parse an uploaded Excel file and convert rows to Memory objects.
 * Returns parsed rows with validation results.
 */
export async function parseExcelFile(
  file: File
): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });

  // Find the first valid sheet (skip hidden sheets if any)
  let sheetName = '';
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (sheet['!ref']) {
      sheetName = name;
      break;
    }
  }
  if (!sheetName) {
    return [{ success: false, rowNumber: 0, error: '工作簿中找不到有效工作表' }];
  }

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: ['date', 'timeType', 'content'],
    range: 1, // Skip header row
    defval: '',
    blankrows: false,
  });

  const results: ParsedRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawDate = String(row.date ?? '').trim();
    const rawTimeType = String(row.timeType ?? '').trim();
    const rawContent = String(row.content ?? '').trim();

    if (!rawContent) {
      results.push({ success: false, rowNumber, error: '内容为空' });
      return;
    }

    const dateStr = normalizeDate(rawDate);
    if (!dateStr) {
      results.push({
        success: false, rowNumber,
        date: rawDate, timeType: rawTimeType, content: rawContent,
        error: `日期格式无效: "${rawDate}"，请使用 YYYY-MM-DD 格式`,
      });
      return;
    }

    const matchedCat = CHILDREN_FIVE_TIMES.find(
      (c) => c.label === rawTimeType || c.value === rawTimeType
    );
    if (!matchedCat) {
      results.push({
        success: false, rowNumber,
        date: dateStr, timeType: rawTimeType, content: rawContent,
        error: `分类无效: "${rawTimeType}"，请从下拉菜单选择`,
      });
      return;
    }

    results.push({
      success: true, rowNumber,
      date: dateStr, timeType: matchedCat.value, timeTypeLabel: matchedCat.label, content: rawContent,
    });
  });

  return results;
}

/**
 * Convert parsed rows to Memory objects.
 */
export function parsedRowsToMemories(rows: ParsedRow[]): Memory[] {
  return rows
    .filter((r): r is ParsedRow & { success: true; date: string; timeType: string; content: string } =>
      r.success && r.date !== undefined && r.timeType !== undefined && r.content !== undefined
    )
    .map((r) => ({
      id: generateId(),
      date: r.date,
      content: r.content,
      timeTypes: [r.timeType as TimeTypeKey],
      emotion: '',
      scene: '',
      tags: [],
      type: 'text' as const,
      createdAt: new Date().toISOString(),
    }));
}

/**
 * Normalize various date formats to YYYY-MM-DD.
 */
function normalizeDate(raw: string): string | null {
  if (!raw) return null;

  // Try YYYY-MM-DD or YYYY/MM/DD
  const slashMatch = raw.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (slashMatch) {
    const [, y, m, d] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try Excel serial date number
  const num = Number(raw);
  if (!isNaN(num) && num > 30000 && num < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Try Date.parse as fallback
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}