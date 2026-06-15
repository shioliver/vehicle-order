import type { VehicleAttachment } from '@/types/domain';

type AttachmentPreview =
  | { mode: 'image'; src: string }
  | { mode: 'pdf'; src: string }
  | { mode: 'html'; html: string }
  | { mode: 'unsupported'; reason: string };

interface ParsedDataUrl {
  mime: string;
  isBase64: boolean;
  data: string;
}

function parseDataUrl(url: string): ParsedDataUrl | null {
  const match = url.match(/^data:([^;,]*)([^,]*),(.*)$/i);
  if (!match) return null;
  return {
    mime: (match[1] || 'text/plain').toLowerCase(),
    isBase64: match[2].toLowerCase().includes(';base64'),
    data: match[3]
  };
}

function decodeDataUrlText(parsed: ParsedDataUrl) {
  try {
    if (!parsed.isBase64) {
      return decodeURIComponent(parsed.data).replace(/^\uFEFF/, '');
    }

    const binary = atob(parsed.data.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return '';
  }
}

function isHtmlDocument(value: string) {
  return /^\s*(<!doctype html|<html|<head|<body|<style)/i.test(value);
}

function inlineHtmlFromAttachment(file: VehicleAttachment) {
  const parsed = parseDataUrl(file.url);
  if (!parsed) return '';

  const lowerName = file.name.toLowerCase();
  const isHtml = parsed.mime === 'text/html' || lowerName.endsWith('.html') || lowerName.endsWith('.htm');
  const isWordHtml = file.type === 'word' || lowerName.endsWith('.doc') || parsed.mime.includes('msword');

  if (!isHtml && !isWordHtml) return '';

  const decoded = decodeDataUrlText(parsed);
  if (!decoded) return '';
  if (isHtml) return decoded;
  return isHtmlDocument(decoded) ? decoded : '';
}

export function attachmentPreview(file: VehicleAttachment): AttachmentPreview {
  const inlineHtml = inlineHtmlFromAttachment(file);
  if (inlineHtml) return { mode: 'html', html: inlineHtml };
  if (file.type === 'image') return { mode: 'image', src: file.url };
  if (file.type === 'pdf') return { mode: 'pdf', src: file.url };

  return {
    mode: 'unsupported',
    reason: file.type === 'word' ? '这个 Word 文件不是网页格式，浏览器无法直接内嵌预览。请上传检测工具导出的 .doc 或 PDF。' : '当前附件格式暂不支持浏览器内直接预览。'
  };
}
