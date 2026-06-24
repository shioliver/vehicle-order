<template>
  <div class="image-annotator">
    <div class="annotator-toolbar">
      <el-button-group>
        <el-button
          :type="mode === 'draw' ? 'primary' : ''"
          size="small"
          @click="mode = 'draw'"
        >
          <el-icon><Edit /></el-icon> 画笔
        </el-button>
        <el-button
          :type="mode === 'rect' ? 'primary' : ''"
          size="small"
          @click="mode = 'rect'"
        >
          <el-icon><Box /></el-icon> 矩形
        </el-button>
        <el-button
          :type="mode === 'circle' ? 'primary' : ''"
          size="small"
          @click="mode = 'circle'"
        >
          <el-icon><Odometer /></el-icon> 圆圈
        </el-button>
        <el-button
          :type="mode === 'arrow' ? 'primary' : ''"
          size="small"
          @click="mode = 'arrow'"
        >
          <el-icon><Top /></el-icon> 箭头
        </el-button>
        <el-button
          :type="mode === 'text' ? 'primary' : ''"
          size="small"
          @click="mode = 'text'"
        >
          <el-icon><EditPen /></el-icon> 文字
        </el-button>
      </el-button-group>

      <div class="color-picker">
        <el-color-picker v-model="color" size="small" />
      </div>

      <div class="line-width">
        <span>粗细</span>
        <el-slider
          v-model="lineWidth"
          :min="1"
          :max="20"
          :step="1"
          style="width: 120px"
        />
      </div>

      <el-button size="small" @click="undo">
        <el-icon><RefreshLeft /></el-icon> 撤销
      </el-button>
      <el-button size="small" @click="clearAll">
        <el-icon><Delete /></el-icon> 清空
      </el-button>
    </div>

    <div
      ref="canvasContainer"
      class="annotator-canvas"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <canvas ref="canvas" />
      <div v-if="mode === 'text' && textInputVisible" class="text-input-overlay" :style="textInputStyle">
        <el-input
          ref="textInputRef"
          v-model="textInput"
          size="small"
          placeholder="输入标注文字"
          @keyup.enter="confirmText"
          @keyup.escape="textInputVisible = false"
        />
        <el-button size="small" type="primary" @click="confirmText">确定</el-button>
      </div>
    </div>

    <div class="annotator-footer">
      <el-button @click="$emit('cancel')">取消</el-button>
      <el-button type="primary" @click="save">保存标注</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { Edit, Box, Odometer, Top, EditPen, RefreshLeft, Delete } from '@element-plus/icons-vue';
import type { InspectionImage } from '@/types/domain';

const props = defineProps<{
  image: InspectionImage;
}>();

const emit = defineEmits<{
  save: [dataUrl: string];
  cancel: [];
}>();

const canvas = ref<HTMLCanvasElement>();
const canvasContainer = ref<HTMLDivElement>();
const mode = ref<'draw' | 'rect' | 'circle' | 'arrow' | 'text'>('draw');
const color = ref('#FF0000');
const lineWidth = ref(3);

// 绘图状态
const isDrawing = ref(false);
const startX = ref(0);
const startY = ref(0);
const history = ref<ImageData[]>([]);
const currentSnapshot = ref<ImageData | null>(null);

// 文字输入
const textInputVisible = ref(false);
const textInput = ref('');
const textInputRef = ref();
const textInputStyle = ref({ left: '0px', top: '0px' });

let ctx: CanvasRenderingContext2D | null = null;
let imgElement: HTMLImageElement | null = null;

onMounted(() => {
  nextTick(() => {
    initCanvas();
  });
});

function initCanvas() {
  const c = canvas.value;
  const container = canvasContainer.value;
  if (!c || !container) return;

  imgElement = new Image();
  imgElement.onload = () => {
    // 适配容器宽度
    const containerWidth = container.clientWidth;
    const scale = containerWidth / imgElement!.width;
    const displayWidth = containerWidth;
    const displayHeight = imgElement!.height * scale;

    c.width = displayWidth;
    c.height = displayHeight;
    c.style.width = displayWidth + 'px';
    c.style.height = displayHeight + 'px';

    ctx = c.getContext('2d')!;
    ctx.drawImage(imgElement!, 0, 0, displayWidth, displayHeight);
    saveHistory();
  };
  imgElement.src = props.image.dataUrl;
}

