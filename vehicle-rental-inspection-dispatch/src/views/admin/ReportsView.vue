<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import ReportPreview from '@/components/ReportPreview.vue';
import GradeTag from '@/components/GradeTag.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { downloadReportDoc } from '@/services/reportTemplate';
import { formatBeijingDateTime } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import type { DispatchTask, Driver, InspectionReport, InventoryRecord, RentalOrder } from '@/types/domain';

type DataTab = 'reports' | 'inventory' | 'rentals' | 'dispatch' | 'drivers';

const fleet = useFleetStore();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const keyword = ref('');
const activeTab = ref<DataTab>('reports');
const selectedId = ref(fleet.data.reports[0]?.id ?? '');
const printSourceRef = ref<HTMLElement | null>(null);
const previewDialogVisible = ref(false);
const reportDialogVisible = ref(false);
const inventoryDialogVisible = ref(false);
const rentalDialogVisible = ref(false);
const taskDialogVisible = ref(false);
const driverDialogVisible = ref(false);
const reportGrade = ref('');
const reportPurpose = ref('');
const inventoryType = ref('');
const inventorySource = ref('');
const rentalStatus = ref('');
const dispatchStatus = ref('');
const driverStatus = ref('');

const reportForm = reactive({
  id: '',
  reportNo: '',
  vehicleId: '',
  clientName: '',
  clientPhone: '',
  purpose: '',
  inspectorName: '',
  inspectorNo: '',
  location: '',
  checkedAt: '',
  grade: 'A' as InspectionReport['grade'],
  abnormalSummary: '',
  suggestion: '',
  floodVerdict: '正常' as InspectionReport['floodVerdict'],
  fireVerdict: '正常' as InspectionReport['fireVerdict'],
  crashVerdict: '正常' as InspectionReport['crashVerdict'],
  items: [] as InspectionReport['items'],
  createdAt: ''
});

const inventoryForm = reactive({
  id: '',
  recordNo: '',
  vehicleId: '',
  type: '入库' as InventoryRecord['type'],
  source: '手动入库' as InventoryRecord['source'],
  warehouse: '默认网约车预备库',
  parkingSpace: 'P-001',
  operator: '管理员',
  mileage: 0,
  energyLevel: 80,
  remark: '',
  createdAt: ''
});

const rentalForm = reactive({
  id: '',
  orderNo: '',
  vehicleId: '',
  userId: 'u-user',
  customerName: '租车客户',
  startAt: '',
  endAt: '',
  amount: 0,
  deposit: 3000,
  status: '待审核' as RentalOrder['status']
});

const taskForm = reactive({
  id: '',
  taskNo: '',
  vehicleId: '',
  driverId: '',
  routeName: '机场高峰保障',
  startPoint: '网约车预备库',
  endPoint: '运营区域',
  scheduledAt: '',
  status: '待接收' as DispatchTask['status'],
  remark: ''
});

const driverForm = reactive({
  id: '',
  name: '',
  phone: '',
  licenseNo: '',
  status: '空闲' as Driver['status']
});

