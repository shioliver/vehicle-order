<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import ReportFilePreview from '@/components/ReportFilePreview.vue';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import { useAuthStore } from '@/stores/auth';
import { useFleetStore } from '@/stores/fleet';
import type { Vehicle, VehicleAttachment } from '@/types/domain';
import { getErrorMessage } from '@/utils/errors';

const router = useRouter();
const auth = useAuthStore();
const fleet = useFleetStore();
const previewFile = ref<VehicleAttachment | null>(null);
const activeTab = ref<'rented' | 'listed'>('rented');

const myVehicles = computed(() => fleet.data.vehicles.filter((vehicle) => vehicle.ownerId === auth.currentUser?.id));
const rentedOrders = computed(() =>
  fleet.data.rentalOrders
    .filter((order) => order.userId === auth.currentUser?.id)
    .filter((order) => order.status !== '已取消')
);

function vehicleInfo(vehicleId: string) {
  return fleet.data.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

function edit(vehicle: Vehicle) {
  router.push({ path: '/user/publish', query: { id: vehicle.id } });
}

function toggleStatus(vehicle: Vehicle) {
  try {
    fleet.upsertVehicle({
      ...vehicle,
      status: vehicle.status === '停用' ? '可租赁' : '停用'
    });
    ElMessage.success(vehicle.status === '停用' ? '车辆已上架' : '车辆已下架');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

function showReport(vehicle: Vehicle) {
  const file = vehicle.reportFiles?.[0];
  if (!file) {
    ElMessage.warning('该车辆暂无上传的检测报告');
    return;
  }
  previewFile.value = file;
}

function showRentedReport(vehicleId: string) {
  const vehicle = vehicleInfo(vehicleId);
  if (!vehicle) {
    ElMessage.warning('车辆信息不存在');
    return;
  }
  showReport(vehicle);
}
</script>

<template>
  <PageHeader title="我的车辆" subtitle="查看已租车辆和自己发布的车源" />

  <section class="my-vehicle-toolbar">
    <div>
      <strong>我租到 {{ rentedOrders.length }} 辆 · 我发布 {{ myVehicles.length }} 辆</strong>
      <span>租来的车看订单和取还车信息，发布的车管理上架、照片和报告。</span>
    </div>
    <el-button type="primary" @click="router.push('/user/publish')">发布车辆</el-button>
  </section>

  <section class="vehicle-switch" aria-label="我的车辆分类">
    <button type="button" :class="{ active: activeTab === 'rented' }" @click="activeTab = 'rented'">
      我租到的车 <span>{{ rentedOrders.length }}</span>
    </button>
    <button type="button" :class="{ active: activeTab === 'listed' }" @click="activeTab = 'listed'">
      我租出去的车 <span>{{ myVehicles.length }}</span>
    </button>
  </section>

  <section v-if="activeTab === 'rented'" class="vehicle-owner-list">
    <article v-for="order in rentedOrders" :key="order.id" class="vehicle-card owner-card rented-card">
      <div class="owner-card-media" :class="{ empty: !vehicleInfo(order.vehicleId)?.images?.length }">
        <img v-if="vehicleInfo(order.vehicleId)?.images?.[0]" :src="vehicleInfo(order.vehicleId)?.images?.[0]?.url" :alt="vehicleInfo(order.vehicleId)?.images?.[0]?.name" />
        <span v-else>{{ vehicleInfo(order.vehicleId)?.plateNo?.slice(0, 2) || '车' }}</span>
      </div>
      <div class="owner-card-body">
        <div class="vehicle-card-head">
          <h3>{{ fleet.vehicleName(order.vehicleId) }}</h3>
          <div class="vehicle-card-badges">
            <GradeTag :grade="vehicleInfo(order.vehicleId)?.grade" />
            <StatusTag :status="order.status" />
          </div>
        </div>
        <div class="vehicle-meta">
          <span>{{ vehicleInfo(order.vehicleId)?.energyType || '车辆' }} | {{ vehicleInfo(order.vehicleId)?.color || '颜色待补充' }} | {{ vehicleInfo(order.vehicleId)?.mileage || 0 }} km</span>
          <span>{{ vehicleInfo(order.vehicleId)?.city || '重庆' }} | {{ vehicleInfo(order.vehicleId)?.pickupLocation || '车主约定取车点' }}</span>
          <span>租金：{{ order.amount }} 元 | 押金：{{ order.deposit }} 元</span>
          <span>周期：{{ order.startAt }} 至 {{ order.endAt }}</span>
        </div>
        <div class="owner-actions">
          <el-button @click="router.push('/user/orders')">订单详情</el-button>
          <el-button @click="showRentedReport(order.vehicleId)">预览报告</el-button>
        </div>
      </div>
    </article>
    <el-empty v-if="rentedOrders.length === 0" description="还没有租到车辆" />
  </section>

  <section v-else class="vehicle-owner-list">
    <article v-for="vehicle in myVehicles" :key="vehicle.id" class="vehicle-card owner-card">
      <div class="owner-card-media" :class="{ empty: !vehicle.images?.length }">
        <img v-if="vehicle.images?.[0]" :src="vehicle.images[0].url" :alt="vehicle.images[0].name" />
        <span v-else>{{ vehicle.plateNo.slice(0, 2) }}</span>
      </div>
      <div class="owner-card-body">
        <div class="vehicle-card-head">
          <h3>{{ vehicle.plateNo }} {{ vehicle.brandModel }}</h3>
          <div class="vehicle-card-badges">
            <GradeTag :grade="vehicle.grade" />
            <StatusTag :status="vehicle.status" />
          </div>
        </div>
        <div class="vehicle-meta">
          <span>{{ vehicle.energyType }} | {{ vehicle.color }} | {{ vehicle.mileage }} km</span>
          <span>{{ vehicle.city || '重庆' }} | {{ vehicle.pickupLocation || '待填写取车地点' }}</span>
          <span>日租：{{ vehicle.dailyPrice || 0 }} 元 | 押金：{{ vehicle.deposit || 0 }} 元 | 最短 {{ vehicle.minRentalDays || 1 }} 天</span>
          <span>检测报告：{{ vehicle.reportFiles?.length ? `${vehicle.reportFiles.length} 个附件` : '未上传' }}</span>
        </div>
        <p v-if="vehicle.description" class="owner-description">{{ vehicle.description }}</p>
        <div class="owner-actions">
          <el-button @click="edit(vehicle)">编辑</el-button>
          <el-button @click="showReport(vehicle)">预览报告</el-button>
          <el-button :type="vehicle.status === '停用' ? 'primary' : 'warning'" @click="toggleStatus(vehicle)">
            {{ vehicle.status === '停用' ? '上架' : '下架' }}
          </el-button>
        </div>
      </div>
    </article>
    <el-empty v-if="myVehicles.length === 0" description="还没有发布车辆" />
  </section>

  <el-dialog :model-value="!!previewFile" title="检测报告预览" width="760px" class="report-file-dialog" @close="previewFile = null">
    <ReportFilePreview v-if="previewFile" :file="previewFile" />
  </el-dialog>
</template>

<style scoped>
.my-vehicle-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.my-vehicle-toolbar div { display: flex; flex-direction: column; gap: 4px; }
.my-vehicle-toolbar span { color: var(--muted); font-weight: 700; }
.vehicle-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.vehicle-switch button { height: 48px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--text); font-weight: 900; cursor: pointer; }
.vehicle-switch button.active { border-color: #f6b153; color: #06262a; background: var(--accent-soft); }
.vehicle-switch span { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; margin-left: 6px; border-radius: 999px; background: #e6fbf8; }
.vehicle-owner-list { display: grid; gap: 16px; }
.owner-card { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 18px; align-items: stretch; }
.owner-card-media { min-height: 170px; border-radius: 8px; overflow: hidden; background: #f5efe5; border: 1px solid var(--line); }
.owner-card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.owner-card-media.empty { display: grid; place-items: center; color: var(--primary); font-size: 34px; font-weight: 900; }
.owner-card-body { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.rented-card .owner-card-media { background: linear-gradient(135deg, #f5efe5, #e6fbf8); }
.owner-description { margin: 0; color: var(--muted); font-weight: 700; line-height: 1.7; }
.owner-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto; }
@media (max-width: 820px) {
  :global(.report-file-dialog) {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
    margin: 10vh auto 0 !important;
  }

  :global(.report-file-dialog .el-dialog__body) {
    padding: 12px !important;
    overflow-x: hidden;
  }

  .my-vehicle-toolbar { padding: 12px; }
  .my-vehicle-toolbar span { display: none; }
  .vehicle-switch { margin-bottom: 12px; }
  .vehicle-switch button { height: 42px; font-size: 14px; }
  .owner-card { grid-template-columns: 1fr; gap: 12px; }
  .owner-card-media { min-height: 150px; }
  .owner-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .owner-actions .el-button { margin: 0; }
}
</style>
