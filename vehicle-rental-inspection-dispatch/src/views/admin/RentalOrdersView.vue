<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { formatBeijingDateTime } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import type { RentalOrder } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const keyword = ref('');
const dialogVisible = ref(false);
const form = reactive({
  vehicleId: '',
  customerName: '租车客户'
});
const orderForm = reactive({
  id: '',
  orderNo: '',
  vehicleId: '',
  userId: 'u-user',
  customerName: '',
  startAt: '',
  endAt: '',
  amount: 0,
  deposit: 0,
  status: '待审核' as RentalOrder['status']
});
const available = computed(() => fleet.data.vehicles.filter((item) => item.status === '可租赁' || item.status === '预备库'));
const canCreateRental = computed(() => can(auth.currentUser, 'rental:create'));
const canUpdateRental = computed(() => can(auth.currentUser, 'rental:update'));
const orders = computed(() =>
  fleet.data.rentalOrders.filter((item) => `${item.orderNo}${fleet.vehicleName(item.vehicleId)}${item.customerName}${item.status}`.includes(keyword.value.trim()))
);

function createOrder() {
  if (!form.vehicleId) {
    ElMessage.warning('请选择车辆');
    return;
  }
  try {
    fleet.createRentalOrder(form.vehicleId, 'u-user', form.customerName);
    ElMessage.success('租赁订单已创建，车辆状态已同步为已出租');
    form.vehicleId = '';
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

function resetOrderForm() {
  Object.assign(orderForm, {
    id: '',
    orderNo: '',
    vehicleId: '',
    userId: 'u-user',
    customerName: '租车客户',
    startAt: formatBeijingDateTime(),
    endAt: formatBeijingDateTime(),
    amount: 0,
    deposit: 3000,
    status: '待审核'
  });
}

function openCreateOrder() {
  resetOrderForm();
  dialogVisible.value = true;
}

function openEditOrder(order: RentalOrder) {
  Object.assign(orderForm, {
    id: order.id,
    orderNo: order.orderNo,
    vehicleId: order.vehicleId,
    userId: order.userId,
    customerName: order.customerName,
    startAt: order.startAt,
    endAt: order.endAt,
    amount: order.amount,
    deposit: order.deposit,
    status: order.status
  });
  dialogVisible.value = true;
}

function fillPrice() {
  const vehicle = fleet.data.vehicles.find((item) => item.id === orderForm.vehicleId);
  if (!vehicle) return;
  orderForm.amount = vehicle.dailyPrice ?? orderForm.amount;
  orderForm.deposit = vehicle.deposit ?? orderForm.deposit;
}

function saveOrder() {
  if (!orderForm.vehicleId || !orderForm.customerName) {
    ElMessage.warning('请选择车辆并填写客户');
    return;
  }
  try {
    fleet.upsertRentalOrder({
      id: orderForm.id || undefined,
      orderNo: orderForm.orderNo || undefined,
      vehicleId: orderForm.vehicleId,
      userId: orderForm.userId,
      customerName: orderForm.customerName,
      startAt: orderForm.startAt,
      endAt: orderForm.endAt,
      amount: orderForm.amount,
      deposit: orderForm.deposit,
      status: orderForm.status
    });
    dialogVisible.value = false;
    ElMessage.success(orderForm.id ? '租赁订单已更新' : '租赁订单已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeOrder(order: RentalOrder) {
  await ElMessageBox.confirm(`确定删除订单 ${order.orderNo} 吗？`, '删除订单', { type: 'warning' });
  fleet.deleteRentalOrder(order.id);
  ElMessage.success('订单已删除');
}
</script>

<template>
  <PageHeader title="租赁订单" subtitle="快速创建租赁订单，订单数据统一进入数据中心管理">
    <el-button v-if="canCreateRental" type="primary" @click="openCreateOrder">
      <el-icon><Plus /></el-icon>
      新增订单
    </el-button>
  </PageHeader>

  <section v-if="canCreateRental" class="panel">
    <h2 class="panel-title">快速创建租赁订单</h2>
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="车辆">
          <el-select v-model="form.vehicleId" filterable placeholder="选择可租车辆">
            <el-option v-for="vehicle in available" :key="vehicle.id" :label="`${vehicle.plateNo} ${vehicle.brandModel}`" :value="vehicle.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户"><el-input v-model="form.customerName" /></el-form-item>
        <el-form-item label="操作"><el-button type="primary" @click="createOrder">创建订单</el-button></el-form-item>
      </div>
    </el-form>
  </section>

  <section class="panel data-center-hint">
    <div>
      <h2 class="panel-title">订单数据已归档到数据中心</h2>
      <p>租赁订单的查询、编辑、删除和状态维护统一在数据中心完成，当前页面保留快速创建入口。</p>
    </div>
    <router-link to="/admin/reports" class="hint-link">进入数据中心</router-link>
  </section>

  <el-dialog v-model="dialogVisible" :title="orderForm.id ? '编辑租赁订单' : '新增租赁订单'" width="720px">
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="订单号"><el-input v-model="orderForm.orderNo" placeholder="留空自动生成" :disabled="!!orderForm.id" /></el-form-item>
        <el-form-item label="车辆">
          <el-select v-model="orderForm.vehicleId" filterable @change="fillPrice">
            <el-option v-for="vehicle in fleet.data.vehicles" :key="vehicle.id" :label="`${vehicle.plateNo} ${vehicle.brandModel}`" :value="vehicle.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户"><el-input v-model="orderForm.customerName" /></el-form-item>
        <el-form-item label="开始时间"><el-input v-model="orderForm.startAt" /></el-form-item>
        <el-form-item label="结束时间"><el-input v-model="orderForm.endAt" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="orderForm.status">
            <el-option label="待审核" value="待审核" />
            <el-option label="待取车" value="待取车" />
            <el-option label="租赁中" value="租赁中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </el-form-item>
        <el-form-item label="租金"><el-input-number v-model="orderForm.amount" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="押金"><el-input-number v-model="orderForm.deposit" :min="0" style="width: 100%" /></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button v-if="orderForm.id ? canUpdateRental : canCreateRental" type="primary" @click="saveOrder">保存</el-button>
    </template>
  </el-dialog>
</template>
