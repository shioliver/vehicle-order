<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { formatBeijingDateTime } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import type { DispatchTask, Driver } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const taskKeyword = ref('');
const driverKeyword = ref('');
const taskDialogVisible = ref(false);
const driverDialogVisible = ref(false);
const taskPage = ref(1);
const driverPage = ref(1);
const pageSize = 5;
const form = reactive({
  vehicleId: '',
  driverId: '',
  routeName: '机场高峰保障'
});
const taskForm = reactive({
  id: '',
  taskNo: '',
  vehicleId: '',
  driverId: '',
  routeName: '',
  startPoint: '',
  endPoint: '',
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

const readyVehicles = computed(() => fleet.data.vehicles.filter((item) => item.status === '预备库'));
const freeDrivers = computed(() => fleet.data.drivers.filter((item) => item.status === '空闲'));
const canCreateDispatch = computed(() => can(auth.currentUser, 'dispatch:create'));
const canUpdateDispatch = computed(() => can(auth.currentUser, 'dispatch:update'));
const canCreateDriver = computed(() => can(auth.currentUser, 'driver:create'));
const canUpdateDriver = computed(() => can(auth.currentUser, 'driver:update'));
const tasks = computed(() =>
  fleet.data.dispatchTasks.filter((item) => `${item.taskNo}${item.routeName}${fleet.vehicleName(item.vehicleId)}${fleet.driverName(item.driverId)}${item.status}`.includes(taskKeyword.value.trim()))
);
const drivers = computed(() => fleet.data.drivers.filter((item) => `${item.name}${item.phone}${item.licenseNo}${item.status}`.includes(driverKeyword.value.trim())));
const pagedTasks = computed(() => tasks.value.slice((taskPage.value - 1) * pageSize, taskPage.value * pageSize));
const pagedDrivers = computed(() => drivers.value.slice((driverPage.value - 1) * pageSize, driverPage.value * pageSize));

watch(taskKeyword, () => {
  taskPage.value = 1;
});

watch(driverKeyword, () => {
  driverPage.value = 1;
});

function dispatch() {
  if (!form.vehicleId || !form.driverId) {
    ElMessage.warning('请选择车辆和司机');
    return;
  }
  try {
    fleet.createDispatchTask(form.vehicleId, form.driverId, form.routeName);
    ElMessage.success('调度任务已创建，车辆从预备库进入调度中');
    form.vehicleId = '';
    form.driverId = '';
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
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

function openEditTask(task: DispatchTask) {
  Object.assign(taskForm, {
    id: task.id,
    taskNo: task.taskNo,
    vehicleId: task.vehicleId,
    driverId: task.driverId,
    routeName: task.routeName,
    startPoint: task.startPoint,
    endPoint: task.endPoint,
    scheduledAt: task.scheduledAt,
    status: task.status,
    remark: task.remark
  });
  taskDialogVisible.value = true;
}

function saveTask() {
  if (!taskForm.vehicleId || !taskForm.driverId || !taskForm.routeName) {
    ElMessage.warning('请选择车辆、司机并填写线路');
    return;
  }
  try {
    fleet.upsertDispatchTask({
      id: taskForm.id || undefined,
      taskNo: taskForm.taskNo || undefined,
      vehicleId: taskForm.vehicleId,
      driverId: taskForm.driverId,
      routeName: taskForm.routeName,
      startPoint: taskForm.startPoint,
      endPoint: taskForm.endPoint,
      scheduledAt: taskForm.scheduledAt,
      status: taskForm.status,
      remark: taskForm.remark
    });
    taskDialogVisible.value = false;
    ElMessage.success(taskForm.id ? '调度任务已更新' : '调度任务已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeTask(task: DispatchTask) {
  await ElMessageBox.confirm(`确定删除调度任务 ${task.taskNo} 吗？车辆和司机会释放回可用状态。`, '删除任务', { type: 'warning' });
  fleet.deleteDispatchTask(task.id);
  ElMessage.success('调度任务已删除');
}

function resetDriverForm() {
  Object.assign(driverForm, {
    id: '',
    name: '',
    phone: '',
    licenseNo: '',
    status: '空闲'
  });
}

function openCreateDriver() {
  resetDriverForm();
  driverDialogVisible.value = true;
}

function openEditDriver(driver: Driver) {
  Object.assign(driverForm, {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    licenseNo: driver.licenseNo,
    status: driver.status
  });
  driverDialogVisible.value = true;
}

function saveDriver() {
  if (!driverForm.name || !driverForm.phone || !driverForm.licenseNo) {
    ElMessage.warning('请填写司机姓名、手机号和驾驶证号');
    return;
  }
  try {
    fleet.upsertDriver({
      id: driverForm.id || undefined,
      name: driverForm.name,
      phone: driverForm.phone,
      licenseNo: driverForm.licenseNo,
      status: driverForm.status
    });
    driverDialogVisible.value = false;
    ElMessage.success(driverForm.id ? '司机已更新' : '司机已新增');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeDriver(driver: Driver) {
  await ElMessageBox.confirm(`确定删除司机 ${driver.name} 吗？关联调度任务也会删除。`, '删除司机', { type: 'warning' });
  fleet.deleteDriver(driver.id);
  ElMessage.success('司机已删除');
}
</script>

<template>
  <PageHeader title="网约车调度" subtitle="从预备库选车，绑定司机并生成调度任务">
    <el-button v-if="canCreateDriver" @click="openCreateDriver">
      <el-icon><Plus /></el-icon>
      新增司机
    </el-button>
    <el-button v-if="canCreateDispatch" type="primary" @click="openCreateTask">
      <el-icon><Plus /></el-icon>
      新增任务
    </el-button>
  </PageHeader>

  <section v-if="canCreateDispatch" class="panel">
    <h2 class="panel-title">创建调度任务</h2>
    <div class="grid-3">
      <el-select v-model="form.vehicleId" filterable placeholder="预备库车辆">
        <el-option v-for="vehicle in readyVehicles" :key="vehicle.id" :label="`${vehicle.plateNo} ${vehicle.brandModel}`" :value="vehicle.id" />
      </el-select>
      <el-select v-model="form.driverId" filterable placeholder="空闲司机">
        <el-option v-for="driver in freeDrivers" :key="driver.id" :label="`${driver.name} ${driver.phone}`" :value="driver.id" />
      </el-select>
      <el-input v-model="form.routeName" placeholder="调度线路" />
    </div>
    <div style="margin-top: 14px">
      <el-button v-if="canCreateDispatch" type="primary" @click="dispatch">派发任务</el-button>
    </div>
  </section>

  <section class="panel data-center-hint">
    <div>
      <h2 class="panel-title">调度数据已归档到数据中心</h2>
      <p>调度任务和司机池的查询、分页、编辑、删除统一在数据中心完成，当前页面专注派发任务。</p>
    </div>
    <router-link to="/admin/reports" class="hint-link">进入数据中心</router-link>
  </section>

  <el-dialog v-model="taskDialogVisible" :title="taskForm.id ? '编辑调度任务' : '新增调度任务'" width="760px">
    <el-form label-position="top">
      <div class="grid-3">
        <el-form-item label="任务号"><el-input v-model="taskForm.taskNo" placeholder="留空自动生成" :disabled="!!taskForm.id" /></el-form-item>
        <el-form-item label="车辆">
          <el-select v-model="taskForm.vehicleId" filterable>
            <el-option v-for="vehicle in fleet.data.vehicles" :key="vehicle.id" :label="`${vehicle.plateNo} ${vehicle.brandModel}`" :value="vehicle.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="司机">
          <el-select v-model="taskForm.driverId" filterable>
            <el-option v-for="driver in fleet.data.drivers" :key="driver.id" :label="`${driver.name} ${driver.phone}`" :value="driver.id" />
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
