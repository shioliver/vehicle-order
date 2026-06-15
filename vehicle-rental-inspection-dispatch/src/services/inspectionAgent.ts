import type { InspectionItemResult, InspectionGrade, Vehicle } from '@/types/domain';

// DeepSeek 模型名称
export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

// 本地配置（用户在抽屉中直接维护，存储于 localStorage）
export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: DeepSeekModel;
}

const CONFIG_KEY = 'inspection-agent-config-v1';
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const PROXY_BASE_URL = '/deepseek';

export function loadAgentConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AgentConfig>;
      return {
        apiKey: parsed.apiKey ?? '',
        baseUrl: parsed.baseUrl || DEFAULT_BASE_URL,
        defaultModel: (parsed.defaultModel as DeepSeekModel) || 'deepseek-chat'
      };
    }
  } catch {
    // ignore
  }
  return { apiKey: '', baseUrl: DEFAULT_BASE_URL, defaultModel: 'deepseek-chat' };
}

export function saveAgentConfig(config: AgentConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function resolveEndpoint(): { url: string; headers: Record<string, string> } {
  const config = loadAgentConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // 用户在抽屉里填了 Key 就直连官方接口
  if (config.apiKey) {
    const base = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    headers.Authorization = `Bearer ${config.apiKey}`;
    return { url: `${base}/chat/completions`, headers };
  }
  // 构建期注入的环境变量兜底（本地 .env 或 Amplify 后台环境变量都可以）
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEEPSEEK_API_KEY;
  if (envKey) {
    const base = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    headers.Authorization = `Bearer ${envKey}`;
    return { url: `${base}/chat/completions`, headers };
  }
  // 开发环境走 vite 代理
  if (import.meta.env.DEV) {
    return { url: `${PROXY_BASE_URL}/chat/completions`, headers };
  }
  // 生产环境无 Key：抛出可识别错误，由 UI 引导用户配置
  throw new Error('NO_API_KEY: 请在 AI 检测助手抽屉里双击标题，填入 DeepSeek API Key 后再使用。');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InspectionContext {
  form: {
    plateNo: string;
    vin: string;
    brandModel: string;
    energyType: Vehicle['energyType'];
    color: string;
    produceDate: string;
    registerDate: string;
    mileage: number;
    purpose: string;
    grade: InspectionGrade;
    abnormalSummary: string;
    suggestion: string;
  };
  items: InspectionItemResult[];
}

export interface JudgementResult {
  grade: InspectionGrade;
  floodVerdict: '正常' | '疑似水泡' | '确认水泡';
  fireVerdict: '正常' | '疑似火烧' | '确认火烧';
  crashVerdict: '正常' | '确认事故车';
  riskTags: string[];
  reasoning: string;
}

export interface SummaryResult {
  abnormalSummary: string;
  suggestion: string;
}

const SYSTEM_PROMPT_BASE = `你是一名拥有十年经验的二手车专业评估师，熟悉车辆检测行业标准与网约车入库规范。
你需要协助评估师完成检测录入、风险判定与报告撰写。回答必须：
1. 专业、严谨、可执行；
2. 引用客观依据，避免夸张；
3. 按用户要求的格式（JSON 或 Markdown）输出。`;

function summarizeContext(ctx: InspectionContext) {
  const abnormal = ctx.items.filter((i) => i.result === '异常');
  const grouped = abnormal.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(`${item.item}（${item.remark || '未填写备注'}）`);
    return acc;
  }, {});
  const abnormalText = Object.entries(grouped)
    .map(([cat, list]) => `- ${cat}：${list.join('；')}`)
    .join('\n');
  return `车辆基础信息：
车牌：${ctx.form.plateNo || '未填'}
VIN：${ctx.form.vin || '未填'}
品牌车型：${ctx.form.brandModel || '未填'}
能源类型：${ctx.form.energyType}
颜色：${ctx.form.color || '未填'}
生产日期：${ctx.form.produceDate || '未填'}
首次上牌：${ctx.form.registerDate || '未填'}
表显里程：${ctx.form.mileage} km
检测目的：${ctx.form.purpose}
当前评级：${ctx.form.grade}

异常检测项（共 ${abnormal.length} 项）：
${abnormalText || '（暂无异常）'}`;
}

async function callDeepSeek(params: {
  model: DeepSeekModel;
  messages: ChatMessage[];
  stream?: boolean;
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
}): Promise<Response> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: params.stream ?? false,
    temperature: params.temperature ?? 0.3
  };
  if (params.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  const { url, headers } = resolveEndpoint();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`接口错误 ${res.status}：${text || res.statusText}`);
  }
  return res;
}

