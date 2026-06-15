<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  buildContextSystemPrompt,
  detectMissingItems,
  generateSummary,
  judgeInspection,
  loadAgentConfig,
  recommendFocusItems,
  saveAgentConfig,
  streamChat,
  type AgentConfig,
  type ChatMessage,
  type DeepSeekModel,
  type InspectionContext,
  type JudgementResult,
  type MissingItem,
  type SummaryResult
} from '@/services/inspectionAgent';

interface AppliedSummary {
  abnormalSummary: string;
  suggestion: string;
}

const props = defineProps<{ context: InspectionContext }>();
const emit = defineEmits<{
  (e: 'apply-summary', payload: AppliedSummary): void;
  (e: 'apply-judgement', payload: JudgementResult): void;
  (e: 'focus-item', payload: { category: string; item: string }): void;
}>();

const visible = ref(false);
const chatModel = ref<DeepSeekModel>('deepseek-chat');
const loadingChat = ref(false);
const loadingJudge = ref(false);
const loadingSummary = ref(false);
const loadingFocus = ref(false);
const loadingMissing = ref(false);
const inputText = ref('');
const focusText = ref('');
const judgement = ref<JudgementResult | null>(null);
const summary = ref<SummaryResult | null>(null);
const missingItems = ref<MissingItem[]>([]);
const messages = ref<ChatMessage[]>([]);
const messageListRef = ref<HTMLElement | null>(null);
let abortController: AbortController | null = null;

// ============ 本地配置（双击标题进入） ============
const configVisible = ref(false);
const configForm = reactive<AgentConfig>(loadAgentConfig());
chatModel.value = configForm.defaultModel;
function openConfig() {
  Object.assign(configForm, loadAgentConfig());
  configVisible.value = true;
}
function saveConfig() {
  saveAgentConfig({ ...configForm });
  chatModel.value = configForm.defaultModel;
  ElMessage.success('配置已保存');
  configVisible.value = false;
}
function clearConfig() {
  configForm.apiKey = '';
  configForm.baseUrl = 'https://api.deepseek.com';
  configForm.defaultModel = 'deepseek-chat';
}

// ============ 麦克风语音输入 ============
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const SpeechCtor =
  (typeof window !== 'undefined' &&
    ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)) ||
  null;
const speechSupported = !!SpeechCtor;
const isRecording = ref(false);
let recognition: SpeechRecognitionLike | null = null;
let interimText = '';
let baseText = '';

// 浏览器/系统信息检测，用于针对性提示
function detectBrowser(): { name: string; isSafari: boolean; isWebView: boolean; isSecure: boolean; host: string } {
  const ua = navigator.userAgent;
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;
  const isSafari = /Safari\//.test(ua) && !/Chrome\//.test(ua) && !isEdge;
  const isFirefox = /Firefox\//.test(ua);
  const isWebView = /(wv|; wv\)|TraeAI)/i.test(ua) || (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
  const host = location.hostname;
  const isSecure = window.isSecureContext || host === 'localhost' || host === '127.0.0.1';
  let name = '当前浏览器';
  if (isEdge) name = 'Microsoft Edge';
  else if (isChrome) name = 'Google Chrome';
  else if (isSafari) name = 'Safari';
  else if (isFirefox) name = 'Firefox';
  return { name, isSafari, isWebView, isSecure, host };
}

