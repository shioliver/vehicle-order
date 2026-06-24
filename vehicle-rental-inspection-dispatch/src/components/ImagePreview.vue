<template>
  <div class="image-preview-overlay" @click.self="close">
    <div class="image-preview-container">
      <div class="preview-header">
        <span class="preview-title">{{ images[currentIndex]?.name || '图片预览' }}</span>
        <span class="preview-counter">{{ currentIndex + 1 }} / {{ images.length }}</span>
        <el-button text @click="close" class="close-btn">
          <el-icon :size="20"><Close /></el-icon>
        </el-button>
      </div>

      <div class="preview-body" @wheel="onWheel">
        <img
          ref="previewImg"
          :src="images[currentIndex].dataUrl"
          :style="imgStyle"
          @mousedown="startDrag"
          @dragstart.prevent
        />
      </div>

      <div class="preview-footer">
        <el-button text @click="prev" :disabled="currentIndex === 0">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <el-button text @click="toggleZoom">
          <el-icon><ZoomIn v-if="scale <= 1" /><ZoomOut v-else /></el-icon>
          {{ Math.round(scale * 100) }}%
        </el-button>
        <el-button text @click="resetView">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button text @click="download">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button text @click="emit('delete', images[currentIndex].id)" type="danger">
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button text @click="next" :disabled="currentIndex === images.length - 1">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Close, ArrowLeft, ArrowRight, ZoomIn, ZoomOut,
  Refresh, Download, Delete,
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { InspectionImage } from '@/types/domain';
import { getImageUrl, deleteImage } from '@/services/imageStorage';

const props = defineProps<{
  images: InspectionImage[];
  initialIndex: number;
}>();

const emit = defineEmits<{
  close: [];
  delete: [imageId: string];
}>();

const currentIndex = ref(props.initialIndex);
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);

const imgStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  cursor: isDragging.value ? 'grabbing' : 'grab',
  transition: isDragging.value ? 'none' : 'transform 0.2s ease',
  maxWidth: 'none',
}));

function close() { emit('close'); }
function prev() { if (currentIndex.value > 0) { currentIndex.value--; resetView(); } }
function next() { if (currentIndex.value < props.images.length - 1) { currentIndex.value++; resetView(); } }

function toggleZoom() {
  scale.value = scale.value <= 1 ? 2 : scale.value >= 2 ? 0.5 : scale.value * 1.5;
}

function resetView() {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  scale.value = Math.max(0.2, Math.min(5, scale.value + delta));
}

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  dragStartX.value = e.clientX - translateX.value;
  dragStartY.value = e.clientY - translateY.value;
  const onMove = (ev: MouseEvent) => {
    translateX.value = ev.clientX - dragStartX.value;
    translateY.value = ev.clientY - dragStartY.value;
  };
  const onUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

async function download() {
  const img = props.images[currentIndex.value];
  try {
    const url = await getImageUrl(img);
    const a = document.createElement('a');
    a.href = url;
    a.download = img.name;
    a.click();
  } catch {
    ElMessage.warning('下载失败，请检查网络');
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'ArrowRight') next();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-container {
  width: 90vw;
  height: 90vh;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  color: white;
  flex-shrink: 0;
}

.preview-title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.preview-counter {
  font-size: 13px;
  color: #aaa;
}

.close-btn {
  color: white;
}

.preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

.preview-body img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  flex-shrink: 0;
}

.preview-footer :deep(.el-button) {
  color: white;
}
</style>
