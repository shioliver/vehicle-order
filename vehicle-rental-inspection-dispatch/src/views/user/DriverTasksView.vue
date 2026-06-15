<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { getErrorMessage } from '@/utils/errors';
import type { DispatchTask } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();

const currentDriver = computed(() => fleet.data.drivers.find((driver) => driver.userId === auth.currentUser?.id));
const driverTasks = computed(() => fleet.data.dispatchTasks.filter((task) => task.driverId === currentDriver.value?.id));
const canUpdateDispatch = computed(() => can(auth.currentUser, 'dispatch:update'));

function updateTaskStatus(task: DispatchTask, status: DispatchTask['status']) {
  try {
    fleet.upsertDispatchTask({ ...task, status });
    ElMessage.success(status === '执行中' ? '任务已接收' : '任务已完成，车辆和司机已释放');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}
</script>

<template>
  <PageHeader title="司机调度任务" subtitle="司机可查看绑定车辆、路线和任务状态" />

  <section class="panel">
    <div class="table-shell desktop-table">
      <el-table :data="driverTasks" size="large">
        <template #empty>
          <el-empty description="暂无调度任务" />
        </template>
        <el-table-column prop="taskNo" label="任务号" min-width="150" />
        <el-table-column prop="routeName" label="线路" min-width="160" />
        <el-table-column label="车辆" min-width="190">
          <template #default="{ row }">{{ fleet.vehicleName(row.vehicleId) }}</template>
        </el-table-column>
        <el-table-column label="司机" width="110">
          <template #default="{ row }">{{ fleet.driverName(row.driverId) }}</template>
        </el-table-column>
        <el-table-column prop="startPoint" label="起点" min-width="150" />
        <el-table-column prop="endPoint" label="终点" min-width="150" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><StatusTag :status="row.status" /></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button v-if="canUpdateDispatch && row.status === '待接收'" size="small" type="primary" @click="updateTaskStatus(row, '执行中')">接收</el-button>
            <el-button v-if="canUpdateDispatch && row.status === '执行中'" size="small" type="success" @click="updateTaskStatus(row, '已完成')">完成</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="mobile-card-list admin-mobile-list">
      <article v-for="task in driverTasks" :key="task.id" class="mobile-record-card">
        <div class="mobile-record-head">
          <div class="mobile-record-title">{{ task.taskNo }}</div>
          <StatusTag :status="task.status" />
        </div>
        <div class="mobile-record-grid">
          <div><span>线路</span><strong>{{ task.routeName }}</strong></div>
          <div><span>车辆</span><strong>{{ fleet.vehicleName(task.vehicleId) }}</strong></div>
          <div><span>司机</span><strong>{{ fleet.driverName(task.driverId) }}</strong></div>
          <div><span>起终点</span><strong>{{ task.startPoint }} 至 {{ task.endPoint }}</strong></div>
        </div>
        <div class="mobile-record-actions">
          <el-button v-if="canUpdateDispatch && task.status === '待接收'" type="primary" @click="updateTaskStatus(task, '执行中')">接收</el-button>
          <el-button v-if="canUpdateDispatch && task.status === '执行中'" type="success" @click="updateTaskStatus(task, '已完成')">完成</el-button>
        </div>
      </article>
      <el-empty v-if="driverTasks.length === 0" description="暂无调度任务" />
    </div>
  </section>
</template>