// 跨浏览器读取权限状态：granted / denied / prompt / unknown
async function queryMicPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  const perms = (navigator as unknown as { permissions?: { query: (q: { name: string }) => Promise<{ state: string }> } }).permissions;
  if (!perms?.query) return 'unknown';
  try {
    const status = await perms.query({ name: 'microphone' });
    return (status.state as 'granted' | 'denied' | 'prompt') ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// 引导对话框
const permissionDialog = reactive({
  visible: false,
  status: 'unknown' as 'granted' | 'denied' | 'prompt' | 'unsupported' | 'insecure' | 'unknown',
  browser: detectBrowser()
});

const permissionStepsByOS = computed(() => {
  const ua = navigator.userAgent;
  const isMac = /Mac OS X/i.test(ua) && !/iP(hone|ad)/i.test(ua);
  const isWin = /Windows NT/i.test(ua);
  const isIOS = /iP(hone|ad)/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const browser = permissionDialog.browser.name;
  const browserSteps = [
    `① 点击地址栏左侧的 🔒 / ⓘ 图标（${browser}）`,
    '② 找到「麦克风」一项，改为 允许 / Allow',
    '③ 关闭弹窗后刷新本页面 (Ctrl/Cmd + R)'
  ];
  if (isMac) {
    return {
      title: 'macOS + ' + browser,
      steps: [
        ...browserSteps,
        '④ 系统设置 → 隐私与安全性 → 麦克风 → 勾选 ' + browser
      ]
    };
  }
  if (isWin) {
    return {
      title: 'Windows + ' + browser,
      steps: [
        ...browserSteps,
        '④ 设置 → 隐私和安全性 → 麦克风 → 打开「允许应用访问麦克风」并勾选 ' + browser
      ]
    };
  }
  if (isIOS) {
    return {
      title: 'iOS + ' + browser,
      steps: [
        '① 设置 App → ' + browser + ' → 麦克风 → 打开',
        '② 回到本页面刷新（iOS 仅 Safari 14.5+ 支持语音识别，体验有限）'
      ]
    };
  }
  if (isAndroid) {
    return {
      title: 'Android + ' + browser,
      steps: [
        '① 长按桌面 ' + browser + ' 图标 → 应用信息 → 权限 → 麦克风 → 允许',
        ...browserSteps
      ]
    };
  }
  return { title: browser, steps: browserSteps };
});

function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限未授予，请按弹窗指引开启。';
    case 'no-speech':
      return '没有检测到语音，请靠近麦克风再试一次。';
    case 'audio-capture':
      return '未检测到可用麦克风，请检查设备连接。';
    case 'network':
      return '语音识别需要联网（Chrome 会调用谷歌服务），请检查网络。';
    case 'aborted':
      return '语音识别已被中止。';
    default:
      return `语音识别错误：${code}`;
  }
}

async function requestMicViaGetUserMedia(): Promise<'granted' | 'denied' | 'no-device' | 'unsupported' | 'error'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (error) {
    const err = error as DOMException;
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') return 'denied';
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') return 'no-device';
    return 'error';
  }
}

async function openPermissionGuide() {
  permissionDialog.browser = detectBrowser();
  // 1. 不安全上下文：只能引导用户改地址
  if (!permissionDialog.browser.isSecure) {
    permissionDialog.status = 'insecure';
    permissionDialog.visible = true;
    return;
  }
  // 2. API 不支持
  if (!speechSupported) {
    permissionDialog.status = 'unsupported';
    permissionDialog.visible = true;
    return;
  }
  // 3. 查询权限状态
  const state = await queryMicPermission();
  permissionDialog.status = state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
  permissionDialog.visible = true;
}

async function tryGrantInDialog() {
  const result = await requestMicViaGetUserMedia();
  if (result === 'granted') {
    permissionDialog.status = 'granted';
    ElMessage.success('麦克风权限已开启');
    permissionDialog.visible = false;
    await startRecognition();
    return;
  }
  if (result === 'denied') {
    permissionDialog.status = 'denied';
    ElMessage.warning('权限被拒绝，请按下方步骤手动开启');
    return;
  }
  if (result === 'no-device') {
    ElMessage.warning('未检测到可用麦克风');
    return;
  }
  if (result === 'unsupported') {
    permissionDialog.status = 'unsupported';
    return;
  }
  ElMessage.warning('麦克风调用失败，请按指引重试');
}

async function startRecognition() {
  if (!speechSupported) return;
  recognition = new SpeechCtor!();
  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = true;
  baseText = inputText.value ? inputText.value.trimEnd() + ' ' : '';
  interimText = '';
  recognition.onresult = (event) => {
    let finalAdd = '';
    interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) finalAdd += text;
      else interimText += text;
    }
    if (finalAdd) baseText += finalAdd;
    inputText.value = baseText + interimText;
  };
  recognition.onerror = (event) => {
    isRecording.value = false;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      openPermissionGuide();
    } else {
      ElMessage.warning(describeSpeechError(event.error));
    }
  };
  recognition.onend = () => {
    isRecording.value = false;
    if (interimText) {
      inputText.value = baseText + interimText;
      baseText += interimText;
      interimText = '';
    }
  };
  try {
    recognition.start();
    isRecording.value = true;
  } catch (error) {
    ElMessage.warning(`无法启动麦克风：${(error as Error).message}`);
  }
}

