<script setup lang="ts">
import { computed, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import ReportPreview from '@/components/ReportPreview.vue';
import GradeTag from '@/components/GradeTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import type { InspectionReport } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const keyword = ref('');
const selectedId = ref('');

const isDriver = computed(() => auth.currentUser?.role === 'driver');
const currentDriver = computed(() => fleet.data.drivers.find((driver) => driver.userId === auth.currentUser?.id));
const driverVehicleIds = computed(() => new Set(fleet.data.dispatchTasks.filter((task) => task.driverId === currentDriver.value?.id).map((task) => task.vehicleId)));
const reports = computed(() =>
  fleet.data.reports.filter((report) => {
    const vehicle = fleet.data.vehicles.find((item) => item.id === report.vehicleId);
    const ownReport = auth.currentUser?.role === 'customer' && !!auth.currentUser.phone && report.clientPhone === auth.currentUser.phone;
    const assignedReport = isDriver.value && driverVehicleIds.value.has(report.vehicleId);
    const searchableText = isDriver.value
      ? `${report.reportNo}${vehicle?.plateNo ?? ''}${vehicle?.brandModel ?? ''}`
      : `${report.clientPhone}${report.reportNo}${vehicle?.plateNo ?? ''}${vehicle?.brandModel ?? ''}`;
    return (ownReport || assignedReport) && searchableText.includes(keyword.value.trim());
  })
);
const report = computed(() => reports.value.find((item) => item.id === selectedId.value) ?? reports.value[0]);
const vehicle = computed(() => fleet.data.vehicles.find((item) => item.id === report.value?.vehicleId));
const pageTitle = computed(() => (isDriver.value ? '车辆检测报告' : '检测报告查询'));
const pageSubtitle = computed(() => (isDriver.value ? '查看本人调度车辆关联的检测报告' : '支持按手机号、车牌和报告编号查询'));
const searchPlaceholder = computed(() => (isDriver.value ? '车牌 / 车型 / 报告编号' : '手机号 / 车牌 / 报告编号'));

function selectReport(row?: InspectionReport) {
  if (row) selectedId.value = row.id;
}
</script>

<template>
  <PageHeader :title="pageTitle" :subtitle="pageSubtitle" />

  <div class="user-report-layout">
    <section class="panel user-report-panel">
      <div class="user-report-toolbar">
        <div>
          <h2 class="panel-title">我的检测报告</h2>
          <span class="user-report-count">共 {{ reports.length }} 份</span>
        </div>
        <el-input v-model="keyword" clearable :placeholder="searchPlaceholder" class="user-report-search">
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div v-if="reports.length" class="user-report-list">
        <article
          v-for="row in reports"
          :key="row.id"
          class="user-report-card"
          :class="{ 'is-active': row.id === report?.id }"
          @click="selectReport(row)"
        >
          <div class="user-report-card-head">
            <strong>{{ row.reportNo }}</strong>
            <GradeTag :grade="row.grade" />
          </div>
          <div class="user-report-meta">
            <span>{{ fleet.vehicleName(row.vehicleId) }}</span>
            <span>{{ row.createdAt }}</span>
          </div>
          <button type="button">查看详情</button>
        </article>
      </div>
      <el-empty v-else description="暂无匹配报告" />
    </section>

    <section class="panel user-report-preview">
      <div class="user-report-preview-head">
        <div>
          <h2 class="panel-title">报告预览</h2>
          <span v-if="report">{{ report.reportNo }}</span>
        </div>
        <GradeTag v-if="report" :grade="report.grade" />
      </div>
      <ReportPreview v-if="report && vehicle" :report="report" :vehicle="vehicle" compact-normal-sections :hide-customer-info="isDriver" />
      <el-empty v-else description="请选择报告查看预览" />
    </section>
  </div>
</template>
