<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import ReportPreview from '@/components/ReportPreview.vue';
import GradeTag from '@/components/GradeTag.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { TEMPORARY_REPORT_LINK_TTL_MS, parseReportTimestamp, validateTemporaryReportGrant } from '@/utils/temporaryReportLink';

const route = useRoute();
const fleet = useFleetStore();
const auth = useAuthStore();
const now = ref(Date.now());
let timer: number | undefined;

const timestamp = computed(() => parseReportTimestamp(route.params.timestamp));
const vehicleId = computed(() => (typeof route.params.vehicleId === 'string' ? route.params.vehicleId : ''));
const reportId = computed(() => (typeof route.query.reportId === 'string' ? route.query.reportId : ''));
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const vehicle = computed(() => {
  return fleet.data.vehicles.find((item) => item.id === vehicleId.value);
});
const report = computed(() => fleet.data.reports.find((item) => item.id === reportId.value && item.vehicleId === vehicleId.value));
const linkValid = computed(() =>
  validateTemporaryReportGrant({
    vehicleId: vehicleId.value,
    reportId: reportId.value,
    token: token.value,
    userId: auth.currentUser?.id,
    timestamp: timestamp.value,
    now: now.value
  })
);
const vehicleVisibleForRental = computed(() => vehicle.value?.status === '可租赁' || vehicle.value?.status === '预备库');
const canShowReport = computed(() => linkValid.value && vehicleVisibleForRental.value && !!vehicle.value && !!report.value);
const expiredAt = computed(() => {
  if (timestamp.value === null) return '';
  return new Date(timestamp.value + TEMPORARY_REPORT_LINK_TTL_MS).toLocaleString('zh-CN', { hour12: false });
});
const errorTitle = computed(() => {
  if (!linkValid.value) return '报告链接已失效';
  if (!vehicle.value) return '未找到车辆';
  if (!vehicleVisibleForRental.value) return '车辆当前不可租赁';
  return '暂无可查看报告';
});
const errorDescription = computed(() => {
  if (!linkValid.value) return '该临时链接仅在生成后 30 分钟内有效，请返回首页重新进入车辆租赁。';
  if (!vehicle.value) return '当前链接中的车辆不存在，无法展示检测报告。';
  if (!vehicleVisibleForRental.value) return '该车辆已不在可租列表中，检测报告临时链接已停止展示。';
  return '该车辆没有有效的最新检测报告，已停止展示临时报告链接。';
});

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <PageHeader title="租赁车辆检测报告" subtitle="临时报告链接仅供本次租赁选车查看">
    <RouterLink class="temporary-report-back" to="/user/home">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </RouterLink>
  </PageHeader>

  <section v-if="canShowReport && vehicle && report" class="temporary-report-shell">
    <div class="temporary-report-summary">
      <div>
        <span>车辆</span>
        <strong>{{ vehicle.plateNo }} {{ vehicle.brandModel }}</strong>
      </div>
      <div>
        <span>报告编号</span>
        <strong>{{ report.reportNo }}</strong>
      </div>
      <div>
        <span>有效期至</span>
        <strong>{{ expiredAt }}</strong>
      </div>
      <div class="temporary-report-tags">
        <GradeTag :grade="report.grade" />
        <StatusTag :status="vehicle.status" />
      </div>
    </div>

    <ReportPreview :report="report" :vehicle="vehicle" compact-normal-sections hide-customer-info />
  </section>

  <section v-else class="temporary-report-state">
    <div class="temporary-report-state-icon">
      <el-icon><WarningFilled /></el-icon>
    </div>
    <h2>{{ errorTitle }}</h2>
    <p>{{ errorDescription }}</p>
    <RouterLink class="temporary-report-state-action" to="/user/home">返回首页</RouterLink>
  </section>
</template>

<style scoped>
.temporary-report-back,
.temporary-report-state-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 8px;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid rgba(11, 118, 109, 0.2);
  padding: 0 14px;
  text-decoration: none;
  font-weight: 800;
}

.temporary-report-shell {
  display: grid;
  gap: 14px;
}

.temporary-report-summary {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr auto;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 14px;
  box-shadow: 0 10px 28px rgba(6, 21, 35, 0.05);
}

.temporary-report-summary span {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 4px;
}

.temporary-report-summary strong {
  color: var(--text);
  font-size: 15px;
  line-height: 1.35;
}

.temporary-report-tags {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.temporary-report-state {
  width: min(520px, 100%);
  margin: 48px auto 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 26px;
  text-align: center;
  box-shadow: 0 16px 38px rgba(6, 21, 35, 0.08);
}

.temporary-report-state-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #b45309;
  background: #fffbeb;
  font-size: 24px;
}

.temporary-report-state h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.temporary-report-state p {
  margin: 0 auto 18px;
  max-width: 420px;
  color: var(--muted);
  line-height: 1.6;
}

@media (max-width: 820px) {
  .temporary-report-back {
    width: 100%;
  }

  .temporary-report-summary {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .temporary-report-tags {
    justify-content: flex-start;
  }

  .temporary-report-state {
    margin-top: 20px;
    padding: 20px;
  }
}
</style>
