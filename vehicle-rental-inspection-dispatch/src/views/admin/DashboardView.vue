<script setup lang="ts">
import { computed } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { adminNavByRole, type ManagementRole } from '@/auth/permissions';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import type { InspectionReport, Vehicle } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();

const currentRole = computed<ManagementRole>(() => (auth.currentUser?.role as ManagementRole | undefined) ?? 'super_admin');

const heroSlidesByRole: Record<ManagementRole, Array<{ title: string; subtitle: string; stat: string; icon: string }>> = {
  super_admin: [
    { title: '运营工作台', subtitle: '检测、入库、租赁、调度统一协同', stat: '全流程总览', icon: 'DataBoard' },
    { title: '检测报告联动', subtitle: '异常项、评级、预备库入库自动同步', stat: '报告生成与入库', icon: 'DocumentChecked' },
    { title: '网约车调度运营', subtitle: '预备库车辆、司机池、调度任务统一管理', stat: '调度任务闭环', icon: 'Guide' }
  ],
  inspection_admin: [
    { title: '检测管理工作台', subtitle: '聚焦待检车辆、异常评级和报告生成', stat: '检测优先', icon: 'DocumentChecked' },
    { title: '报告与异常追踪', subtitle: '快速创建检测报告并进入数据中心复核', stat: '报告闭环', icon: 'Document' }
  ],
  rental_admin: [
    { title: '租赁调度工作台', subtitle: '预备库、租赁订单、司机和调度任务集中处理', stat: '租赁运营', icon: 'Tickets' },
    { title: '网约车预备库', subtitle: '关注可租车辆、库存位置和司机出车状态', stat: '库存与派车', icon: 'Guide' }
  ]
};

const heroSlides = computed(() => heroSlidesByRole[currentRole.value]);

const abnormalReports = computed(() =>
  fleet.data.reports.filter((item) => item.grade === 'C' || item.grade === 'D' || item.crashVerdict !== '正常')
);
const pendingInspectionVehicles = computed(() => fleet.data.vehicles.filter((item) => item.status === '待检测' || item.status === '检测中'));
const abnormalVehicles = computed(() => {
  const ids = new Set(abnormalReports.value.map((report) => report.vehicleId));
  return fleet.data.vehicles.filter((vehicle) => ids.has(vehicle.id) || vehicle.status === '维修中' || vehicle.status === '保养中');
});
const inspectionVehicleFocus = computed(() => {
  const seen = new Set<string>();
  return [...pendingInspectionVehicles.value, ...abnormalVehicles.value].filter((vehicle) => {
    if (seen.has(vehicle.id)) return false;
    seen.add(vehicle.id);
    return true;
  });
});
const readyVehicles = computed(() => fleet.data.vehicles.filter((item) => item.status === '预备库'));
const rentableVehicles = computed(() => fleet.data.vehicles.filter((item) => item.status === '可租赁'));
const activeRentalOrders = computed(() => fleet.data.rentalOrders.filter((item) => item.status !== '已完成' && item.status !== '已取消'));
const activeDispatchTasks = computed(() => fleet.data.dispatchTasks.filter((item) => item.status !== '已完成' && item.status !== '已取消'));
const availableDrivers = computed(() => fleet.data.drivers.filter((item) => item.status === '空闲'));

const metricItems = computed(() => {
  if (currentRole.value === 'inspection_admin') {
    return [
      { label: '待检车辆', value: pendingInspectionVehicles.value.length, icon: 'Van' },
      { label: '检测报告', value: fleet.data.reports.length, icon: 'Document' },
      { label: '异常车辆', value: abnormalVehicles.value.length, icon: 'Warning' },
      { label: '可入库车辆', value: fleet.data.vehicles.filter((item) => item.status === '已检测' || item.status === '待入库').length, icon: 'House' }
    ];
  }

  if (currentRole.value === 'rental_admin') {
    return [
      { label: '预备库车辆', value: readyVehicles.value.length, icon: 'House' },
      { label: '可租车辆', value: rentableVehicles.value.length, icon: 'Tickets' },
      { label: '进行中订单', value: activeRentalOrders.value.length, icon: 'Document' },
      { label: '调度任务', value: activeDispatchTasks.value.length, icon: 'Guide' },
      { label: '空闲司机', value: availableDrivers.value.length, icon: 'User' }
    ];
  }

  return [
    { label: '车辆总数', value: fleet.metrics.totalVehicles, icon: 'Van' },
    { label: '检测报告', value: fleet.metrics.reports, icon: 'Document' },
    { label: '预备库车辆', value: fleet.metrics.readyVehicles, icon: 'House' },
    { label: '可租车辆', value: fleet.metrics.rentableVehicles, icon: 'Tickets' },
    { label: '调度任务', value: fleet.metrics.dispatching, icon: 'Guide' },
    { label: '异常车辆', value: fleet.metrics.abnormal, icon: 'Warning' }
  ];
});

const quickActions = computed(() => {
  return adminNavByRole[currentRole.value]
    .filter((item) => item.key !== 'dashboard' && item.key !== 'profile')
    .map((item) => ({ to: item.to, title: item.label, icon: item.icon }));
});

const recentReports = computed(() => fleet.data.reports.slice(0, currentRole.value === 'inspection_admin' ? 4 : 5));
const focusVehicles = computed(() =>
  (currentRole.value === 'inspection_admin' ? inspectionVehicleFocus.value : fleet.data.vehicles).slice(0, 5)
);
const rentalOverviewOrders = computed(() => activeRentalOrders.value.slice(0, currentRole.value === 'rental_admin' ? 4 : 3));
const dispatchOverviewTasks = computed(() => activeDispatchTasks.value.slice(0, currentRole.value === 'rental_admin' ? 4 : 3));

