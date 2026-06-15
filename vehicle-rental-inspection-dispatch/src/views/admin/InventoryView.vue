<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { getErrorMessage } from '@/utils/errors';
import type { InventoryRecord } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const keyword = ref('');
const dialogVisible = ref(false);
const form = reactive({
  vehicleId: '',
  warehouse: '默认网约车预备库',
  parkingSpace: 'P-009'
});
const recordForm = reactive({
  id: '',
  recordNo: '',
  vehicleId: '',
  type: '入库' as InventoryRecord['type'],
  source: '手动入库' as InventoryRecord['source'],
  warehouse: '',
  parkingSpace: '',
  operator: '',
  mileage: 0,
  energyLevel: 80,
  remark: '',
  createdAt: ''
});

const stockableVehicles = computed(() => fleet.data.vehicles.filter((item) => item.status === '已检测' || item.status === '待入库' || item.status === '待检测'));
const readyVehicles = computed(() => fleet.data.vehicles.filter((item) => item.status === '预备库'));
const canCreateInventory = computed(() => can(auth.currentUser, 'inventory:create'));
const records = computed(() =>
  fleet.data.inventoryRecords.filter((item) => `${fleet.vehicleName(item.vehicleId)}${item.type}${item.source}${item.warehouse}${item.operator}`.includes(keyword.value.trim()))
);

function stockIn() {
  if (!form.vehicleId) {
    ElMessage.warning('请选择车辆');
    return;
  }
  try {
    fleet.stockIn(form.vehicleId, auth.currentUser?.name || '管理员', form.warehouse, form.parkingSpace);
    ElMessage.success('车辆已入库，并同步到网约车预备库');
    form.vehicleId = '';
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

function resetRecordForm() {
  Object.assign(recordForm, {
    id: '',
    recordNo: '',
    vehicleId: '',
    type: '入库',
    source: '手动入库',
    warehouse: '默认网约车预备库',
    parkingSpace: 'P-001',
    operator: auth.currentUser?.name || '管理员',
    mileage: 0,
    energyLevel: 80,
    remark: '',
    createdAt: ''
  });
}

function openCreateRecord() {
  resetRecordForm();
  dialogVisible.value = true;
}

function openEditRecord(record: InventoryRecord) {
  Object.assign(recordForm, {
    id: record.id,
    recordNo: record.recordNo,
    vehicleId: record.vehicleId,
    type: record.type,
    source: record.source,
    warehouse: record.warehouse,
    parkingSpace: record.parkingSpace,
    operator: record.operator,
    mileage: record.mileage,
    energyLevel: record.energyLevel,
    remark: record.remark,
    createdAt: record.createdAt
  });
  dialogVisible.value = true;
}

function saveRecord() {
  if (!recordForm.vehicleId || !recordForm.warehouse || !recordForm.operator) {
    ElMessage.warning('请填写车辆、仓库和操作人');
    return;
  }
  try {
    fleet.upsertInventoryRecord({
      id: recordForm.id || undefined,
      recordNo: recordForm.recordNo || undefined,
      vehicleId: recordForm.vehicleId,
      type: recordForm.type,
      source: recordForm.source,
      warehouse: recordForm.warehouse,
      parkingSpace: recordForm.parkingSpace,
      operator: recordForm.operator,
      mileage: recordForm.mileage,
      energyLevel: recordForm.energyLevel,
      remark: recordForm.remark,
      createdAt: recordForm.createdAt || undefined
    });
    dialogVisible.value = false;
    ElMessage.success(recordForm.id ? '入库流水已更新' : '入库流水已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeRecord(record: InventoryRecord) {
  await ElMessageBox.confirm(`确定删除这条 ${record.type} 流水吗？`, '删除流水', { type: 'warning' });
  fleet.deleteInventoryRecord(record.id);
  ElMessage.success('流水已删除');
}
</script>

<template>
  <PageHeader title="入库与预备库" subtitle="检测完成后可直接进入网约车预备库，也支持手动入库" />

  <div class="grid-2">
    <section class="panel">
      <h2 class="panel-title">手动入库</h2>
      <el-form label-position="top">
        <el-form-item label="车辆">
          <el-select v-model="form.vehicleId" filterable placeholder="选择待入库车辆">
            <el-option v-for="vehicle in stockableVehicles" :key="vehicle.id" :label="`${vehicle.plateNo} ${vehicle.brandModel}`" :value="vehicle.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库"><el-input v-model="form.warehouse" /></el-form-item>
        <el-form-item label="车位"><el-input v-model="form.parkingSpace" /></el-form-item>
        <el-button v-if="canCreateInventory" type="primary" @click="stockIn">确认入库</el-button>
      </el-form>
    </section>

    <section class="panel">
      <h2 class="panel-title">网约车预备库</h2>
      <div class="table-shell desktop-table">
        <el-table :data="readyVehicles" size="large">
          <el-table-column prop="plateNo" label="车牌" width="110" />
          <el-table-column prop="brandModel" label="车型" min-width="170" />
          <el-table-column prop="warehouse" label="仓库" min-width="160" />
          <el-table-column prop="parkingSpace" label="车位" width="90" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="vehicle in readyVehicles" :key="vehicle.id" class="mobile-record-card compact">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ vehicle.plateNo }} {{ vehicle.brandModel }}</div>
            <StatusTag :status="vehicle.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>仓库</span><strong>{{ vehicle.warehouse }}</strong></div>
            <div><span>车位</span><strong>{{ vehicle.parkingSpace }}</strong></div>
          </div>
        </article>
      </div>
    </section>
  </div>

  <section class="panel data-center-hint">
    <div>
      <h2 class="panel-title">入库数据已归档到数据中心</h2>
      <p>流水新增、编辑、删除和筛选统一在数据中心处理，当前页面只保留入库操作和预备库查看。</p>
    </div>
    <router-link to="/admin/reports" class="hint-link">进入数据中心</router-link>
  </section>
</template>
