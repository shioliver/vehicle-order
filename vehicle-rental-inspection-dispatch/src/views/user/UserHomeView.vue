<script setup lang="ts">
import { computed } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { userNavByRole, type UserAccountRole } from '@/auth/permissions';

const fleet = useFleetStore();
const auth = useAuthStore();

const isCustomer = computed(() => auth.currentUser?.role === 'customer');
const isDriver = computed(() => auth.currentUser?.role === 'driver');
const currentRole = computed<UserAccountRole>(() => (auth.currentUser?.role as UserAccountRole | undefined) ?? 'customer');
const currentDriver = computed(() => fleet.data.drivers.find((driver) => driver.userId === auth.currentUser?.id));
const customerOrders = computed(() => fleet.data.rentalOrders.filter((order) => order.userId === auth.currentUser?.id));
const ownerVehicles = computed(() => fleet.data.vehicles.filter((vehicle) => vehicle.ownerId === auth.currentUser?.id));
const driverTasks = computed(() => fleet.data.dispatchTasks.filter((task) => task.driverId === currentDriver.value?.id));
const activeDriverTasks = computed(() => driverTasks.value.filter((task) => task.status === '待接收' || task.status === '执行中'));
const pendingDriverTasks = computed(() => driverTasks.value.filter((task) => task.status === '待接收'));
const rentableVehicles = computed(() =>
  fleet.data.vehicles.filter((vehicle) => (vehicle.status === '可租赁' || vehicle.status === '预备库') && vehicle.ownerId !== auth.currentUser?.id)
);
const recentCustomerOrders = computed(() => customerOrders.value.slice(0, 3));
const recentOwnerVehicles = computed(() => ownerVehicles.value.slice(0, 3));
const driverTaskPreview = computed(() => driverTasks.value.slice(0, 4));
const headerSubtitle = computed(() =>
  isDriver.value ? '查看调度任务、订单和车辆检测报告。' : '发布车辆、租车下单和管理订单。'
);
const heroSlides = computed(() => [
  {
    title: '车辆租赁服务',
    subtitle: '查看可租车辆、押金租金与订单状态',
    stat: '租车下单',
    icon: 'Van',
    role: 'customer'
  },
  {
    title: '车主发布中心',
    subtitle: '上传车辆信息、照片和检测报告附件',
    stat: '车源上架',
    icon: 'Plus',
    role: 'customer'
  },
  {
    title: '司机任务中心',
    subtitle: '司机可查看线路、车辆和接单状态',
    stat: '调度任务',
    icon: 'Guide',
    role: 'driver'
  }
].filter((slide) => (slide.role === 'customer' ? isCustomer.value : isDriver.value)));

const quickActions = computed(() =>
  userNavByRole[currentRole.value]
    .filter((item) => item.key !== 'home')
    .map((item) => ({ to: item.to, title: item.label, icon: item.icon }))
);

const metricItems = computed(() => {
  if (isDriver.value) {
    return [
      { label: '我的任务', value: driverTasks.value.length },
      { label: '待接收', value: pendingDriverTasks.value.length },
      { label: '执行中', value: activeDriverTasks.value.filter((task) => task.status === '执行中').length },
      { label: '司机状态', value: currentDriver.value?.status ?? '未绑定' }
    ];
  }

  return [
    { label: '可租车辆', value: rentableVehicles.value.length },
    { label: '我的车源', value: ownerVehicles.value.length },
    { label: '租赁订单', value: customerOrders.value.length }
  ];
});
</script>