function isAbnormalVehicle(vehicle: Vehicle) {
  return abnormalVehicles.value.some((item) => item.id === vehicle.id);
}

function reportVehicleName(report: InspectionReport) {
  return fleet.vehicleName(report.vehicleId);
}
</script>

<template>
  <section class="dashboard-hero">
    <el-carousel class="ops-carousel" height="176px" arrow="never" indicator-position="none" pause-on-hover>
      <el-carousel-item v-for="slide in heroSlides" :key="slide.title">
        <div class="ops-slide">
          <div>
            <span class="ops-slide-kicker">{{ slide.stat }}</span>
            <h1>{{ slide.title }}</h1>
            <p>{{ slide.subtitle }}</p>
          </div>
          <span class="ops-slide-icon">
            <el-icon><component :is="slide.icon" /></el-icon>
          </span>
        </div>
      </el-carousel-item>
    </el-carousel>
  </section>

  <section class="quick-action-panel dashboard-mobile-actions">
    <div class="quick-action-heading">
      <strong>快捷功能</strong>
      <span>常用管理入口</span>
    </div>
    <div class="quick-action-grid">
      <router-link v-for="item in quickActions" :key="item.title" :to="item.to" class="quick-action-card">
        <span class="quick-action-icon"><el-icon><component :is="item.icon" /></el-icon></span>
        <strong>{{ item.title }}</strong>
      </router-link>
    </div>
  </section>

  <section class="metric-grid dashboard-metrics">
    <div v-for="item in metricItems" :key="item.label" class="metric-card">
      <div class="metric-icon"><el-icon><component :is="item.icon" /></el-icon></div>
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </div>
  </section>

  <div class="grid-2">
    <section v-if="currentRole !== 'rental_admin'" class="panel">
      <h2 class="panel-title">{{ currentRole === 'inspection_admin' ? '检测报告追踪' : '最近检测报告' }}</h2>
      <div class="table-shell desktop-table">
        <el-table :data="recentReports" size="large">
          <el-table-column prop="reportNo" label="报告编号" min-width="150" />
          <el-table-column label="车辆" min-width="180">
            <template #default="{ row }">{{ reportVehicleName(row) }}</template>
          </el-table-column>
          <el-table-column label="评级" width="90">
            <template #default="{ row }"><GradeTag :grade="row.grade" /></template>
          </el-table-column>
          <el-table-column prop="createdAt" label="生成时间" min-width="150" />
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="report in recentReports" :key="report.id" class="mobile-record-card compact">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ report.reportNo }}</div>
            <GradeTag :grade="report.grade" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车辆</span><strong>{{ reportVehicleName(report) }}</strong></div>
            <div><span>生成时间</span><strong>{{ report.createdAt }}</strong></div>
          </div>
        </article>
        <el-empty v-if="recentReports.length === 0" description="暂无检测报告" />
      </div>
    </section>

    <section v-if="currentRole !== 'rental_admin'" class="panel">
      <h2 class="panel-title">{{ currentRole === 'inspection_admin' ? '待检与异常车辆' : '车辆状态' }}</h2>
      <div class="table-shell desktop-table">
        <el-table :data="focusVehicles" size="large">
          <el-table-column prop="plateNo" label="车牌" width="110" />
          <el-table-column prop="brandModel" label="车型" min-width="170" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="vehicle in focusVehicles" :key="vehicle.id" class="mobile-record-card compact" :class="{ 'is-abnormal': isAbnormalVehicle(vehicle) }">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ vehicle.plateNo }}</div>
            <StatusTag :status="vehicle.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车型</span><strong>{{ vehicle.brandModel }}</strong></div>
          </div>
        </article>
        <el-empty v-if="focusVehicles.length === 0" description="暂无车辆数据" />
      </div>
    </section>

    <section v-if="currentRole !== 'inspection_admin'" class="panel">
      <h2 class="panel-title">租赁订单概览</h2>
      <div class="table-shell desktop-table">
        <el-table :data="rentalOverviewOrders" size="large">
          <el-table-column prop="orderNo" label="订单号" min-width="150" />
          <el-table-column label="车辆" min-width="170">
            <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" width="110" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="order in rentalOverviewOrders" :key="order.id" class="mobile-record-card compact">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ order.orderNo }}</div>
            <StatusTag :status="order.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车辆</span><strong>{{ fleet.vehicleName(order.vehicleId) }}</strong></div>
            <div><span>客户</span><strong>{{ order.customerName }}</strong></div>
          </div>
        </article>
        <el-empty v-if="rentalOverviewOrders.length === 0" description="暂无进行中订单" />
      </div>
    </section>

    <section v-if="currentRole !== 'inspection_admin'" class="panel">
      <h2 class="panel-title">调度与司机</h2>
      <div class="table-shell desktop-table">
        <el-table :data="dispatchOverviewTasks" size="large">
          <el-table-column prop="taskNo" label="任务号" min-width="150" />
          <el-table-column prop="routeName" label="线路" min-width="150" />
          <el-table-column label="司机" width="110">
            <template #default="{ row }">{{ fleet.driverName(row.driverId) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="task in dispatchOverviewTasks" :key="task.id" class="mobile-record-card compact">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ task.taskNo }}</div>
            <StatusTag :status="task.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>线路</span><strong>{{ task.routeName }}</strong></div>
            <div><span>司机</span><strong>{{ fleet.driverName(task.driverId) }}</strong></div>
          </div>
        </article>
        <el-empty v-if="dispatchOverviewTasks.length === 0" description="暂无调度任务" />
      </div>
    </section>
  </div>
</template>
