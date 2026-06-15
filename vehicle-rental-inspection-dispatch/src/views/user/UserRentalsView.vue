<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import ReportFilePreview from '@/components/ReportFilePreview.vue';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { getErrorMessage } from '@/utils/errors';
import { filterRentalVehicles, type RentalFilters, type RentalMileageRange, type RentalPriceRange } from '@/utils/rentalFilters';
import { createTemporaryReportLink, latestReportForVehicle } from '@/utils/temporaryReportLink';
import type { Vehicle, VehicleAttachment } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const router = useRouter();
const previewFile = ref<VehicleAttachment | null>(null);
const filters = ref<RentalFilters>({
  keyword: '',
  energyType: '',
  grade: '',
  mileageRange: '',
  priceRange: ''
});
const available = computed(() =>
  fleet.data.vehicles.filter((item) => (item.status === '可租赁' || item.status === '预备库') && item.ownerId !== auth.currentUser?.id)
);
const filteredAvailable = computed(() => filterRentalVehicles(available.value, filters.value));
const canCreateRental = computed(() => can(auth.currentUser, 'rental:create'));
const activeFilterCount = computed(() =>
  Number(!!filters.value.keyword.trim()) +
  Number(!!filters.value.energyType) +
  Number(!!filters.value.grade) +
  Number(!!filters.value.mileageRange) +
  Number(!!filters.value.priceRange)
);

const energyOptions: Array<{ label: string; value: RentalFilters['energyType'] }> = [
  { label: '全部', value: '' },
  { label: '纯电', value: '纯电' },
  { label: '混动', value: '混动' },
  { label: '燃油', value: '燃油' }
];

const mileageOptions: Array<{ label: string; value: RentalMileageRange }> = [
  { label: '不限里程', value: '' },
  { label: '1 万 km 内', value: '0-10000' },
  { label: '1-3 万 km', value: '10000-30000' },
  { label: '3-6 万 km', value: '30000-60000' },
  { label: '6 万 km 以上', value: '60000-' }
];

const priceOptions: Array<{ label: string; value: RentalPriceRange }> = [
  { label: '不限价格', value: '' },
  { label: '200 元内', value: '0-200' },
  { label: '200-300 元', value: '200-300' },
  { label: '300-500 元', value: '300-500' },
  { label: '500 元以上', value: '500-' }
];

function resetFilters() {
  filters.value = {
    keyword: '',
    energyType: '',
    grade: '',
    mileageRange: '',
    priceRange: ''
  };
}

function latestReportId(vehicleId: string) {
  const vehicle = fleet.data.vehicles.find((item) => item.id === vehicleId);
  return latestReportForVehicle(vehicle, fleet.data)?.id;
}

function openReport(vehicleId: string) {
  const vehicle = fleet.data.vehicles.find((item) => item.id === vehicleId);
  const uploaded = vehicle?.reportFiles?.[0];
  if (uploaded) {
    previewFile.value = uploaded;
    return;
  }
  const link = createTemporaryReportLink(vehicle, fleet.data, auth.currentUser?.id);
  if (!link) {
    ElMessage.warning('该车辆暂无可查看的检测报告');
    return;
  }
  router.push(link.href);
}

function hasReport(vehicle: Vehicle) {
  return !!vehicle.reportFiles?.length || !!latestReportId(vehicle.id);
}