<template>
  <PageHeader title="用户首页" :subtitle="`欢迎，${auth.currentUser?.name}。${headerSubtitle}`" />

  <section class="dashboard-hero user-dashboard-hero">
    <el-carousel class="ops-carousel" height="176px" arrow="never" indicator-position="none" pause-on-hover>
      <el-carousel-item v-for="slide in heroSlides" :key="slide.title">
        <div class="ops-slide user-ops-slide">
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

  <section class="metric-grid user-home-metrics" :class="{ 'is-driver-home': isDriver }">
    <div v-for="item in metricItems" :key="item.label" class="metric-card">
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </div>
  </section>

  <section class="quick-action-panel user-home-quick">
    <div class="quick-action-heading">
      <strong>快捷功能</strong>
      <span>{{ isDriver ? '司机入口' : '租车服务入口' }}</span>
    </div>
    <div class="quick-action-grid">
      <router-link v-for="item in quickActions" :key="item.title" :to="item.to" class="quick-action-card">
        <span class="quick-action-icon"><el-icon><component :is="item.icon" /></el-icon></span>
        <strong>{{ item.title }}</strong>
      </router-link>
    </div>
  </section>

  <section v-if="isCustomer" class="panel">
    <h2 class="panel-title">推荐车辆</h2>
    <div class="grid-3">
      <article v-for="vehicle in rentableVehicles.slice(0, 3)" :key="vehicle.id" class="vehicle-card">
        <div class="vehicle-card-head">
          <h3>{{ vehicle.plateNo }} {{ vehicle.brandModel }}</h3>
          <div class="vehicle-card-badges">
            <GradeTag :grade="vehicle.grade" />
            <StatusTag :status="vehicle.status" />
          </div>
        </div>
        <div class="vehicle-meta">
          <span>能源：{{ vehicle.energyType }} | 里程：{{ vehicle.mileage }} km</span>
          <span>日租：{{ vehicle.dailyPrice || 268 }} 元 | 押金：{{ vehicle.deposit || 3000 }} 元</span>
        </div>
      </article>
    </div>
    <el-empty v-if="rentableVehicles.length === 0" description="暂无可租车辆" />
  </section>

  <div v-if="isCustomer" class="grid-2">
    <section class="panel">
      <h2 class="panel-title">我的租赁订单</h2>
      <div class="table-shell desktop-table">
        <el-table :data="recentCustomerOrders" size="large">
          <template #empty>
            <el-empty description="暂无租赁订单" />
          </template>
          <el-table-column prop="orderNo" label="订单号" min-width="150" />
          <el-table-column label="车辆" min-width="170">
            <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="order in recentCustomerOrders" :key="order.id" class="mobile-record-card compact">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ order.orderNo }}</div>
            <StatusTag :status="order.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车辆</span><strong>{{ fleet.vehicleName(order.vehicleId) }}</strong></div>
            <div><span>租期</span><strong>{{ order.startAt }} 至 {{ order.endAt }}</strong></div>
          </div>
        </article>
        <el-empty v-if="recentCustomerOrders.length === 0" description="暂无租赁订单" />
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">我的发布车辆</h2>
      <div class="table-shell desktop-table">
        <el-table :data="recentOwnerVehicles" size="large">
          <template #empty>
            <el-empty description="暂无发布车辆" />
          </template>
          <el-table-column prop="plateNo" label="车牌" min-width="120" />
          <el-table-column prop="brandModel" label="车型" min-width="170" />
          <el-table-column label="评级" width="90">
            <template #default="{ row }"><GradeTag :grade="row.grade" /></template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="vehicle in recentOwnerVehicles" :key="vehicle.id" class="mobile-record-card compact">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ vehicle.plateNo }}</div>
            <StatusTag :status="vehicle.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车型</span><strong>{{ vehicle.brandModel }}</strong></div>
            <div><span>租金</span><strong>{{ vehicle.dailyPrice || 0 }} 元/日</strong></div>
          </div>
        </article>
        <el-empty v-if="recentOwnerVehicles.length === 0" description="暂无发布车辆" />
      </div>
    </section>
  </div>

  <section v-if="isDriver" class="panel">
    <h2 class="panel-title">我的调度任务</h2>
    <div class="table-shell desktop-table">
      <el-table :data="driverTaskPreview" size="large">
        <template #empty>
          <el-empty description="暂无调度任务" />
        </template>
        <el-table-column prop="taskNo" label="任务号" min-width="150" />
        <el-table-column prop="routeName" label="线路" min-width="160" />
        <el-table-column label="车辆" min-width="180">
          <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><StatusTag :status="row.status" /></template>
        </el-table-column>
      </el-table>
    </div>
    <div class="mobile-card-list admin-mobile-list">
      <article v-for="task in driverTaskPreview" :key="task.id" class="mobile-record-card compact">
        <div class="mobile-record-head">
          <div class="mobile-record-title">{{ task.taskNo }}</div>
          <StatusTag :status="task.status" />
        </div>
        <div class="mobile-record-grid">
          <div><span>线路</span><strong>{{ task.routeName }}</strong></div>
          <div><span>车辆</span><strong>{{ fleet.vehicleName(task.vehicleId) }}</strong></div>
          <div><span>起终点</span><strong>{{ task.startPoint }} 至 {{ task.endPoint }}</strong></div>
        </div>
      </article>
      <el-empty v-if="driverTaskPreview.length === 0" description="暂无调度任务" />
    </div>
  </section>
</template>

<style scoped>
@media (max-width: 820px) {
  .user-home-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .user-home-metrics.is-driver-home {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .user-home-metrics .metric-card {
    min-height: 70px;
    padding: 10px 12px;
    border-radius: 8px;
  }

  .user-home-metrics .metric-card::after {
    display: none;
  }

  .user-home-metrics .metric-card span {
    display: block;
    font-size: 12px;
    line-height: 1.25;
    white-space: nowrap;
  }

  .user-home-metrics .metric-card strong {
    font-size: 24px;
    line-height: 1.05;
    margin-top: 8px;
  }

  .user-home-metrics.is-driver-home .metric-card {
    min-height: 64px;
    padding: 9px 8px;
  }

  .user-home-metrics.is-driver-home .metric-card strong {
    font-size: 20px;
  }

  .user-home-quick {
    padding: 14px;
    margin-bottom: 14px;
  }

  .user-home-quick .quick-action-heading {
    margin-bottom: 10px;
  }

  .user-home-quick .quick-action-heading span {
    display: none;
  }

  .user-home-quick .quick-action-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .user-home-quick .quick-action-card {
    min-height: 72px;
    padding: 10px 4px;
  }

  .user-home-quick .quick-action-icon {
    width: 34px;
    height: 34px;
  }
}

@media (max-width: 380px) {
  .user-home-metrics.is-driver-home {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .user-home-quick .quick-action-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
