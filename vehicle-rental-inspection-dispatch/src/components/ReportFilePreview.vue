<script setup lang="ts">
import { computed } from 'vue';
import type { VehicleAttachment } from '@/types/domain';
import { attachmentPreview } from '@/utils/attachmentPreview';

const props = defineProps<{
  file: VehicleAttachment;
}>();

const preview = computed(() => attachmentPreview(props.file));

const mobileHtml = computed(() => {
  if (preview.value.mode !== 'html') return '';
  const mobileStyle = `<style>
    @media (max-width: 820px) {
      html, body { width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; }
      body { margin: 0 !important; padding: 16px !important; box-sizing: border-box !important; font-size: 14px !important; line-height: 1.55 !important; }
      * { box-sizing: border-box !important; max-width: 100% !important; }
      .report-header { padding-bottom: 14px !important; margin-bottom: 16px !important; }
      .logo-text { font-size: 15px !important; }
      .report-title { font-size: 23px !important; line-height: 1.18 !important; }
      .meta { font-size: 12px !important; line-height: 1.6 !important; }
      h3 { font-size: 17px !important; margin: 18px 0 10px !important; }
      .info-grid { display: grid !important; grid-template-columns: 1fr !important; border-right: 1px solid #dbe3ef !important; }
      .info-cell { padding: 10px 12px !important; border-right: 0 !important; word-break: break-word !important; }
      .label { font-size: 12px !important; }
      .value { display: block !important; font-size: 16px !important; line-height: 1.45 !important; word-break: break-word !important; }
      table, thead, tbody, tr, th, td { display: block !important; width: 100% !important; }
      table { border: 0 !important; margin-bottom: 12px !important; }
      thead { display: none !important; }
      tr { border: 1px solid #ded4c5 !important; border-radius: 10px !important; margin-bottom: 8px !important; overflow: hidden !important; background: #fffaf2 !important; }
      td { border-width: 0 0 1px !important; padding: 8px 10px !important; min-height: 34px !important; word-break: break-word !important; }
      td:last-child { border-bottom: 0 !important; }
      td:nth-child(1)::before { content: "检测项目"; }
      td:nth-child(2)::before { content: "检测结果"; }
      td:nth-child(3)::before { content: "备注"; }
      td::before { display: block !important; margin-bottom: 2px !important; color: #64748b !important; font-size: 12px !important; font-weight: 700 !important; }
      .conclusion { padding: 12px !important; margin-top: 14px !important; }
      .verdict { grid-template-columns: 1fr !important; gap: 8px !important; }
      .footer { margin-top: 18px !important; }
    }
  </style>`;

  if (preview.value.html.includes('</head>')) {
    return preview.value.html.replace('</head>', `${mobileStyle}</head>`);
  }
  return `${mobileStyle}${preview.value.html}`;
});
</script>

<template>
  <div class="report-file-preview">
    <img v-if="preview.mode === 'image'" :src="preview.src" :alt="file.name" />
    <iframe v-else-if="preview.mode === 'pdf'" :src="preview.src" :title="file.name" />
    <iframe v-else-if="preview.mode === 'html'" :srcdoc="mobileHtml" :title="file.name" sandbox="" />
    <div v-else class="file-preview-empty">
      <strong>{{ file.name }}</strong>
      <span>{{ preview.reason }}</span>
    </div>
  </div>
</template>

<style scoped>
.report-file-preview iframe {
  width: 100%;
  height: 68vh;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.report-file-preview img {
  display: block;
  max-width: 100%;
  margin: 0 auto;
  border-radius: 8px;
}

.file-preview-empty {
  display: grid;
  gap: 8px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.file-preview-empty strong {
  color: var(--text);
  line-height: 1.35;
  word-break: break-all;
}

.file-preview-empty span {
  color: var(--muted);
  font-weight: 700;
  line-height: 1.65;
}

@media (max-width: 820px) {
  .report-file-preview {
    overflow-x: hidden;
  }

  .report-file-preview iframe {
    display: block;
    width: 100%;
    max-width: 100%;
    height: 68vh;
    overflow-x: hidden;
  }
}
</style>