async function toggleSpeech() {
  if (isRecording.value) {
    recognition?.stop();
    return;
  }
  permissionDialog.browser = detectBrowser();
  if (!permissionDialog.browser.isSecure) {
    permissionDialog.status = 'insecure';
    permissionDialog.visible = true;
    return;
  }
  if (!speechSupported) {
    permissionDialog.status = 'unsupported';
    permissionDialog.visible = true;
    return;
  }
  const state = await queryMicPermission();
  if (state === 'granted') {
    await startRecognition();
    return;
  }
  if (state === 'denied') {
    permissionDialog.status = 'denied';
    permissionDialog.visible = true;
    return;
  }
  // prompt 或 unknown：直接通过 getUserMedia 触发系统授权弹窗
  const result = await requestMicViaGetUserMedia();
  if (result === 'granted') {
    await startRecognition();
    return;
  }
  if (result === 'denied') {
    permissionDialog.status = 'denied';
    permissionDialog.visible = true;
    return;
  }
  if (result === 'no-device') {
    ElMessage.warning('未检测到可用麦克风');
    return;
  }
  permissionDialog.status = 'prompt';
  permissionDialog.visible = true;
}

onBeforeUnmount(() => {
  recognition?.stop();
});

const visibleMessages = computed(() => messages.value.filter((m) => m.role !== 'system'));
const contextStats = computed(() => {
  const total = props.context.items.length;
  const abnormal = props.context.items.filter((i) => i.result === '异常').length;
  const noRemark = props.context.items.filter((i) => i.result === '异常' && (!i.remark || i.remark === '无')).length;
  return { total, abnormal, noRemark };
});

async function scrollToBottom() {
  await nextTick();
  if (messageListRef.value) messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
}

function ensureSystemPrompt() {
  const prompt = buildContextSystemPrompt(props.context);
  if (!messages.value.length || messages.value[0].role !== 'system') {
    messages.value.unshift({ role: 'system', content: prompt });
  } else {
    messages.value[0] = { role: 'system', content: prompt };
  }
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || loadingChat.value) return;
  ensureSystemPrompt();
  messages.value.push({ role: 'user', content: text });
  messages.value.push({ role: 'assistant', content: '' });
  const replyIndex = messages.value.length - 1;
  inputText.value = '';
  loadingChat.value = true;
  abortController = new AbortController();
  await scrollToBottom();
  try {
    await streamChat(
      messages.value.slice(0, -1),
      (delta) => {
        messages.value[replyIndex] = {
          role: 'assistant',
          content: messages.value[replyIndex].content + delta
        };
        scrollToBottom();
      },
      { model: chatModel.value, signal: abortController.signal }
    );
  } catch (error) {
    messages.value[replyIndex] = {
      role: 'assistant',
      content: `调用失败：${(error as Error).message}`
    };
  } finally {
    loadingChat.value = false;
    abortController = null;
  }
}

function stopChat() {
  abortController?.abort();
  abortController = null;
  loadingChat.value = false;
}

async function runJudge() {
  if (loadingJudge.value) return;
  loadingJudge.value = true;
  try {
    judgement.value = await judgeInspection(props.context);
  } catch (error) {
    ElMessage.warning(`一键判定失败：${(error as Error).message}`);
  } finally {
    loadingJudge.value = false;
  }
}

function applyJudge() {
  if (!judgement.value) return;
  emit('apply-judgement', judgement.value);
  ElMessage.success('已应用 AI 判定结果');
}

async function runSummary() {
  if (loadingSummary.value) return;
  loadingSummary.value = true;
  try {
    summary.value = await generateSummary(props.context);
  } catch (error) {
    ElMessage.warning(`生成摘要失败：${(error as Error).message}`);
  } finally {
    loadingSummary.value = false;
  }
}

function applySummary() {
  if (!summary.value) return;
  emit('apply-summary', summary.value);
  ElMessage.success('已写入异常摘要与建议');
}

async function runFocus() {
  if (loadingFocus.value) return;
  loadingFocus.value = true;
  focusText.value = '';
  try {
    focusText.value = await recommendFocusItems(props.context);
  } catch (error) {
    ElMessage.warning(`推荐失败：${(error as Error).message}`);
  } finally {
    loadingFocus.value = false;
  }
}