function getCanvasPos(e: MouseEvent) {
  const c = canvas.value!;
  const rect = c.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function onMouseDown(e: MouseEvent) {
  if (mode.value === 'text') {
    const pos = getCanvasPos(e);
    textInputStyle.value = { left: pos.x + 'px', top: pos.y + 'px' };
    textInputVisible.value = true;
    textInput.value = '';
    nextTick(() => textInputRef.value?.focus());
    return;
  }

  isDrawing.value = true;
  const pos = getCanvasPos(e);
  startX.value = pos.x;
  startY.value = pos.y;
  currentSnapshot.value = ctx!.getImageData(0, 0, canvas.value!.width, canvas.value!.height);
}

function onMouseMove(e: MouseEvent) {
  if (!isDrawing.value || !ctx) return;
  const pos = getCanvasPos(e);

  // 恢复快照
  if (currentSnapshot.value) {
    ctx.putImageData(currentSnapshot.value, 0, 0);
  }

  ctx.strokeStyle = color.value;
  ctx.fillStyle = color.value;
  ctx.lineWidth = lineWidth.value;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (mode.value) {
    case 'draw':
      ctx.beginPath();
      ctx.moveTo(startX.value, startY.value);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      startX.value = pos.x;
      startY.value = pos.y;
      break;
    case 'rect':
      ctx.strokeRect(startX.value, startY.value, pos.x - startX.value, pos.y - startY.value);
      break;
    case 'circle': {
      const rx = Math.abs(pos.x - startX.value) / 2;
      const ry = Math.abs(pos.y - startY.value) / 2;
      const cx = startX.value + (pos.x - startX.value) / 2;
      const cy = startY.value + (pos.y - startY.value) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'arrow':
      drawArrow(ctx, startX.value, startY.value, pos.x, pos.y);
      break;
  }
}

function onMouseUp() {
  if (isDrawing.value) {
    isDrawing.value = false;
    saveHistory();
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headLen = lineWidth.value * 4;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function confirmText() {
  if (!textInput.value.trim() || !ctx) {
    textInputVisible.value = false;
    return;
  }
  const fontSize = Math.max(16, lineWidth.value * 5);
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = color.value;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  const pos = textInputStyle.value;
  const x = parseInt(pos.left);
  const y = parseInt(pos.top) + fontSize;
  ctx.fillText(textInput.value, x, y);
  ctx.shadowColor = 'transparent';
  textInputVisible.value = false;
  saveHistory();
}

function saveHistory() {
  if (!ctx || !canvas.value) return;
  history.value.push(ctx.getImageData(0, 0, canvas.value.width, canvas.value.height));
  if (history.value.length > 30) history.value.shift();
}

function undo() {
  if (history.value.length <= 1 || !ctx || !canvas.value) return;
  history.value.pop();
  ctx.putImageData(history.value[history.value.length - 1], 0, 0);
}

function clearAll() {
  if (!ctx || !canvas.value || !imgElement) return;
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  ctx.drawImage(imgElement, 0, 0, canvas.value.width, canvas.value.height);
  saveHistory();
}

function save() {
  if (!canvas.value) return;
  const dataUrl = canvas.value.toDataURL('image/jpeg', 0.9);
  emit('save', dataUrl);
}
</script>

<style scoped>
.image-annotator {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotator-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.color-picker {
  display: flex;
  align-items: center;
}

.line-width {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.annotator-canvas {
  position: relative;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  cursor: crosshair;
  background: #fafafa;
  max-height: 500px;
}

.annotator-canvas canvas {
  display: block;
  max-width: 100%;
}

.text-input-overlay {
  position: absolute;
  display: flex;
  gap: 4px;
  z-index: 10;
  background: white;
  padding: 4px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.annotator-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
