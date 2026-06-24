<template>
  <el-dialog
    v-model="visible"
    title="添加检测图片"
    width="600px"
    :close-on-click-modal="false"
    @close="onClose"
  >
    <!-- 上传区域 -->
    <div
      class="upload-zone"
      :class="{ 'is-dragover': dragover }"
      @click="triggerFileInput"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
    >
      <el-icon :size="40" color="#909399"><UploadFilled /></el-icon>
      <p class="upload-hint">点击或拖拽图片到此处</p>
      <p class="upload-subhint">支持 JPG / PNG / WebP，单张 ≤ 10MB，最多 {{ maxImages }} 张</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style="display: none"
        @change="onFileChange"
      />
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="uploadError"
      :title="uploadError"
      type="error"
      show-icon
      closable
      style="margin-top: 12px"
    />

    <!-- 待添加图片预览 -->
    <div v-if="pendingImages.length" class="pending-images">
      <p class="section-label">待添加（{{ pendingImages.length }} 张）</p>
      <div class="pending-grid">
        <div v-for="(img, idx) in pendingImages" :key="idx" class="pending-thumb">
          <img :src="img.dataUrl" :alt="img.name" />
          <span class="thumb-name">{{ img.name }}</span>
          <span class="thumb-remove" @click="removePending(idx)">×</span>
        </div>
      </div>
    </div>

    <!-- 已有图片 -->
    <div v-if="existingImages.length" class="existing-images">
      <p class="section-label">已有图片（{{ existingImages.length }}/{{ maxImages }}）</p>
      <div class="existing-grid">
        <div
          v-for="img in existingImages"
          :key="img.id"
          class="existing-thumb"
          @click="openPreview(img.id)"
        >
          <img :src="img.dataUrl" :alt="img.name" />
          <span class="thumb-annotate" @click.stop="openAnnotate(img)">
            <el-icon><Edit /></el-icon> 标注
          </span>
          <span class="thumb-remove" @click.stop="removeExisting(img.id)">×</span>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="!pendingImages.length"
        @click="confirmAdd"
      >
        添加 {{ pendingImages.length }} 张图片
      </el-button>
    </template>
  </el-dialog>

  <!-- 图片预览 -->
  <ImagePreview
    v-if="previewVisible"
    :images="existingImages"
    :initial-index="previewIndex"
    @close="previewVisible = false"
    @delete="onPreviewDelete"
  />

  <!-- 图片标注 -->
  <el-dialog
    v-model="annotateVisible"
    title="图片标注"
    width="800px"
    :close-on-click-modal="false"
    append-to-body
  >
    <ImageAnnotator
      v-if="annotateImage"
      :image="annotateImage"
      @save="onAnnotateSave"
      @cancel="annotateVisible = false"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { UploadFilled, Edit } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { InspectionImage } from '@/types/domain';
import { compressAndWatermark, validateImageFile, generateWatermarkText } from '@/utils/imageCompress';
import { uploadImage, deleteImage } from '@/services/imageStorage';
import ImagePreview from './ImagePreview.vue';
import ImageAnnotator from './ImageAnnotator.vue';

const props = defineProps<{
  modelValue: boolean;
  existingImages: InspectionImage[];
  maxImages?: number;
  plateNo?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [v: boolean];
  add: [images: InspectionImage[]];
  remove: [imageId: string];
  replace: [imageId: string, newDataUrl: string];
}>();

const maxImages = computed(() => props.maxImages ?? 3);
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const fileInput = ref<HTMLInputElement>();
const dragover = ref(false);
const uploadError = ref('');
const pendingImages = ref<{ name: string; dataUrl: string; size: number }[]>([]);

// 预览
const previewVisible = ref(false);
const previewIndex = ref(0);

// 标注
const annotateVisible = ref(false);
const annotateImage = ref<InspectionImage | null>(null);

function triggerFileInput() {
  fileInput.value?.click();
}

async function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  await processFiles(Array.from(files));
  (e.target as HTMLInputElement).value = '';
}

