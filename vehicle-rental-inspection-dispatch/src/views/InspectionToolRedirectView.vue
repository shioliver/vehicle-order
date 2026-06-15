<script setup lang="ts">
import { onMounted } from 'vue';

const inspectionToolUrl = import.meta.env.VITE_INSPECTION_TOOL_URL || 'http://127.0.0.1:5178/';

function openTool() {
  window.location.href = inspectionToolUrl;
}

onMounted(() => {
  window.setTimeout(openTool, 300);
});
</script>

<template>
  <main class="tool-redirect">
    <section>
      <span>独立检测工具</span>
      <h1>检测报告工具已拆分为单独项目</h1>
      <p>如果没有自动跳转，请点击按钮进入独立工具。</p>
      <el-button type="primary" size="large" @click="openTool">打开检测工具</el-button>
    </section>
  </main>
</template>

<style scoped>
.tool-redirect {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: linear-gradient(180deg, #f6f2ea 0%, #e6fbf8 100%);
}

.tool-redirect section {
  width: min(560px, 100%);
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  text-align: center;
  box-shadow: 0 18px 44px rgba(15, 23, 42, .1);
}

.tool-redirect span {
  color: var(--primary);
  font-weight: 900;
}

.tool-redirect h1 {
  margin: 10px 0;
  font-size: 26px;
}

.tool-redirect p {
  color: var(--muted);
  font-weight: 700;
}
</style>