async function runMissing() {
  if (loadingMissing.value) return;
  loadingMissing.value = true;
  missingItems.value = [];
  try {
    missingItems.value = await detectMissingItems(props.context);
    if (!missingItems.value.length) ElMessage.success('AI 未发现明显漏项');
  } catch (error) {
    ElMessage.warning(`漏项检查失败：${(error as Error).message}`);
  } finally {
    loadingMissing.value = false;
  }
}

function focusOn(item: MissingItem) {
  emit('focus-item', { category: item.category, item: item.item });
  visible.value = false;
}

watch(visible, (open) => {
  if (open) ensureSystemPrompt();
});
</script>

<template>
  <div class="agent-launcher">
    <el-button type="primary" round class="agent-fab" @click="visible = true">
      <el-icon><MagicStick /></el-icon>
      <span>AI 检测助手</span>
    </el-button>
  </div>

  <el-drawer
    v-model="visible"
    direction="rtl"
    size="480px"
    class="inspection-agent-drawer"
  >
    <template #header>
      <span
        class="agent-drawer-title"
        title="双击进入配置"
        @dblclick="openConfig"
      >AI 检测助手</span>
    </template>
    <div class="agent-shell">
      <section class="agent-context">
        <div class="agent-context-row">
          <span>当前车辆</span>
          <strong>{{ context.form.plateNo || '未填' }} · {{ context.form.brandModel || '未知车型' }}</strong>
        </div>
        <div class="agent-context-row">
          <span>检测项</span>
          <strong>共 {{ contextStats.total }} | 异常 {{ contextStats.abnormal }} | 待补备注 {{ contextStats.noRemark }}</strong>
        </div>
        <div class="agent-context-row">
          <span>对话模型</span>
          <el-radio-group v-model="chatModel" size="small">
            <el-radio-button label="deepseek-chat">通用</el-radio-button>
            <el-radio-button label="deepseek-reasoner">深度推理</el-radio-button>
          </el-radio-group>
        </div>
      </section>

      <section class="agent-actions">
        <el-button :loading="loadingFocus" @click="runFocus">推荐重点</el-button>
        <el-button :loading="loadingMissing" @click="runMissing">漏项检查</el-button>
        <el-button :loading="loadingJudge" type="primary" @click="runJudge">一键判定</el-button>
        <el-button :loading="loadingSummary" type="success" @click="runSummary">生成摘要+建议</el-button>
      </section>

      <section v-if="focusText" class="agent-card">
        <header><strong>重点检测建议</strong><span>deepseek-chat</span></header>
        <pre class="agent-pre">{{ focusText }}</pre>
      </section>

      <section v-if="missingItems.length" class="agent-card">
        <header><strong>漏项 / 待补备注</strong><span>{{ missingItems.length }} 条</span></header>
        <ul class="agent-missing-list">
          <li v-for="(m, idx) in missingItems" :key="idx" @click="focusOn(m)">
            <div class="agent-missing-title">
              <el-tag size="small" type="warning" effect="plain">{{ m.category }}</el-tag>
              <strong>{{ m.item }}</strong>
            </div>
            <p>{{ m.reason }}</p>
          </li>
        </ul>
      </section>

      <section v-if="judgement" class="agent-card">
        <header>
          <strong>AI 判定结果</strong>
          <el-button size="small" type="primary" @click="applyJudge">应用到表单</el-button>
        </header>
        <ul class="agent-judge-list">
          <li><span>建议评级</span><b>{{ judgement.grade }}</b></li>
          <li><span>水泡判定</span><b>{{ judgement.floodVerdict }}</b></li>
          <li><span>火烧判定</span><b>{{ judgement.fireVerdict }}</b></li>
          <li><span>事故判定</span><b>{{ judgement.crashVerdict }}</b></li>
        </ul>
        <div v-if="judgement.riskTags?.length" class="agent-tags">
          <el-tag v-for="tag in judgement.riskTags" :key="tag" type="danger" effect="plain">{{ tag }}</el-tag>
        </div>
        <p class="agent-reasoning">{{ judgement.reasoning }}</p>
      </section>

      <section v-if="summary" class="agent-card">
        <header>
          <strong>异常摘要 / 维修建议</strong>
          <el-button size="small" type="primary" @click="applySummary">写入表单</el-button>
        </header>
        <p><b>异常摘要：</b>{{ summary.abnormalSummary }}</p>
        <p><b>维修建议：</b>{{ summary.suggestion }}</p>
      </section>

      <section class="agent-chat">
        <header>自由提问</header>
        <div ref="messageListRef" class="agent-chat-list">
          <div v-if="!visibleMessages.length" class="agent-chat-empty">
            可问："这台车里程偏高需要重点查什么？" / "异常项汇总怎么写更专业？"
          </div>
          <div
            v-for="(msg, idx) in visibleMessages"
            :key="idx"
            class="agent-chat-bubble"
            :class="msg.role"
          >
            <span class="agent-chat-role">{{ msg.role === 'user' ? '你' : 'AI' }}</span>
            <p>{{ msg.content || (loadingChat && idx === visibleMessages.length - 1 ? '思考中…' : '') }}</p>
          </div>
        </div>
        <div class="agent-chat-input">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="2"
            :placeholder="isRecording ? '聆听中…可继续语音输入' : '输入问题，回车发送'"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <div class="agent-chat-actions">
            <el-button
              size="small"
              :type="isRecording ? 'danger' : 'default'"
              :title="speechSupported ? (isRecording ? '点击结束语音' : '点击开始语音输入') : '当前浏览器不支持语音识别'"
              @click="toggleSpeech"
            >
              <el-icon><Microphone /></el-icon>
              <span style="margin-left: 4px">{{ isRecording ? '结束语音' : '语音输入' }}</span>
            </el-button>
            <el-button v-if="loadingChat" size="small" @click="stopChat">停止</el-button>
            <el-button size="small" type="primary" :loading="loadingChat" @click="sendMessage">发送</el-button>
          </div>
        </div>
      </section>
    </div>
  </el-drawer>

  <el-dialog
    v-model="configVisible"
    title="智能体配置"
    width="460px"
    append-to-body
  >
    <el-form label-position="top" class="agent-config-form">
      <el-form-item label="API Key">
        <el-input
          v-model="configForm.apiKey"
          type="password"
          show-password
          placeholder="sk-xxxx，留空则走开发代理"
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item label="Base URL">
        <el-input v-model="configForm.baseUrl" placeholder="https://api.deepseek.com" />
      </el-form-item>
      <el-form-item label="默认对话模型">
        <el-radio-group v-model="configForm.defaultModel">
          <el-radio-button label="deepseek-chat">通用</el-radio-button>
          <el-radio-button label="deepseek-reasoner">深度推理</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <p class="agent-config-tip">配置仅保存在当前浏览器的本地存储中，不会上传到服务器。</p>
    </el-form>
    <template #footer>
      <el-button @click="clearConfig">清空</el-button>
      <el-button @click="configVisible = false">取消</el-button>
      <el-button type="primary" @click="saveConfig">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="permissionDialog.visible"
    title="开启麦克风权限"
    width="480px"
    append-to-body
  >
    <div class="agent-permission">
      <div class="agent-permission-status" :class="permissionDialog.status">
        <el-tag
          :type="permissionDialog.status === 'granted' ? 'success' : permissionDialog.status === 'denied' || permissionDialog.status === 'insecure' || permissionDialog.status === 'unsupported' ? 'danger' : 'warning'"
          effect="dark"
        >
          {{
            permissionDialog.status === 'granted' ? '已授权' :
            permissionDialog.status === 'denied' ? '已被拒绝' :
            permissionDialog.status === 'insecure' ? '非安全上下文' :
            permissionDialog.status === 'unsupported' ? '浏览器不支持' :
            '尚未授权'
          }}
        </el-tag>
        <span>当前环境：{{ permissionDialog.browser.name }} · {{ permissionDialog.browser.host }}</span>
      </div>

      <template v-if="permissionDialog.status === 'insecure'">
        <p class="agent-permission-tip">
          浏览器要求麦克风必须在 <b>https://</b> 或 <b>http://localhost</b> 下使用。
          当前地址 <code>{{ permissionDialog.browser.host }}</code> 不安全，因此无法弹出授权对话框。
        </p>
        <ol class="agent-permission-steps">
          <li>把浏览器地址改成 <b>http://localhost:5173/</b> 重新打开</li>
          <li>或将站点部署到 HTTPS 域名后访问</li>
        </ol>
      </template>

      <template v-else-if="permissionDialog.status === 'unsupported'">
        <p class="agent-permission-tip">
          当前浏览器（{{ permissionDialog.browser.name }}）不支持 Web Speech API。
        </p>
        <ol class="agent-permission-steps">
          <li>建议改用 <b>Google Chrome</b> 或 <b>Microsoft Edge</b> 最新版</li>
          <li>iOS 用户请使用 Safari 14.5+，Android 用户请使用 Chrome</li>
          <li>如在 Trae / Tauri 等内嵌 WebView 中，请用真实浏览器打开 <b>http://localhost:5173/</b></li>
        </ol>
      </template>

      <template v-else-if="permissionDialog.status === 'denied'">
        <p class="agent-permission-tip">
          浏览器或操作系统已拒绝麦克风权限，无法仅通过页面恢复，请按以下步骤手动开启：
        </p>
        <p class="agent-permission-os">{{ permissionStepsByOS.title }}</p>
        <ol class="agent-permission-steps">
          <li v-for="(step, idx) in permissionStepsByOS.steps" :key="idx">{{ step }}</li>
        </ol>
        <p class="agent-permission-tip secondary">
          全部完成后点击下方「我已开启，重新检测」即可。
        </p>
      </template>

      <template v-else-if="permissionDialog.status === 'prompt' || permissionDialog.status === 'unknown'">
        <p class="agent-permission-tip">
          点击下方「立即授权」，浏览器会弹出系统级麦克风权限请求，请选择「允许」。
        </p>
        <p class="agent-permission-os">如果没有弹窗：{{ permissionStepsByOS.title }}</p>
        <ol class="agent-permission-steps">
          <li v-for="(step, idx) in permissionStepsByOS.steps" :key="idx">{{ step }}</li>
        </ol>
      </template>

      <template v-else>
        <p class="agent-permission-tip">麦克风权限正常，可以开始语音输入。</p>
      </template>
    </div>
    <template #footer>
      <el-button @click="permissionDialog.visible = false">关闭</el-button>
      <el-button
        v-if="permissionDialog.status !== 'insecure' && permissionDialog.status !== 'unsupported'"
        type="primary"
        @click="tryGrantInDialog"
      >
        {{ permissionDialog.status === 'granted' ? '开始语音输入' : permissionDialog.status === 'denied' ? '我已开启，重新检测' : '立即授权' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.agent-launcher {
  position: fixed;
  right: 24px;
  bottom: 32px;
  z-index: 50;
}
.agent-drawer-title {
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.agent-drawer-title:hover {
  color: var(--el-color-primary);
}
.agent-config-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.agent-config-tip {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.agent-permission {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.agent-permission-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.agent-permission-tip {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
.agent-permission-tip.secondary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.agent-permission-os {
  margin: 0;
  font-weight: 600;
  font-size: 13px;
}
.agent-permission-steps {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.7;
}
.agent-permission-steps li {
  list-style: none;
}
.agent-permission code {
  background: var(--el-fill-color);
  padding: 1px 6px;
  border-radius: 4px;
}
.agent-fab {
  box-shadow: 0 12px 32px rgba(64, 158, 255, 0.35);
}
.agent-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 4px 16px;
}
.agent-context {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agent-context-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.agent-context-row span {
  color: var(--el-text-color-secondary);
}
.agent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.agent-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--el-bg-color-page);
}
.agent-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.agent-card header span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.agent-pre {
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
.agent-missing-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.agent-missing-list li {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.agent-missing-list li:hover {
  border-color: var(--el-color-primary);
}
.agent-missing-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}
.agent-missing-list p {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.agent-judge-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
}
.agent-judge-list li {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.agent-judge-list span {
  color: var(--el-text-color-secondary);
}
.agent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.agent-reasoning {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.agent-chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
}
.agent-chat header {
  font-weight: 600;
}
.agent-chat-list {
  height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}
.agent-chat-empty {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.agent-chat-bubble {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 13px;
}
.agent-chat-bubble.user {
  background: var(--el-color-primary-light-9);
  align-self: flex-end;
}
.agent-chat-bubble p {
  margin: 4px 0 0;
  white-space: pre-wrap;
  line-height: 1.6;
}
.agent-chat-role {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.agent-chat-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agent-chat-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
