<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import { useAuthStore } from '@/stores/auth';
import { useFleetStore } from '@/stores/fleet';
import type { Vehicle, VehicleAttachment } from '@/types/domain';
import { fileToVehicleAttachment } from '@/utils/fileAttachments';
import { getErrorMessage } from '@/utils/errors';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const fleet = useFleetStore();

const editingId = computed(() => String(route.query.id || ''));
const editingVehicle = computed(() => fleet.data.vehicles.find((item) => item.id === editingId.value));
const isEditing = computed(() => !!editingVehicle.value);
const uploading = ref(false);

const form = reactive({
  plateNo: '',
  vin: '',
  brandModel: '',
  energyType: '燃油' as Vehicle['energyType'],
  color: '',
  produceDate: '',
  registerDate: '',
  mileage: 0,
  dailyPrice: 268,
  deposit: 3000,
  city: '重庆',
  pickupLocation: '',
  minRentalDays: 1,
  description: '',
  status: '可租赁' as Vehicle['status'],
  images: [] as VehicleAttachment[],
  reportFiles: [] as VehicleAttachment[]
});

watchEffect(() => {
  const vehicle = editingVehicle.value;
  if (!editingId.value) return;
  if (!vehicle) return;
  if (vehicle.ownerId !== auth.currentUser?.id) {
    ElMessage.warning('只能编辑自己发布的车辆');
    router.replace('/user/my-vehicles');
    return;
  }
  Object.assign(form, {
    plateNo: vehicle.plateNo,
    vin: vehicle.vin,
    brandModel: vehicle.brandModel,
    energyType: vehicle.energyType,
    color: vehicle.color,
    produceDate: vehicle.produceDate,
    registerDate: vehicle.registerDate,
    mileage: vehicle.mileage,
    dailyPrice: vehicle.dailyPrice ?? 268,
    deposit: vehicle.deposit ?? 3000,
    city: vehicle.city ?? '重庆',
    pickupLocation: vehicle.pickupLocation ?? vehicle.warehouse ?? '',
    minRentalDays: vehicle.minRentalDays ?? 1,
    description: vehicle.description ?? '',
    status: vehicle.status === '停用' ? '停用' : '可租赁',
    images: [...(vehicle.images ?? [])],
    reportFiles: [...(vehicle.reportFiles ?? [])]
  });
});

