// 图片压缩 + 水印工具

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  watermark?: WatermarkOptions;
}

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  color?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

/**
 * 压缩图片并添加水印，返回 base64 data URL
 */
export async function compressAndWatermark(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    watermark,
  } = options;

  const img = await loadImage(file);

  // 计算缩放比例
  let width = img.width;
  let height = img.height;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  // 绘制到 canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // 添加水印
  if (watermark?.text) {
    const fontSize = watermark.fontSize || Math.max(14, Math.round(width * 0.025));
    ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = watermark.color || 'rgba(255, 255, 255, 0.85)';
    ctx.textBaseline = 'bottom';

    const padding = Math.round(width * 0.02);
    const metrics = ctx.measureText(watermark.text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    let x: number;
    let y: number;

    switch (watermark.position || 'bottom-right') {
      case 'bottom-left':
        x = padding;
        y = height - padding;
        break;
      case 'top-right':
        x = width - textWidth - padding;
        y = padding + textHeight;
        break;
      case 'top-left':
        x = padding;
        y = padding + textHeight;
        break;
      default:
        x = width - textWidth - padding;
        y = height - padding;
    }

    // 文字阴影，确保在浅色背景上可见
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(watermark.text, x, y);
    ctx.shadowColor = 'transparent';
  }

  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 生成水印文字（时间 + 车牌号）
 */
export function generateWatermarkText(plateNo?: string): string {
  const now = new Date();
  const dateStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return plateNo ? `${plateNo} | ${dateStr}` : dateStr;
}

/**
 * 校验图片文件
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: '仅支持 JPG / PNG / WebP / GIF 格式' };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: '单张图片不能超过 10MB' };
  }
  return { valid: true };
}