function onDrop(e: DragEvent) {
  dragover.value = false;
  const files = e.dataTransfer?.files;
  if (!files) return;
  processFiles(Array.from(files));
}

async function processFiles(files: File[]) {
  uploadError.value = '';
  const watermarkText = generateWatermarkText(props.plateNo);

  for (const file of files) {
    // 校验
    const validation = validateImageFile(file);
    if (!validation.valid) {
      uploadError.value = `${file.name}：${validation.error}`;
      continue;
    }

    // 检查数量
    const totalAfterAdd = props.existingImages.length + pendingImages.value.length + 1;
    if (totalAfterAdd > maxImages.value) {
      uploadError.value = `最多添加 ${maxImages.value} 张图片`;
      break;
    }

    try {
      const dataUrl = await compressAndWatermark(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85,
        watermark: {
          text: watermarkText,
          fontSize: 16,
          position: 'bottom-right',
        },
      });

      pendingImages.value.push({
        name: file.name,
        dataUrl,
        size: file.size,
      });
    } catch {
      uploadError.value = `${file.name}：处理失败`;
    }
  }
}

function removePending(idx: number) {
  pendingImages.value.splice(idx, 1);
}

const uploading = ref(false);

async function confirmAdd() {
  if (uploading.value) return;
  uploading.value = true;
  try {
    const images: InspectionImage[] = [];
    for (const p of pendingImages.value) {
      const img = await uploadImage(p.dataUrl, p.name, p.size);
      images.push(img);
    }
    emit('add', images);
    pendingImages.value = [];
    visible.value = false;
    ElMessage.success(`已添加 ${images.length} 张图片`);
  } catch (err) {
    ElMessage.error(`上传失败：${(err as Error).message}`);
  } finally {
    uploading.value = false;
  }
}

async function removeExisting(imageId: string) {
  try {
    await deleteImage(imageId);
  } catch {
    // S3 删除失败不阻断 UI
  }
  emit('remove', imageId);
}

function openPreview(imageId: string) {
  const idx = props.existingImages.findIndex((img) => img.id === imageId);
  previewIndex.value = idx >= 0 ? idx : 0;
  previewVisible.value = true;
}

function onPreviewDelete(imageId: string) {
  emit('remove', imageId);
  // 如果删除的是当前预览的，关闭预览
  const remaining = props.existingImages.filter((img) => img.id !== imageId);
  if (remaining.length === 0) {
    previewVisible.value = false;
  }
}

function openAnnotate(image: InspectionImage) {
  annotateImage.value = { ...image };
  annotateVisible.value = true;
}

function onAnnotateSave(dataUrl: string) {
  if (annotateImage.value) {
    emit('replace', annotateImage.value.id, dataUrl);
    ElMessage.success('标注已保存');
  }
  annotateVisible.value = false;
}

function onClose() {
  pendingImages.value = [];
  uploadError.value = '';
}
</script>

<style scoped>
.upload-zone {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
}

.upload-zone:hover,
.upload-zone.is-dragover {
  border-color: #409eff;
  background: #ecf5ff;
}

.upload-hint {
  margin: 12px 0 4px;
  font-size: 14px;
  color: #606266;
}

.upload-subhint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.section-label {
  font-size: 13px;
  color: #606266;
  margin: 16px 0 8px;
  font-weight: 500;
}

.pending-grid,
.existing-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pending-thumb,
.existing-thumb {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
  cursor: pointer;
}

.pending-thumb img,
.existing-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb-remove {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(245, 108, 108, 0.9);
  color: white;
  font-size: 14px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 0 6px 0 6px;
  line-height: 1;
}

.thumb-remove:hover {
  background: #f56c6c;
}

.thumb-annotate {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 11px;
  color: white;
  background: rgba(64, 158, 255, 0.85);
  padding: 3px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
}

.thumb-annotate:hover {
  background: rgba(64, 158, 255, 1);
}
</style>