async function handleFiles(event: Event, target: 'images' | 'reportFiles') {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) return;
  uploading.value = true;
  try {
    const attachments = await Promise.all(files.map(fileToVehicleAttachment));
    form[target].push(...attachments);
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

function removeAttachment(target: 'images' | 'reportFiles', id: string) {
  form[target] = form[target].filter((item) => item.id !== id);
}

function submit(status: Vehicle['status'] = form.status) {
  try {
    const existing = editingVehicle.value;
    fleet.upsertVehicle({
      id: existing?.id,
      ownerId: auth.currentUser?.id,
      plateNo: form.plateNo.trim(),
      vin: form.vin.trim(),
      brandModel: form.brandModel.trim(),
      energyType: form.energyType,
      color: form.color.trim(),
      produceDate: form.produceDate,
      registerDate: form.registerDate,
      mileage: Number(form.mileage) || 0,
      status,
      grade: existing?.grade,
      warehouse: existing?.warehouse,
      parkingSpace: existing?.parkingSpace,
      dailyPrice: Number(form.dailyPrice) || 0,
      deposit: Number(form.deposit) || 0,
      city: form.city.trim(),
      pickupLocation: form.pickupLocation.trim(),
      description: form.description.trim(),
      minRentalDays: Number(form.minRentalDays) || 1,
      images: form.images,
      reportFiles: form.reportFiles,
      driverId: existing?.driverId,
      lastInspectionId: existing?.lastInspectionId
    });
    ElMessage.success(status === '停用' ? '车辆已保存为下架状态' : '车辆已发布');
    router.push('/user/my-vehicles');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}
</script>

<template>
  <PageHeader :title="isEditing ? '编辑车辆' : '发布车辆'" subtitle="填写车辆基本信息、租金押金和可选检测报告附件" />

  <section class="panel publish-shell">
    <div class="publish-head">
      <div>
        <h2>{{ isEditing ? '车辆信息' : '新车源上架' }}</h2>
        <p>检测报告不是必填项，可在外部检测工具导出后上传到这里。</p>
      </div>
      <StatusTag :status="form.status" />
    </div>

    <el-form label-position="top" class="publish-form">
      <div class="form-grid-3">
        <el-form-item label="车牌号码"><el-input v-model="form.plateNo" placeholder="如：渝A12345" /></el-form-item>
        <el-form-item label="VIN码"><el-input v-model="form.vin" placeholder="车辆识别代码" /></el-form-item>
        <el-form-item label="品牌车型"><el-input v-model="form.brandModel" placeholder="如：传祺M8 大师版" /></el-form-item>
        <el-form-item label="能源类型">
          <el-select v-model="form.energyType"><el-option label="燃油" value="燃油" /><el-option label="纯电" value="纯电" /><el-option label="混动" value="混动" /></el-select>
        </el-form-item>
        <el-form-item label="颜色"><el-input v-model="form.color" placeholder="车辆颜色" /></el-form-item>
        <el-form-item label="表显里程"><el-input-number v-model="form.mileage" :min="0" :step="100" controls-position="right" /></el-form-item>
        <el-form-item label="生产日期"><el-date-picker v-model="form.produceDate" value-format="YYYY-MM-DD" type="date" /></el-form-item>
        <el-form-item label="首次上牌"><el-date-picker v-model="form.registerDate" value-format="YYYY-MM-DD" type="date" /></el-form-item>
        <el-form-item label="城市"><el-input v-model="form.city" placeholder="重庆" /></el-form-item>
        <el-form-item label="日租金"><el-input-number v-model="form.dailyPrice" :min="0" controls-position="right" /></el-form-item>
        <el-form-item label="押金"><el-input-number v-model="form.deposit" :min="0" controls-position="right" /></el-form-item>
        <el-form-item label="最短租期"><el-input-number v-model="form.minRentalDays" :min="1" controls-position="right" /></el-form-item>
      </div>
      <el-form-item label="取车地点"><el-input v-model="form.pickupLocation" placeholder="填写线下取车地点" /></el-form-item>
      <el-form-item label="车况说明"><el-input v-model="form.description" type="textarea" :rows="4" placeholder="可填写保养、事故、使用场景等说明" /></el-form-item>
    </el-form>

    <div class="attachment-grid">
      <section class="attachment-card">
        <div class="attachment-title">
          <strong>车辆照片</strong>
          <label class="upload-button">
            上传照片
            <input type="file" accept="image/*" multiple @change="handleFiles($event, 'images')" />
          </label>
        </div>
        <div class="attachment-preview images">
          <figure v-for="file in form.images" :key="file.id">
            <img :src="file.url" :alt="file.name" />
            <button type="button" @click="removeAttachment('images', file.id)">删除</button>
          </figure>
          <el-empty v-if="form.images.length === 0" description="可不上传照片" />
        </div>
      </section>

      <section class="attachment-card">
        <div class="attachment-title">
          <strong>检测报告附件</strong>
          <div class="attachment-actions">
            <label class="upload-button">
              上传报告
              <input type="file" accept=".pdf,.doc,.docx,image/*,.html" multiple @change="handleFiles($event, 'reportFiles')" />
            </label>
          </div>
        </div>
        <div class="attachment-list">
          <article v-for="file in form.reportFiles" :key="file.id">
            <span>{{ file.name }}</span>
            <button type="button" @click="removeAttachment('reportFiles', file.id)">删除</button>
          </article>
          <el-empty v-if="form.reportFiles.length === 0" description="可不上传检测报告" />
        </div>
      </section>
    </div>

    <div class="publish-actions">
      <el-button :loading="uploading" @click="submit('停用')">保存为下架</el-button>
      <el-button type="primary" :loading="uploading" @click="submit('可租赁')">保存并上架</el-button>
    </div>
  </section>
</template>

<style scoped>
.publish-shell { display: flex; flex-direction: column; gap: 20px; }
.publish-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.publish-head h2 { margin: 0 0 6px; font-size: 22px; }
.publish-head p { margin: 0; color: var(--muted); font-weight: 700; }
.publish-form :deep(.el-input-number) { width: 100%; }
.attachment-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.attachment-card { min-width: 0; border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--surface); }
.attachment-title { display: grid; grid-template-columns: minmax(120px, 1fr) auto; align-items: center; gap: 12px; margin-bottom: 12px; }
.attachment-title strong { line-height: 1.25; }
.attachment-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.upload-button { position: relative; display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 8px; color: #06262a; background: var(--accent-soft); font-weight: 900; cursor: pointer; }
.upload-button input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.attachment-preview.images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.attachment-preview.images :deep(.el-empty),
.attachment-list :deep(.el-empty) {
  grid-column: 1 / -1;
  width: 100%;
  padding: 28px 0;
}

.attachment-preview.images :deep(.el-empty__image),
.attachment-list :deep(.el-empty__image) {
  width: 118px;
  height: 88px;
  margin: 0 auto 10px;
}

.attachment-preview.images :deep(.el-empty__description),
.attachment-list :deep(.el-empty__description) {
  margin-top: 0;
}

.attachment-preview.images :deep(.el-empty__description p),
.attachment-list :deep(.el-empty__description p) {
  color: #8a94a6;
  font-size: 14px;
  font-weight: 800;
}
.attachment-preview figure { position: relative; margin: 0; aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); background: var(--surface); }
.attachment-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.attachment-preview button, .attachment-list button { border: 0; border-radius: 6px; padding: 6px 10px; color: #f56c6c; background: #fff1f1; font-weight: 900; cursor: pointer; }
.attachment-preview figure button { position: absolute; right: 6px; bottom: 6px; }
.attachment-list { display: flex; flex-direction: column; gap: 10px; }
.attachment-list article { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); }
.attachment-list span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 800; }
.publish-actions { display: flex; justify-content: flex-end; gap: 12px; }