const searchText = computed(() => keyword.value.trim());
const canCreateReport = computed(() => can(auth.currentUser, 'report:create'));
const canUpdateReport = computed(() => can(auth.currentUser, 'report:update'));
const canDeleteReport = computed(() => can(auth.currentUser, 'report:delete'));
const canMutateReport = computed(() => canUpdateReport.value || canDeleteReport.value);
const canCreateInventory = computed(() => can(auth.currentUser, 'inventory:create'));
const canUpdateInventory = computed(() => can(auth.currentUser, 'inventory:update'));
const canDeleteInventory = computed(() => can(auth.currentUser, 'inventory:delete'));
const canMutateInventory = computed(() => canUpdateInventory.value || canDeleteInventory.value);
const canCreateRental = computed(() => can(auth.currentUser, 'rental:create'));
const canUpdateRental = computed(() => can(auth.currentUser, 'rental:update'));
const canDeleteRental = computed(() => can(auth.currentUser, 'rental:delete'));
const canMutateRental = computed(() => canUpdateRental.value || canDeleteRental.value);
const canCreateDispatch = computed(() => can(auth.currentUser, 'dispatch:create'));
const canUpdateDispatch = computed(() => can(auth.currentUser, 'dispatch:update'));
const canDeleteDispatch = computed(() => can(auth.currentUser, 'dispatch:delete'));
const canMutateDispatch = computed(() => canUpdateDispatch.value || canDeleteDispatch.value);
const canCreateDriver = computed(() => can(auth.currentUser, 'driver:create'));
const canUpdateDriver = computed(() => can(auth.currentUser, 'driver:update'));
const canDeleteDriver = computed(() => can(auth.currentUser, 'driver:delete'));
const canMutateDriver = computed(() => canUpdateDriver.value || canDeleteDriver.value);
const reports = computed(() =>
  fleet.data.reports.filter((item) => {
    const vehicleName = fleet.vehicleName(item.vehicleId);
    const matchedKeyword = `${item.reportNo}${vehicleName}${item.clientName}${item.clientPhone}${item.grade}`.includes(searchText.value);
    const matchedGrade = !reportGrade.value || item.grade === reportGrade.value;
    const matchedPurpose = !reportPurpose.value || item.purpose === reportPurpose.value;
    return matchedKeyword && matchedGrade && matchedPurpose;
  })
);
const inventoryRecords = computed(() =>
  fleet.data.inventoryRecords.filter((item) => {
    const matchedKeyword = `${fleet.vehicleName(item.vehicleId)}${item.type}${item.source}${item.warehouse}${item.operator}`.includes(searchText.value);
    const matchedType = !inventoryType.value || item.type === inventoryType.value;
    const matchedSource = !inventorySource.value || item.source === inventorySource.value;
    return matchedKeyword && matchedType && matchedSource;
  })
);
const rentalOrders = computed(() =>
  fleet.data.rentalOrders.filter((item) => {
    const matchedKeyword = `${item.orderNo}${fleet.vehicleName(item.vehicleId)}${item.customerName}${item.status}`.includes(searchText.value);
    const matchedStatus = !rentalStatus.value || item.status === rentalStatus.value;
    return matchedKeyword && matchedStatus;
  })
);
const dispatchTasks = computed(() =>
  fleet.data.dispatchTasks.filter((item) => {
    const matchedKeyword = `${item.taskNo}${item.routeName}${fleet.vehicleName(item.vehicleId)}${fleet.driverName(item.driverId)}${item.status}`.includes(searchText.value);
    const matchedStatus = !dispatchStatus.value || item.status === dispatchStatus.value;
    return matchedKeyword && matchedStatus;
  })
);
const drivers = computed(() =>
  fleet.data.drivers.filter((item) => {
    const matchedKeyword = `${item.name}${item.phone}${item.licenseNo}${item.status}`.includes(searchText.value);
    const matchedStatus = !driverStatus.value || item.status === driverStatus.value;
    return matchedKeyword && matchedStatus;
  })
);
const report = computed(() => reports.value.find((item) => item.id === selectedId.value) ?? reports.value[0]);
const vehicle = computed(() => fleet.data.vehicles.find((item) => item.id === report.value?.vehicleId));
const validTabs: DataTab[] = ['reports', 'inventory', 'rentals', 'dispatch', 'drivers'];

watch(reports, () => {
  if (!reports.value.some((item) => item.id === selectedId.value)) selectedId.value = reports.value[0]?.id ?? '';
});

watch(
  () => route.query.tab,
  (tab) => {
    const nextTab = String(tab || 'reports') as DataTab;
    if (validTabs.includes(nextTab)) activeTab.value = nextTab;
  },
  { immediate: true }
);

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) router.replace({ path: '/admin/reports', query: { ...route.query, tab } });
});

function download() {
  if (!report.value || !vehicle.value) {
    ElMessage.warning('请选择报告');
    return;
  }
  downloadReportDoc(report.value, vehicle.value);
}

function selectReport(row?: InspectionReport) {
  if (row) selectedId.value = row.id;
}

function setActiveTab(tab: DataTab) {
  activeTab.value = tab;
}

function openPreviewReport(row: InspectionReport) {
  selectedId.value = row.id;
  previewDialogVisible.value = true;
}

