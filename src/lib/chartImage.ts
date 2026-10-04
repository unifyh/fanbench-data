import { messages } from '../i18n';
import { applications, chartScale, modelName } from './comparison';
import type { Fan, Locale } from '../types';

const width = 1440;
const padding = 32;
const nameWidth = 320;
const gap = 28;
const columnWidth = (width - padding * 2 - nameWidth - gap * 3) / 3;
const plotWidth = columnWidth - 72;
const fontFamily = '"Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const colors = { text: '#242a27', muted: '#626b65', bar: '#4a8168', line: '#e0e4e1', axis: '#a3ada0' };

// Measure actual glyphs so both long English names and Chinese labels wrap without clipping.
function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.match(/\S+\s*/gu) ?? []) {
    if (line && context.measureText(line + word.trimEnd()).width > maxWidth) {
      lines.push(line.trimEnd());
      line = '';
    }
    for (const character of word) {
      if (line && context.measureText(line + character).width > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += character;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

export function canCopyChartImage(): boolean {
  return window.isSecureContext && typeof navigator.clipboard?.write === 'function'
    && typeof ClipboardItem !== 'undefined'
    && (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'));
}

export async function copyChartImage(png: Promise<Blob>): Promise<void> {
  // Call write during the click, before awaiting rendering, to retain Firefox/Safari user activation.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function renderChartImage(fans: Fan[], locale: Locale): Promise<Blob> {
  if (!fans.length) throw new Error('No fans to export');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  const t = messages[locale];
  const scale = chartScale(fans);
  const font = (size: number, weight = 400) => { context.font = `${weight} ${size}px ${fontFamily}`; };
  const rows = fans.map(fan => {
    font(13);
    const brandWidth = context.measureText(fan.brandLabel[locale]).width;
    font(14, 600);
    const model = modelName(fan, locale);
    const modelWidth = context.measureText(model).width;
    const names = wrapText(context, model, nameWidth - 8);
    const inline = brandWidth + 7 + modelWidth <= nameWidth - 8;
    return { fan, names, modelWidth, inline, height: (names.length + (inline ? 0 : 1)) * 20 + 32 };
  });
  const top = 158;
  const bottom = top + rows.reduce((sum, row) => sum + row.height, 0);
  font(13);
  const footer = [t.contextText, t.independent].flatMap(text => wrapText(context, text, width - padding * 2));
  const height = bottom + 112 + footer.length * 20;
  // Prefer 2× output, but bound the canvas area and dimensions for long lists on mobile browsers.
  const resolution = Math.min(2, 8192 / height, Math.sqrt(16_000_000 / (width * height)));
  canvas.width = Math.floor(width * resolution);
  canvas.height = Math.floor(height * resolution);
  context.scale(canvas.width / width, canvas.height / height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.textBaseline = 'middle';

  const text = (value: string, x: number, y: number, size = 14, color = colors.text, weight = 400, align: CanvasTextAlign = 'left') => {
    font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = colors.line) => {
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  };
  const columnX = (index: number) => padding + nameWidth + gap + index * (columnWidth + gap);
  const nameRight = padding + nameWidth - 8;

  text(t.siteName, padding, 42, 26, colors.text, 600);
  text(`${t.testCondition} · ${t.higherBetter}`, padding, 78, 14, colors.muted);
  text(`${fans.length} ${t.fans}`, width - padding, 42, 14, colors.muted, 400, 'right');
  text(`${t.fan} · ${t.dimensions}`, nameRight, 119, 13, colors.muted, 400, 'right');
  applications.forEach((application, index) => {
    const x = columnX(index);
    text(`${t[application]} · CFM`, x, 115, 17, colors.text, 600);
    for (const tick of scale.ticks) {
      const tickX = x + tick / scale.maximum * plotWidth;
      text(String(tick), tickX, 141, 11, colors.muted, 400, tick === 0 ? 'left' : 'center');
      line(tickX, top - 5, tickX, top, colors.axis);
    }
    line(x, top, x + plotWidth, top, colors.axis);
  });

  let y = top;
  for (const { fan, names, modelWidth, inline, height: rowHeight } of rows) {
    // Match the webpage's inline brand/model identity, wrapping only when they cannot fit.
    context.textBaseline = 'alphabetic';
    text(fan.brandLabel[locale], inline ? nameRight - modelWidth - 7 : nameRight, y + 22, 13, colors.muted, 400, 'right');
    names.forEach((name, index) => text(name, nameRight, y + 22 + (index + (inline ? 0 : 1)) * 20, 14, colors.text, 600, 'right'));
    context.textBaseline = 'middle';
    const dimensions = `${fan.sizeMm} × ${fan.thicknessMm ?? '?'} mm`
      + (fan.thicknessMm === null ? ` · ${t.unverifiedThickness}` : '');
    text(dimensions, nameRight, y + rowHeight - 13, 11, colors.muted, 400, 'right');
    applications.forEach((application, index) => {
      const x = columnX(index);
      const middle = y + rowHeight / 2;
      line(x, y, x, y + rowHeight, colors.axis);
      const measurement = fan.measurements[application];
      if (!measurement) {
        text('—', x + 8, middle, 18, colors.muted);
        return;
      }
      const barWidth = measurement.airflowCfm / scale.maximum * plotWidth;
      const rpm = `${measurement.rpm} RPM`;
      font(12);
      const rpmFits = context.measureText(rpm).width + 16 <= barWidth;
      context.fillStyle = colors.bar;
      context.fillRect(x, middle - 14, barWidth, 28);
      text(measurement.airflowCfm.toFixed(2), x + barWidth + 9, middle + (rpmFits ? 0 : -7), 20, colors.text, 500);
      text(rpm, rpmFits ? x + 8 : x + barWidth + 9, middle + (rpmFits ? 0 : 13), rpmFits ? 12 : 10, rpmFits ? '#ffffff' : colors.muted);
    });
    y += rowHeight;
    line(padding, y, width - padding, y);
  }

  applications.forEach((_, index) => {
    const x = columnX(index);
    line(x, bottom, x + plotWidth, bottom, colors.axis);
    for (const tick of scale.ticks) {
      const tickX = x + tick / scale.maximum * plotWidth;
      line(tickX, bottom, tickX, bottom + 5, colors.axis);
      text(String(tick), tickX, bottom + 18, 11, colors.muted, 400, tick === 0 ? 'left' : 'center');
    }
    text(`${t.airflow} (CFM)`, x + plotWidth / 2, bottom + 40, 12, colors.muted, 400, 'center');
  });
  text(t.attribution, padding, bottom + 72, 14, colors.text, 600);
  text(`${t.commonScale}: 0–${scale.maximum} CFM · — ${t.noData}`, width - padding, bottom + 72, 12, colors.muted, 400, 'right');
  footer.forEach((value, index) => text(value, padding, bottom + 99 + index * 20, 13, colors.muted));

  try {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png');
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