@media (max-width: 820px) {
  .publish-shell { gap: 14px; }
  .publish-head { align-items: center; }
  .publish-head h2 { font-size: 18px; }
  .publish-head p { display: none; }
  .attachment-grid { grid-template-columns: 1fr; }
  .attachment-card { padding: 14px; overflow: hidden; }
  .attachment-title { grid-template-columns: 1fr; align-items: stretch; gap: 10px; margin-bottom: 10px; }
  .attachment-title strong { font-size: 16px; }
  .attachment-actions { display: grid; grid-template-columns: 1fr; width: 100%; justify-content: stretch; }
  .upload-button { justify-content: center; min-width: 0; padding: 0 8px; white-space: nowrap; }
  .attachment-preview.images { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .attachment-preview.images :deep(.el-empty),
  .attachment-list :deep(.el-empty) { min-height: 170px; display: grid; place-items: center; align-content: center; padding: 16px 0; }
  .attachment-preview.images :deep(.el-empty__image),
  .attachment-list :deep(.el-empty__image) { width: 96px; height: 72px; }
  .attachment-list article { padding: 10px 12px; }
  .attachment-list span { font-size: 14px; }
  .publish-actions { position: sticky; bottom: 78px; z-index: 3; background: rgba(255,250,242,.94); padding: 10px; border: 1px solid var(--line); border-radius: 10px; }
  .publish-actions .el-button { flex: 1; }
}
</style>