async function printReport() {
  if (!report.value || !vehicle.value) {
    ElMessage.warning('请选择报告');
    return;
  }
  await nextTick();
  const source = printSourceRef.value?.querySelector('.report-paper');
  if (!source) {
    ElMessage.warning('报告内容未加载完成');
    return;
  }

  document.querySelector('.report-print-root')?.remove();
  const printRoot = document.createElement('div');
  printRoot.className = 'report-print-root';
  printRoot.appendChild(source.cloneNode(true));
  document.body.appendChild(printRoot);
  document.body.classList.add('is-report-printing');

  const cleanup = () => {
    document.body.classList.remove('is-report-printing');
    printRoot.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  requestAnimationFrame(() => window.print());
}

function openEditReport(row: InspectionReport) {
  Object.assign(reportForm, {
    id: row.id,
    reportNo: row.reportNo,
    vehicleId: row.vehicleId,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    purpose: row.purpose,
    inspectorName: row.inspectorName,
    inspectorNo: row.inspectorNo,
    location: row.location,
    checkedAt: row.checkedAt,
    grade: row.grade,
    abnormalSummary: row.abnormalSummary,
    suggestion: row.suggestion,
    floodVerdict: row.floodVerdict,
    fireVerdict: row.fireVerdict,
    crashVerdict: row.crashVerdict,
    items: row.items.map((item) => ({ ...item })),
    createdAt: row.createdAt
  });
  reportDialogVisible.value = true;
}

function saveReport() {
  if (!reportForm.clientName || !reportForm.clientPhone) {
    ElMessage.warning('请填写客户姓名和手机号');
    return;
  }
  try {
    fleet.updateReport({ ...reportForm });
    selectedId.value = reportForm.id;
    reportDialogVisible.value = false;
    ElMessage.success('报告已更新');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeReport(row: InspectionReport) {
  await ElMessageBox.confirm(`确定删除报告 ${row.reportNo} 吗？`, '删除报告', { type: 'warning' });
  fleet.deleteReport(row.id);
  selectedId.value = fleet.data.reports[0]?.id ?? '';
  ElMessage.success('报告已删除');
}

function resetInventoryForm() {
  Object.assign(inventoryForm, {
    id: '',
    recordNo: '',
    vehicleId: '',
    type: '入库',
    source: '手动入库',
    warehouse: '默认网约车预备库',
    parkingSpace: 'P-001',
    operator: '管理员',
    mileage: 0,
    energyLevel: 80,
    remark: '',
    createdAt: ''
  });
}

function openCreateInventory() {
  resetInventoryForm();
  inventoryDialogVisible.value = true;
}

function openEditInventory(row: InventoryRecord) {
  Object.assign(inventoryForm, row);
  inventoryDialogVisible.value = true;
}

function saveInventory() {
  if (!inventoryForm.vehicleId || !inventoryForm.warehouse || !inventoryForm.operator) {
    ElMessage.warning('请填写车辆、仓库和操作人');
    return;
  }
  try {
    fleet.upsertInventoryRecord({ ...inventoryForm, id: inventoryForm.id || undefined, createdAt: inventoryForm.createdAt || undefined });
    inventoryDialogVisible.value = false;
    ElMessage.success(inventoryForm.id ? '入库流水已更新' : '入库流水已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeInventory(row: InventoryRecord) {
  await ElMessageBox.confirm(`确定删除这条 ${row.type} 流水吗？`, '删除流水', { type: 'warning' });
  fleet.deleteInventoryRecord(row.id);
  ElMessage.success('流水已删除');
}

function resetRentalForm() {
  Object.assign(rentalForm, {
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

function openCreateRental() {
  resetRentalForm();
  rentalDialogVisible.value = true;
}

function openEditRental(row: RentalOrder) {
  Object.assign(rentalForm, row);
  rentalDialogVisible.value = true;
}

function fillRentalPrice() {
  const item = fleet.data.vehicles.find((vehicleItem) => vehicleItem.id === rentalForm.vehicleId);
  if (!item) return;
  rentalForm.amount = item.dailyPrice ?? rentalForm.amount;
  rentalForm.deposit = item.deposit ?? rentalForm.deposit;
}

function saveRental() {
  if (!rentalForm.vehicleId || !rentalForm.customerName) {
    ElMessage.warning('请选择车辆并填写客户');
    return;
  }
  try {
    fleet.upsertRentalOrder({ ...rentalForm, id: rentalForm.id || undefined, orderNo: rentalForm.orderNo || undefined });
    rentalDialogVisible.value = false;
    ElMessage.success(rentalForm.id ? '租赁订单已更新' : '租赁订单已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeRental(row: RentalOrder) {
  await ElMessageBox.confirm(`确定删除订单 ${row.orderNo} 吗？`, '删除订单', { type: 'warning' });
  fleet.deleteRentalOrder(row.id);
  ElMessage.success('订单已删除');
}

function resetTaskForm() {
  Object.assign(taskForm, {
    id: '',
    taskNo: '',
    vehicleId: '',
    driverId: '',
    routeName: '机场高峰保障',
    startPoint: '网约车预备库',
    endPoint: '运营区域',
    scheduledAt: formatBeijingDateTime(),
    status: '待接收',
    remark: ''
  });
}

function openCreateTask() {
  resetTaskForm();
  taskDialogVisible.value = true;
}

function openEditTask(row: DispatchTask) {
  Object.assign(taskForm, row);
  taskDialogVisible.value = true;
}

function saveTask() {
  if (!taskForm.vehicleId || !taskForm.driverId || !taskForm.routeName) {
    ElMessage.warning('请选择车辆、司机并填写线路');
    return;
  }
  try {
    fleet.upsertDispatchTask({ ...taskForm, id: taskForm.id || undefined, taskNo: taskForm.taskNo || undefined });
    taskDialogVisible.value = false;
    ElMessage.success(taskForm.id ? '调度任务已更新' : '调度任务已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeTask(row: DispatchTask) {
  await ElMessageBox.confirm(`确定删除调度任务 ${row.taskNo} 吗？`, '删除任务', { type: 'warning' });
  fleet.deleteDispatchTask(row.id);
  ElMessage.success('调度任务已删除');
}

function resetDriverForm() {
  Object.assign(driverForm, { id: '', name: '', phone: '', licenseNo: '', status: '空闲' });
}

function openCreateDriver() {
  resetDriverForm();
  driverDialogVisible.value = true;
}

function openEditDriver(row: Driver) {
  Object.assign(driverForm, row);
  driverDialogVisible.value = true;
}

function saveDriver() {
  if (!driverForm.name || !driverForm.phone || !driverForm.licenseNo) {
    ElMessage.warning('请填写司机姓名、手机号和驾驶证号');
    return;
  }
  try {
    fleet.upsertDriver({ ...driverForm, id: driverForm.id || undefined });
    driverDialogVisible.value = false;
    ElMessage.success(driverForm.id ? '司机已更新' : '司机已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeDriver(row: Driver) {
  await ElMessageBox.confirm(`确定删除司机 ${row.name} 吗？关联调度任务也会删除。`, '删除司机', { type: 'warning' });
  fleet.deleteDriver(row.id);
  ElMessage.success('司机已删除');
}
</script>

<template>
  <PageHeader title="数据中心" subtitle="统一管理检测报告、入库流水、租赁订单和调度运营数据" />

  <section class="panel data-center-shell">
    <nav class="data-center-subnav" aria-label="数据中心二级导航">
      <button type="button" :class="{ active: activeTab === 'reports' }" @click="setActiveTab('reports')">
        <span>检测报告</span>
        <strong>{{ reports.length }}</strong>
      </button>
      <button type="button" :class="{ active: activeTab === 'inventory' }" @click="setActiveTab('inventory')">
        <span>入库流水</span>
        <strong>{{ inventoryRecords.length }}</strong>
      </button>
      <button type="button" :class="{ active: activeTab === 'rentals' }" @click="setActiveTab('rentals')">
        <span>租赁订单</span>
        <strong>{{ rentalOrders.length }}</strong>
      </button>
      <button type="button" :class="{ active: activeTab === 'dispatch' }" @click="setActiveTab('dispatch')">
        <span>调度任务</span>
        <strong>{{ dispatchTasks.length }}</strong>
      </button>
      <button type="button" :class="{ active: activeTab === 'drivers' }" @click="setActiveTab('drivers')">
        <span>司机池</span>
        <strong>{{ drivers.length }}</strong>
      </button>
    </nav>

    <div class="data-center-content">
    <section v-show="activeTab === 'reports'">
      <div class="data-table-card-head">
        <div>
          <h2>检测报告</h2>
          <p>管理检测报告、评级结果和报告导出。</p>
        </div>
        <span>共 {{ reports.length }} 条</span>
      </div>
      <div class="data-center-toolbar">
        <div class="table-filter-bar">
          <el-input v-model="keyword" placeholder="报告 / 车辆 / 客户" clearable />
          <el-select v-model="reportGrade" clearable placeholder="评级">
            <el-option label="S 级" value="S" />
            <el-option label="A 级" value="A" />
            <el-option label="B 级" value="B" />
            <el-option label="C 级" value="C" />
            <el-option label="D 级" value="D" />
          </el-select>
          <el-select v-model="reportPurpose" clearable placeholder="检测目的">
            <el-option label="购前检测" value="购前检测" />
            <el-option label="置换评估" value="置换评估" />
            <el-option label="入库检测" value="入库检测" />
            <el-option label="车辆专业检测" value="车辆专业检测" />
            <el-option label="还车检测" value="还车检测" />
          </el-select>
        </div>
        <div class="table-action-bar">
          <el-button v-if="canCreateReport" type="primary" @click="router.push('/admin/inspection')">
            <el-icon><Plus /></el-icon>
            新建检测
          </el-button>
        </div>
      </div>
      <div class="table-shell desktop-table">
        <el-table :data="reports" highlight-current-row size="large" class="compact-data-table no-wrap-table" @current-change="selectReport">
          <el-table-column prop="reportNo" label="报告编号" min-width="160" show-overflow-tooltip />
          <el-table-column label="车辆" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
          </el-table-column>
          <el-table-column prop="clientName" label="客户" width="100" show-overflow-tooltip />
          <el-table-column label="评级" width="90">
            <template #default="{ row }"><GradeTag :grade="row.grade" /></template>
          </el-table-column>
          <el-table-column prop="purpose" label="检测目的" width="120" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="生成时间" min-width="150" show-overflow-tooltip />
          <el-table-column label="操作" :width="canMutateReport ? 210 : 90" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openPreviewReport(row)">预览</el-button>
              <el-button v-if="canUpdateReport" size="small" @click="openEditReport(row)">编辑</el-button>
              <el-button v-if="canDeleteReport" size="small" type="danger" @click="removeReport(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="row in reports" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ row.reportNo }}</div>
            <GradeTag :grade="row.grade" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车辆</span><strong>{{ fleet.vehicleName(row.vehicleId) }}</strong></div>
            <div><span>客户</span><strong>{{ row.clientName }}</strong></div>
            <div><span>检测目的</span><strong>{{ row.purpose }}</strong></div>
            <div><span>生成时间</span><strong>{{ row.createdAt }}</strong></div>
          </div>
          <div class="mobile-record-actions">
            <el-button @click="openPreviewReport(row)">预览</el-button>
            <el-button v-if="canUpdateReport" @click="openEditReport(row)">编辑</el-button>
            <el-button v-if="canDeleteReport" type="danger" @click="removeReport(row)">删除</el-button>
          </div>
        </article>
      </div>
    </section>

    <section v-show="activeTab === 'inventory'">
      <div class="data-table-card-head">
        <div>
          <h2>入库流水</h2>
          <p>车辆入库、出库和调拨记录统一追踪。</p>
        </div>
        <span>共 {{ inventoryRecords.length }} 条</span>
      </div>
      <div class="data-center-toolbar">
        <div class="table-filter-bar">
          <el-input v-model="keyword" placeholder="车辆 / 仓库 / 操作人" clearable />
          <el-select v-model="inventoryType" clearable placeholder="类型">
            <el-option label="入库" value="入库" />
            <el-option label="出库" value="出库" />
            <el-option label="调拨" value="调拨" />
          </el-select>
          <el-select v-model="inventorySource" clearable placeholder="来源">
            <el-option label="检测入库" value="检测入库" />
            <el-option label="手动入库" value="手动入库" />
            <el-option label="租赁出库" value="租赁出库" />
            <el-option label="调度出库" value="调度出库" />
            <el-option label="还车入库" value="还车入库" />
          </el-select>
        </div>
        <div class="table-action-bar">
          <el-button v-if="canCreateInventory" type="primary" @click="openCreateInventory"><el-icon><Plus /></el-icon>新增流水</el-button>
        </div>
      </div>
      <div class="table-shell desktop-table">
        <el-table :data="inventoryRecords" size="large" class="compact-data-table no-wrap-table">
          <el-table-column prop="recordNo" label="流水号" min-width="150" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="时间" min-width="150" show-overflow-tooltip />
          <el-table-column label="车辆" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="82" show-overflow-tooltip />
          <el-table-column prop="source" label="来源" width="112" show-overflow-tooltip />
          <el-table-column prop="warehouse" label="仓库" min-width="170" show-overflow-tooltip />
          <el-table-column prop="parkingSpace" label="车位" width="90" show-overflow-tooltip />
          <el-table-column prop="operator" label="操作人" width="100" show-overflow-tooltip />
          <el-table-column v-if="canMutateInventory" label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdateInventory" size="small" @click="openEditInventory(row)">编辑</el-button>
              <el-button v-if="canDeleteInventory" size="small" type="danger" @click="removeInventory(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="row in inventoryRecords" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ fleet.vehicleName(row.vehicleId) }}</div>
            <StatusTag :status="row.type" />
          </div>
          <div class="mobile-record-grid">
            <div><span>流水号</span><strong>{{ row.recordNo }}</strong></div>
            <div><span>来源</span><strong>{{ row.source }}</strong></div>
            <div><span>仓库车位</span><strong>{{ row.warehouse }} {{ row.parkingSpace }}</strong></div>
            <div><span>操作人</span><strong>{{ row.operator }}</strong></div>
            <div><span>时间</span><strong>{{ row.createdAt }}</strong></div>
          </div>
          <div v-if="canMutateInventory" class="mobile-record-actions">
            <el-button v-if="canUpdateInventory" @click="openEditInventory(row)">编辑</el-button>
            <el-button v-if="canDeleteInventory" type="danger" @click="removeInventory(row)">删除</el-button>
          </div>
        </article>
      </div>
    </section>

    <section v-show="activeTab === 'rentals'">
      <div class="data-table-card-head">
        <div>
          <h2>租赁订单</h2>
          <p>维护订单金额、押金、车辆占用和流转状态。</p>
        </div>
        <span>共 {{ rentalOrders.length }} 条</span>
      </div>
      <div class="data-center-toolbar">
        <div class="table-filter-bar">
          <el-input v-model="keyword" placeholder="订单 / 车辆 / 客户" clearable />
          <el-select v-model="rentalStatus" clearable placeholder="状态">
            <el-option label="待审核" value="待审核" />
            <el-option label="待取车" value="待取车" />
            <el-option label="租赁中" value="租赁中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </div>
        <div class="table-action-bar">
          <el-button v-if="canCreateRental" type="primary" @click="openCreateRental"><el-icon><Plus /></el-icon>新增订单</el-button>
        </div>
      </div>
      <div class="table-shell desktop-table">
        <el-table :data="rentalOrders" size="large" class="compact-data-table no-wrap-table">
          <el-table-column prop="orderNo" label="订单号" min-width="150" show-overflow-tooltip />
          <el-table-column label="车辆" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" width="110" show-overflow-tooltip />
          <el-table-column prop="amount" label="租金" width="90" />
          <el-table-column prop="deposit" label="押金" width="90" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column prop="startAt" label="开始时间" min-width="150" show-overflow-tooltip />
          <el-table-column v-if="canMutateRental" label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdateRental" size="small" @click="openEditRental(row)">编辑</el-button>
              <el-button v-if="canDeleteRental" size="small" type="danger" @click="removeRental(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="row in rentalOrders" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ row.orderNo }}</div>
            <StatusTag :status="row.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>车辆</span><strong>{{ fleet.vehicleName(row.vehicleId) }}</strong></div>
            <div><span>客户</span><strong>{{ row.customerName }}</strong></div>
            <div><span>租金/押金</span><strong>{{ row.amount }} / {{ row.deposit }} 元</strong></div>
            <div><span>起止时间</span><strong>{{ row.startAt }} 至 {{ row.endAt }}</strong></div>
          </div>
          <div v-if="canMutateRental" class="mobile-record-actions">
            <el-button v-if="canUpdateRental" @click="openEditRental(row)">编辑</el-button>
            <el-button v-if="canDeleteRental" type="danger" @click="removeRental(row)">删除</el-button>
          </div>
        </article>
      </div>
    </section>

    <section v-show="activeTab === 'dispatch'">
      <div class="data-table-card-head">
        <div>
          <h2>调度任务</h2>
          <p>管理网约车任务、线路、车辆和司机执行状态。</p>
        </div>
        <span>共 {{ dispatchTasks.length }} 条</span>
      </div>
      <div class="data-center-toolbar">
        <div class="table-filter-bar">
          <el-input v-model="keyword" placeholder="任务 / 线路 / 司机" clearable />
          <el-select v-model="dispatchStatus" clearable placeholder="状态">
            <el-option label="待接收" value="待接收" />
            <el-option label="执行中" value="执行中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </div>
        <div class="table-action-bar">
          <el-button v-if="canCreateDispatch" type="primary" @click="openCreateTask"><el-icon><Plus /></el-icon>新增任务</el-button>
        </div>
      </div>
      <div class="table-shell desktop-table">
        <el-table :data="dispatchTasks" size="large" class="compact-data-table no-wrap-table">
          <el-table-column prop="taskNo" label="任务号" min-width="150" show-overflow-tooltip />
          <el-table-column prop="routeName" label="线路" min-width="160" show-overflow-tooltip />
          <el-table-column label="车辆" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
          </el-table-column>
          <el-table-column label="司机" width="110">
            <template #default="{ row }">{{ fleet.driverName(row.driverId) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column v-if="canMutateDispatch" label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdateDispatch" size="small" @click="openEditTask(row)">编辑</el-button>
              <el-button v-if="canDeleteDispatch" size="small" type="danger" @click="removeTask(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="row in dispatchTasks" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ row.taskNo }}</div>
            <StatusTag :status="row.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>线路</span><strong>{{ row.routeName }}</strong></div>
            <div><span>车辆</span><strong>{{ fleet.vehicleName(row.vehicleId) }}</strong></div>
            <div><span>司机</span><strong>{{ fleet.driverName(row.driverId) }}</strong></div>
          </div>
          <div v-if="canMutateDispatch" class="mobile-record-actions">
            <el-button v-if="canUpdateDispatch" @click="openEditTask(row)">编辑</el-button>
            <el-button v-if="canDeleteDispatch" type="danger" @click="removeTask(row)">删除</el-button>
          </div>
        </article>
      </div>
    </section>

    <section v-show="activeTab === 'drivers'">
      <div class="data-table-card-head">
        <div>
          <h2>司机池</h2>
          <p>维护司机基础资料、驾驶证号和出车状态。</p>
        </div>
        <span>共 {{ drivers.length }} 条</span>
      </div>
      <div class="data-center-toolbar">
        <div class="table-filter-bar">
          <el-input v-model="keyword" placeholder="司机 / 手机号 / 驾驶证号" clearable />
          <el-select v-model="driverStatus" clearable placeholder="状态">
            <el-option label="空闲" value="空闲" />
            <el-option label="出车中" value="出车中" />
            <el-option label="休息" value="休息" />
            <el-option label="停用" value="停用" />
          </el-select>
        </div>
        <div class="table-action-bar">
          <el-button v-if="canCreateDriver" type="primary" @click="openCreateDriver"><el-icon><Plus /></el-icon>新增司机</el-button>
        </div>
      </div>
      <div class="table-shell desktop-table">
        <el-table :data="drivers" size="large" class="compact-data-table no-wrap-table">
          <el-table-column prop="name" label="司机" width="110" show-overflow-tooltip />
          <el-table-column prop="phone" label="手机号" min-width="130" show-overflow-tooltip />
          <el-table-column prop="licenseNo" label="驾驶证号" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column v-if="canMutateDriver" label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdateDriver" size="small" @click="openEditDriver(row)">编辑</el-button>
              <el-button v-if="canDeleteDriver" size="small" type="danger" @click="removeDriver(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list admin-mobile-list">
        <article v-for="row in drivers" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-head">
            <div class="mobile-record-title">{{ row.name }}</div>
            <StatusTag :status="row.status" />
          </div>
          <div class="mobile-record-grid">
            <div><span>手机号</span><strong>{{ row.phone }}</strong></div>
            <div><span>驾驶证号</span><strong>{{ row.licenseNo }}</strong></div>
          </div>
          <div v-if="canMutateDriver" class="mobile-record-actions">
            <el-button v-if="canUpdateDriver" @click="openEditDriver(row)">编辑</el-button>
            <el-button v-if="canDeleteDriver" type="danger" @click="removeDriver(row)">删除</el-button>
          </div>
        </article>
      </div>
    </section>
    </div>
  </section>

  <el-dialog v-model="previewDialogVisible" title="检测报告预览" width="980px" class="report-dialog report-preview-dialog">
    <div v-if="report && vehicle" ref="printSourceRef">
      <ReportPreview :report="report" :vehicle="vehicle" show-normal-sections />
    </div>
    <el-empty v-else description="暂无报告" />
    <template #footer>
      <el-button @click="printReport">打印</el-button>
      <el-button type="primary" @click="download">导出 Word 报告</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="reportDialogVisible" title="编辑检测报告" width="760px">
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="报告编号"><el-input v-model="reportForm.reportNo" disabled /></el-form-item>
        <el-form-item label="车辆">
          <el-select v-model="reportForm.vehicleId" filterable>
            <el-option v-for="item in fleet.data.vehicles" :key="item.id" :label="`${item.plateNo} ${item.brandModel}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="评级"><el-segmented v-model="reportForm.grade" :options="['S','A','B','C','D']" /></el-form-item>
        <el-form-item label="客户姓名"><el-input v-model="reportForm.clientName" /></el-form-item>
        <el-form-item label="客户手机号"><el-input v-model="reportForm.clientPhone" /></el-form-item>
        <el-form-item label="检测目的"><el-input v-model="reportForm.purpose" /></el-form-item>
        <el-form-item label="评估师"><el-input v-model="reportForm.inspectorName" /></el-form-item>
        <el-form-item label="工号"><el-input v-model="reportForm.inspectorNo" /></el-form-item>
        <el-form-item label="检测时间"><el-input v-model="reportForm.checkedAt" /></el-form-item>
        <el-form-item label="水泡判定">
          <el-select v-model="reportForm.floodVerdict">
            <el-option label="正常" value="正常" />
            <el-option label="疑似水泡" value="疑似水泡" />
            <el-option label="确认水泡" value="确认水泡" />
          </el-select>
        </el-form-item>
        <el-form-item label="火烧判定">
          <el-select v-model="reportForm.fireVerdict">
            <el-option label="正常" value="正常" />
            <el-option label="疑似火烧" value="疑似火烧" />
            <el-option label="确认火烧" value="确认火烧" />
          </el-select>
        </el-form-item>
        <el-form-item label="事故判定">
          <el-select v-model="reportForm.crashVerdict">
            <el-option label="正常" value="正常" />
            <el-option label="确认事故车" value="确认事故车" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="检测地点"><el-input v-model="reportForm.location" /></el-form-item>
      <el-form-item label="异常项汇总"><el-input v-model="reportForm.abnormalSummary" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="维修评估建议"><el-input v-model="reportForm.suggestion" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="reportDialogVisible = false">取消</el-button>
      <el-button v-if="canUpdateReport" type="primary" @click="saveReport">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="inventoryDialogVisible" :title="inventoryForm.id ? '编辑库存流水' : '新增库存流水'" width="720px">
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="车辆">
          <el-select v-model="inventoryForm.vehicleId" filterable>
            <el-option v-for="item in fleet.data.vehicles" :key="item.id" :label="`${item.plateNo} ${item.brandModel}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="流水号"><el-input v-model="inventoryForm.recordNo" placeholder="系统自动生成" disabled /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="inventoryForm.type">
            <el-option label="入库" value="入库" />
            <el-option label="出库" value="出库" />
            <el-option label="调拨" value="调拨" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="inventoryForm.source">
            <el-option label="检测入库" value="检测入库" />
            <el-option label="手动入库" value="手动入库" />
            <el-option label="租赁出库" value="租赁出库" />
            <el-option label="调度出库" value="调度出库" />
            <el-option label="还车入库" value="还车入库" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库"><el-input v-model="inventoryForm.warehouse" /></el-form-item>
        <el-form-item label="车位"><el-input v-model="inventoryForm.parkingSpace" /></el-form-item>
        <el-form-item label="操作人"><el-input v-model="inventoryForm.operator" /></el-form-item>
        <el-form-item label="里程"><el-input-number v-model="inventoryForm.mileage" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="油量/电量"><el-input-number v-model="inventoryForm.energyLevel" :min="0" :max="100" style="width: 100%" /></el-form-item>
        <el-form-item label="时间"><el-input v-model="inventoryForm.createdAt" placeholder="留空自动生成" /></el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="inventoryForm.remark" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="inventoryDialogVisible = false">取消</el-button>
      <el-button v-if="inventoryForm.id ? canUpdateInventory : canCreateInventory" type="primary" @click="saveInventory">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="rentalDialogVisible" :title="rentalForm.id ? '编辑租赁订单' : '新增租赁订单'" width="720px">
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="订单号"><el-input v-model="rentalForm.orderNo" placeholder="留空自动生成" :disabled="!!rentalForm.id" /></el-form-item>
        <el-form-item label="车辆">
          <el-select v-model="rentalForm.vehicleId" filterable @change="fillRentalPrice">
            <el-option v-for="item in fleet.data.vehicles" :key="item.id" :label="`${item.plateNo} ${item.brandModel}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户"><el-input v-model="rentalForm.customerName" /></el-form-item>
        <el-form-item label="开始时间"><el-input v-model="rentalForm.startAt" /></el-form-item>
        <el-form-item label="结束时间"><el-input v-model="rentalForm.endAt" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="rentalForm.status">
            <el-option label="待审核" value="待审核" />
            <el-option label="待取车" value="待取车" />
            <el-option label="租赁中" value="租赁中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </el-form-item>
        <el-form-item label="租金"><el-input-number v-model="rentalForm.amount" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="押金"><el-input-number v-model="rentalForm.deposit" :min="0" style="width: 100%" /></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="rentalDialogVisible = false">取消</el-button>
      <el-button v-if="rentalForm.id ? canUpdateRental : canCreateRental" type="primary" @click="saveRental">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="taskDialogVisible" :title="taskForm.id ? '编辑调度任务' : '新增调度任务'" width="760px">
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="任务号"><el-input v-model="taskForm.taskNo" placeholder="留空自动生成" :disabled="!!taskForm.id" /></el-form-item>
        <el-form-item label="车辆">
          <el-select v-model="taskForm.vehicleId" filterable>
            <el-option v-for="item in fleet.data.vehicles" :key="item.id" :label="`${item.plateNo} ${item.brandModel}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="司机">
          <el-select v-model="taskForm.driverId" filterable>
            <el-option v-for="item in fleet.data.drivers" :key="item.id" :label="`${item.name} ${item.phone}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="线路名称"><el-input v-model="taskForm.routeName" /></el-form-item>
        <el-form-item label="起点"><el-input v-model="taskForm.startPoint" /></el-form-item>
        <el-form-item label="终点"><el-input v-model="taskForm.endPoint" /></el-form-item>
        <el-form-item label="计划时间"><el-input v-model="taskForm.scheduledAt" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="taskForm.status">
            <el-option label="待接收" value="待接收" />
            <el-option label="执行中" value="执行中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="taskForm.remark" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="taskDialogVisible = false">取消</el-button>
      <el-button v-if="taskForm.id ? canUpdateDispatch : canCreateDispatch" type="primary" @click="saveTask">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="driverDialogVisible" :title="driverForm.id ? '编辑司机' : '新增司机'" width="620px">
    <el-form label-position="top">
      <div class="grid-2">
        <el-form-item label="司机姓名"><el-input v-model="driverForm.name" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="driverForm.phone" /></el-form-item>
        <el-form-item label="驾驶证号"><el-input v-model="driverForm.licenseNo" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="driverForm.status">
            <el-option label="空闲" value="空闲" />
            <el-option label="出车中" value="出车中" />
            <el-option label="休息" value="休息" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="driverDialogVisible = false">取消</el-button>
      <el-button v-if="driverForm.id ? canUpdateDriver : canCreateDriver" type="primary" @click="saveDriver">保存</el-button>
    </template>
  </el-dialog>
</template>