function rent(vehicleId: string) {
  if (auth.currentUser?.role !== 'customer') {
    ElMessage.warning('请使用租车客户账号提交租赁订单');
    return;
  }
  auth.syncSession();
  try {
    fleet.createRentalOrder(vehicleId, auth.currentUser?.id || 'u-user', auth.currentUser?.name || '用户');
    ElMessage.success('租赁订单已提交');
    router.push('/user/orders');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}
</script>

<template>
  <PageHeader title="车辆租赁" subtitle="查看可租车辆并提交租赁订单" />

  <section class="rental-filter-panel">
    <div class="rental-filter-main">
      <el-input v-model="filters.keyword" class="rental-search" clearable placeholder="搜索车辆名称 / 车牌号">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button class="rental-reset-button" :disabled="activeFilterCount === 0" @click="resetFilters">
        <el-icon><RefreshLeft /></el-icon>
      </el-button>
    </div>

    <div class="rental-energy-chips" aria-label="车辆类型筛选">
      <button
        v-for="option in energyOptions"
        :key="option.label"
        class="rental-energy-chip"
        :class="{ active: filters.energyType === option.value }"
        type="button"
        @click="filters.energyType = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="rental-filter-fields">
      <el-select v-model="filters.grade" clearable placeholder="级别">
        <el-option label="S 级" value="S" />
        <el-option label="A 级" value="A" />
        <el-option label="B 级" value="B" />
        <el-option label="C 级" value="C" />
        <el-option label="D 级" value="D" />
      </el-select>
      <el-select v-model="filters.mileageRange" placeholder="里程">
        <el-option v-for="option in mileageOptions" :key="option.value || 'all-mileage'" :label="option.label" :value="option.value" />
      </el-select>
      <el-select v-model="filters.priceRange" placeholder="日租价格">
        <el-option v-for="option in priceOptions" :key="option.value || 'all-price'" :label="option.label" :value="option.value" />
      </el-select>
    </div>

    <div class="rental-result-meta">
      <span>已筛选 {{ filteredAvailable.length }} 辆车</span>
      <button v-if="activeFilterCount > 0" type="button" @click="resetFilters">重置条件</button>
    </div>
  </section>

  <section class="grid-3">
    <article v-for="vehicle in filteredAvailable" :key="vehicle.id" class="vehicle-card">
      <div v-if="vehicle.images?.[0]" class="rental-cover">
        <img :src="vehicle.images[0].url" :alt="vehicle.images[0].name" />
      </div>
      <div class="vehicle-card-head">
        <h3>{{ vehicle.plateNo }} {{ vehicle.brandModel }}</h3>
        <div class="vehicle-card-badges">
          <GradeTag :grade="vehicle.grade" />
          <StatusTag :status="vehicle.status" />
        </div>
      </div>
      <div class="vehicle-meta">
        <span>能源：{{ vehicle.energyType }} | 颜色：{{ vehicle.color }}</span>
        <span>里程：{{ vehicle.mileage }} km</span>
        <span>{{ vehicle.city || '重庆' }} | {{ vehicle.pickupLocation || vehicle.warehouse || '车主约定取车点' }}</span>
        <span>日租：{{ vehicle.dailyPrice || 268 }} 元 | 押金：{{ vehicle.deposit || 3000 }} 元</span>
        <span v-if="vehicle.description">{{ vehicle.description }}</span>
      </div>
      <div class="vehicle-report-row">
        <el-button v-if="hasReport(vehicle)" text type="primary" @click="openReport(vehicle.id)">
          <el-icon><Document /></el-icon>
          预览检测报告
        </el-button>
        <span v-else class="vehicle-report-muted">车主未上传检测报告</span>
      </div>
      <el-space class="vehicle-actions">
        <el-button v-if="canCreateRental" type="primary" @click="rent(vehicle.id)">立即租车</el-button>
      </el-space>
    </article>
    <el-empty v-if="filteredAvailable.length === 0" description="暂无符合条件的车辆" />
  </section>

  <el-dialog :model-value="!!previewFile" title="检测报告预览" width="760px" @close="previewFile = null">
    <ReportFilePreview v-if="previewFile" :file="previewFile" />
  </el-dialog>
</template>

<style scoped>
.rental-filter-panel {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid rgba(222, 212, 197, 0.9);
  border-radius: 12px;
  background: rgba(255, 250, 242, 0.78);
  box-shadow: 0 10px 28px rgba(6, 21, 35, 0.04);
}

.rental-filter-main {
  display: flex;
  gap: 10px;
}

.rental-search {
  flex: 1;
  min-width: 0;
}

.rental-reset-button {
  width: 42px;
  padding: 0;
}

.rental-energy-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.rental-energy-chips::-webkit-scrollbar {
  display: none;
}

.rental-energy-chip {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid #e0d5c6;
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.88);
  color: #526074;
  font-weight: 900;
  cursor: pointer;
}

.rental-energy-chip.active {
  color: #063c34;
  border-color: #70e7d2;
  background: #ddfbf4;
}

.rental-filter-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.rental-result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.rental-result-meta button {
  border: 0;
  background: transparent;
  color: #0b766d;
  font-weight: 900;
  cursor: pointer;
}

.rental-cover {
  margin-bottom: 14px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f5efe5;
}

.rental-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vehicle-report-row {
  display: flex;
  align-items: center;
  min-height: 34px;
  margin-bottom: 12px;
}

.vehicle-report-row .el-button {
  padding-left: 0;
  font-weight: 800;
}

.vehicle-report-muted {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.vehicle-actions {
  width: 100%;
}

@media (max-width: 820px) {
  .rental-filter-panel {
    margin-top: -2px;
    margin-bottom: 14px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(255, 251, 244, 0.82);
  }

  .rental-filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rental-filter-fields .el-select:last-child {
    grid-column: 1 / -1;
  }
}

</style>
