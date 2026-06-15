<script setup lang="ts">
import { computed, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { ElMessage } from 'element-plus';
import { getErrorMessage } from '@/utils/errors';
import type { DispatchTask, RentalOrder } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const activeStatus = ref('全部');
const detailVisible = ref(false);
const selectedOrder = ref<RentalOrder | null>(null);
const taskDetailVisible = ref(false);
const selectedTask = ref<DispatchTask | null>(null);

const isDriver = computed(() => auth.currentUser?.role === 'driver');
const statusOptions = computed(() =>
  isDriver.value ? ['全部', '待接收', '执行中', '已完成', '已取消'] : ['全部', '待审核', '待取车', '租赁中', '已完成', '已取消']
);
const canUpdateRental = computed(() => can(auth.currentUser, 'rental:update'));
const canUpdateDispatch = computed(() => can(auth.currentUser, 'dispatch:update'));
const currentDriver = computed(() => fleet.data.drivers.find((driver) => driver.userId === auth.currentUser?.id));

const orders = computed(() =>
  fleet.data.rentalOrders
    .filter((order) => order.userId === auth.currentUser?.id)
    .filter((order) => activeStatus.value === '全部' || order.status === activeStatus.value)
);
const driverOrders = computed(() =>
  fleet.data.dispatchTasks
    .filter((task) => task.driverId === currentDriver.value?.id)
    .filter((task) => activeStatus.value === '全部' || task.status === activeStatus.value)
);

function vehicleInfo(vehicleId: string) {
  return fleet.data.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

const selectedVehicle = computed(() => (selectedOrder.value ? vehicleInfo(selectedOrder.value.vehicleId) : undefined));

function openDetail(order: RentalOrder) {
  selectedOrder.value = order;
  detailVisible.value = true;
}

function openTaskDetail(task: DispatchTask) {
  selectedTask.value = task;
  taskDetailVisible.value = true;
}

function updateOrderStatus(order: RentalOrder, status: RentalOrder['status']) {
  try {
    fleet.upsertRentalOrder({ ...order, status });
    ElMessage.success(status === '已取消' ? '订单已取消' : '还车申请已完成，车辆状态已释放');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

function updateTaskStatus(task: DispatchTask, status: DispatchTask['status']) {
  try {
    fleet.upsertDispatchTask({ ...task, status });
    ElMessage.success(status === '执行中' ? '调度订单已接收' : '调度订单已完成，车辆和司机已释放');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}
</script>

<template>
  <PageHeader :title="isDriver ? '调度订单' : '我的订单'" :subtitle="isDriver ? '查看本人调度订单、车辆和线路状态' : '查看租车后生成的订单、金额和车辆状态'" />

  <section class="order-filter">
    <button
      v-for="status in statusOptions"
      :key="status"
      type="button"
      :class="{ active: activeStatus === status }"
      @click="activeStatus = status"
    >
      {{ status }}
    </button>
  </section>

  <section v-if="!isDriver" class="order-list">
    <article v-for="order in orders" :key="order.id" class="order-card">
      <div class="order-card-head">
        <span>{{ order.orderNo }}</span>
        <div class="mobile-record-badges">
          <GradeTag :grade="vehicleInfo(order.vehicleId)?.grade" />
          <StatusTag :status="order.status" />
        </div>
      </div>

      <div class="order-vehicle">
        <div class="order-thumb">
          <el-icon><Van /></el-icon>
        </div>
        <div>
          <h3>{{ fleet.vehicleName(order.vehicleId) }}</h3>
          <p>
            {{ vehicleInfo(order.vehicleId)?.energyType || '车辆' }}
            <span>|</span>
            {{ vehicleInfo(order.vehicleId)?.mileage || 0 }} km
          </p>
        </div>
      </div>

      <div class="order-meta">
        <div><span>租金</span><strong>{{ order.amount }} 元</strong></div>
        <div><span>押金</span><strong>{{ order.deposit }} 元</strong></div>
        <div><span>取车时间</span><strong>{{ order.startAt }}</strong></div>
        <div><span>还车时间</span><strong>{{ order.endAt }}</strong></div>
      </div>

      <div class="order-actions">
        <el-button @click="openDetail(order)">查看详情</el-button>
        <el-button v-if="canUpdateRental && order.status === '待审核'" type="danger" plain @click="updateOrderStatus(order, '已取消')">取消订单</el-button>
        <el-button v-if="canUpdateRental && order.status === '租赁中'" type="primary" @click="updateOrderStatus(order, '已完成')">申请还车</el-button>
      </div>
    </article>

    <el-empty v-if="orders.length === 0" description="暂无订单" />
  </section>

  <section v-else class="order-list">
    <article v-for="task in driverOrders" :key="task.id" class="order-card">
      <div class="order-card-head">
        <span>{{ task.taskNo }}</span>
        <StatusTag :status="task.status" />
      </div>

      <div class="order-vehicle">
        <div class="order-thumb">
          <el-icon><Guide /></el-icon>
        </div>
        <div>
          <h3>{{ task.routeName }}</h3>
          <p>{{ fleet.vehicleName(task.vehicleId) }}</p>
        </div>
      </div>

      <div class="order-meta">
        <div><span>车辆</span><strong>{{ fleet.vehicleName(task.vehicleId) }}</strong></div>
        <div><span>司机</span><strong>{{ fleet.driverName(task.driverId) }}</strong></div>
        <div><span>出车时间</span><strong>{{ task.scheduledAt }}</strong></div>
        <div><span>起终点</span><strong>{{ task.startPoint }} 至 {{ task.endPoint }}</strong></div>
      </div>

      <div class="order-actions">
        <el-button @click="openTaskDetail(task)">查看详情</el-button>
        <el-button v-if="canUpdateDispatch && task.status === '待接收'" type="primary" @click="updateTaskStatus(task, '执行中')">接收订单</el-button>
        <el-button v-if="canUpdateDispatch && task.status === '执行中'" type="success" @click="updateTaskStatus(task, '已完成')">完成订单</el-button>
      </div>
    </article>

    <el-empty v-if="driverOrders.length === 0" description="暂无调度订单" />
  </section>

  <el-dialog v-model="detailVisible" title="订单详情" width="560px">
    <div v-if="selectedOrder" class="order-meta">
      <div><span>订单号</span><strong>{{ selectedOrder.orderNo }}</strong></div>
      <div><span>车辆</span><strong>{{ fleet.vehicleName(selectedOrder.vehicleId) }}</strong></div>
      <div><span>能源/里程</span><strong>{{ selectedVehicle?.energyType || '-' }} | {{ selectedVehicle?.mileage || 0 }} km</strong></div>
      <div><span>仓库车位</span><strong>{{ selectedVehicle?.warehouse || '待分配' }} {{ selectedVehicle?.parkingSpace || '' }}</strong></div>
      <div><span>租金/押金</span><strong>{{ selectedOrder.amount }} / {{ selectedOrder.deposit }} 元</strong></div>
      <div><span>起止时间</span><strong>{{ selectedOrder.startAt }} 至 {{ selectedOrder.endAt }}</strong></div>
    </div>
    <template #footer>
      <el-button type="primary" @click="detailVisible = false">知道了</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="taskDetailVisible" title="调度订单详情" width="560px">
    <div v-if="selectedTask" class="order-meta">
      <div><span>订单号</span><strong>{{ selectedTask.taskNo }}</strong></div>
      <div><span>线路</span><strong>{{ selectedTask.routeName }}</strong></div>
      <div><span>车辆</span><strong>{{ fleet.vehicleName(selectedTask.vehicleId) }}</strong></div>
      <div><span>司机</span><strong>{{ fleet.driverName(selectedTask.driverId) }}</strong></div>
      <div><span>出车时间</span><strong>{{ selectedTask.scheduledAt }}</strong></div>
      <div><span>起终点</span><strong>{{ selectedTask.startPoint }} 至 {{ selectedTask.endPoint }}</strong></div>
      <div><span>备注</span><strong>{{ selectedTask.remark || '无' }}</strong></div>
    </div>
    <template #footer>
      <el-button type="primary" @click="taskDetailVisible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>