// 流式对话：逐段回调 chunk
export async function streamChat(
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  options?: { model?: DeepSeekModel; signal?: AbortSignal }
): Promise<string> {
  const config = loadAgentConfig();
  const model = options?.model ?? config.defaultModel ?? 'deepseek-chat';
  const { url, headers } = resolveEndpoint();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.4 }),
    signal: options?.signal
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`流式接口错误 ${res.status}：${text || res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // 忽略 keepalive 等非 JSON 行
      }
    }
  }
  return full;
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]+?)```/i) || text.match(/```\s*([\s\S]+?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

// 一键判定：评级 + 风险（用 reasoner 更稳）
export async function judgeInspection(ctx: InspectionContext): Promise<JudgementResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_BASE },
    {
      role: 'user',
      content: `请基于以下检测信息，给出综合判定，并仅以 JSON 输出，字段：
{
  "grade": "S/A/B/C/D 之一",
  "floodVerdict": "正常/疑似水泡/确认水泡",
  "fireVerdict": "正常/疑似火烧/确认火烧",
  "crashVerdict": "正常/确认事故车",
  "riskTags": ["风险点简短标签数组"],
  "reasoning": "200 字以内的判定依据"
}

判定原则：
- 水泡车专项检测异常项 ≥2 视为确认水泡，=1 视为疑似水泡；
- 火烧车专项检测异常项 ≥2 视为确认火烧，=1 视为疑似火烧；
- 重大事故专项检测出现任一异常即视为确认事故车；
- 评级综合考虑车龄、里程、异常项数量及严重程度；事故/水泡/火烧确认时不得高于 C。

${summarizeContext(ctx)}`
    }
  ];
  const res = await callDeepSeek({
    model: 'deepseek-reasoner',
    messages,
    responseFormat: 'json_object',
    temperature: 0.2
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(extractJson(raw)) as JudgementResult;
  return parsed;
}

// 生成异常摘要 + 维修建议
export async function generateSummary(ctx: InspectionContext): Promise<SummaryResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_BASE },
    {
      role: 'user',
      content: `请基于以下检测信息，输出 JSON：
{
  "abnormalSummary": "150 字以内，按部位分类描述异常情况，措辞专业且面向客户",
  "suggestion": "150 字以内的维修/评估建议，含优先级，可分点"
}
若无异常，请如实说明无明显异常。

${summarizeContext(ctx)}`
    }
  ];
  const res = await callDeepSeek({
    model: 'deepseek-reasoner',
    messages,
    responseFormat: 'json_object',
    temperature: 0.4
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(extractJson(raw)) as SummaryResult;
}

// 推荐重点检测项（基于车型、车龄、能源类型）
export async function recommendFocusItems(ctx: InspectionContext): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_BASE },
    {
      role: 'user',
      content: `请根据车辆信息，列出本次检测应重点关注的检测项（最多 8 条），每条一行，格式：「分类 - 检测项：关注原因」。
不要输出 JSON 或代码块，直接列表。

${summarizeContext(ctx)}`
    }
  ];
  const res = await callDeepSeek({ model: 'deepseek-chat', messages, temperature: 0.5 });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// 漏项检查：找出疑似遗漏 / 备注不完整的项
export interface MissingItem {
  category: string;
  item: string;
  reason: string;
}

export async function detectMissingItems(ctx: InspectionContext): Promise<MissingItem[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_BASE },
    {
      role: 'user',
      content: `请基于车辆信息和当前检测项状态，找出"录入不完整或疑似漏检"的项目，仅输出 JSON：
{
  "items": [
    { "category": "外观检测", "item": "前保险杠", "reason": "异常但备注为空，需补充损伤位置和尺寸" }
  ]
}

判定原则：
- 异常项备注为空、'无'、'未填' 视为不完整；
- 该车型/车龄常见易损部位若仍标为正常，且缺乏佐证，提示复查；
- 最多返回 8 条。

${summarizeContext(ctx)}`
    }
  ];
  const res = await callDeepSeek({
    model: 'deepseek-chat',
    messages,
    responseFormat: 'json_object',
    temperature: 0.3
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(extractJson(raw)) as { items?: MissingItem[] };
  return parsed.items ?? [];
}

// 单条异常备注 AI 补全
export async function suggestRemark(input: {
  category: string;
  item: string;
  currentRemark: string;
  vehicle: { brandModel: string; mileage: number; produceDate: string };
}): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_BASE },
    {
      role: 'user',
      content: `请为以下异常检测项生成一条专业、客观、面向客户可阅读的备注（30~60 字），直接输出文字，不加引号或前缀。

车辆：${input.vehicle.brandModel}（${input.vehicle.produceDate}，${input.vehicle.mileage} km）
分类：${input.category}
检测项：${input.item}
当前备注：${input.currentRemark || '（空）'}`
    }
  ];
  const res = await callDeepSeek({ model: 'deepseek-chat', messages, temperature: 0.5 });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim().replace(/^["「]|["」]$/g, '') ?? '';
}

export function buildContextSystemPrompt(ctx: InspectionContext): string {
  return `${SYSTEM_PROMPT_BASE}

以下是当前检测会话上下文，回答时请结合这些信息：

${summarizeContext(ctx)}`;
}
