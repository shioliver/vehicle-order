<script setup lang="ts">
import { computed } from 'vue';
import GradeTag from '@/components/GradeTag.vue';
import type { InspectionItemResult, InspectionReport, Vehicle } from '@/types/domain';

const props = withDefaults(
  defineProps<{
    report: InspectionReport;
    vehicle: Vehicle;
    showNormalSections?: boolean;
    compactNormalSections?: boolean;
    hideCustomerInfo?: boolean;
  }>(),
  {
    showNormalSections: false,
    compactNormalSections: false,
    hideCustomerInfo: false
  }
);

const grouped = computed(() => {
  const map = new Map<string, typeof props.report.items>();
  props.report.items.forEach((item) => {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  });
  return [...map.entries()].map(([category, items]) => ({
    category,
    items,
    abnormal: items.filter((item) => item.result === '异常')
  }));
});

const abnormalItems = computed(() => props.report.items.filter((item) => item.result === '异常'));
const hasAbnormal = computed(() => abnormalItems.value.length > 0);
const sectionSummary = computed(() =>
  grouped.value.map((section) => ({
    category: section.category,
    total: section.items.length,
    abnormal: section.abnormal
  }))
);
const visibleSections = computed(() =>
  props.showNormalSections || props.compactNormalSections ? grouped.value : grouped.value.filter((section) => section.abnormal.length)
);
const visibleSectionSummary = computed(() =>
  props.showNormalSections || props.compactNormalSections ? sectionSummary.value : sectionSummary.value.filter((section) => section.abnormal.length)
);

function sectionRows(section: { items: InspectionItemResult[]; abnormal: InspectionItemResult[] }) {
  if (props.compactNormalSections) return section.abnormal;
  return props.showNormalSections ? section.items : section.abnormal;
}

function reportRowClassName({ row }: { row: InspectionItemResult }) {
  return row.result === '异常' ? 'report-abnormal-row' : '';
}
</script>

<template>
  <div class="report-paper">
    <div class="mobile-report-summary" :class="{ 'is-abnormal': hasAbnormal }">
      <div class="mobile-report-title">
        <span>{{ vehicle.plateNo }}</span>
        <GradeTag :grade="report.grade" />
      </div>
      <p>{{ vehicle.brandModel }} | {{ vehicle.mileage }} km</p>
      <div class="mobile-verdict-row">
        <div><span>水泡</span><strong>{{ report.floodVerdict }}</strong></div>
        <div><span>火烧</span><strong>{{ report.fireVerdict }}</strong></div>
        <div><span>事故</span><strong>{{ report.crashVerdict }}</strong></div>
      </div>
      <div class="mobile-report-note" :class="{ 'is-abnormal': hasAbnormal }">
        <span>异常项</span>
        <strong>{{ abnormalItems.length }} 项</strong>
      </div>
    </div>

    <div class="report-head">
      <div class="report-logo">车辆智能检测系统</div>
      <h2>二手车专业检测报告</h2>
      <p>报告编号：{{ report.reportNo }} | 检测机构：车辆智能检测中心</p>
    </div>

    <h3>车辆基本信息</h3>
    <div class="report-info-grid">
      <div><span>车牌号码</span><strong>{{ vehicle.plateNo }}</strong></div>
      <div><span>VIN码</span><strong>{{ vehicle.vin }}</strong></div>
      <div><span>品牌车型</span><strong>{{ vehicle.brandModel }}</strong></div>
      <div><span>生产日期</span><strong>{{ vehicle.produceDate }}</strong></div>
      <div><span>首次上牌</span><strong>{{ vehicle.registerDate }}</strong></div>
      <div><span>表显里程</span><strong>{{ vehicle.mileage }} km</strong></div>
    </div>

    <h3>检测信息</h3>
    <div class="report-info-grid">
      <div><span>评估师</span><strong>{{ report.inspectorName }} ({{ report.inspectorNo }})</strong></div>
      <div><span>检测时间</span><strong>{{ report.checkedAt }}</strong></div>
      <div><span>检测地点</span><strong>{{ report.location }}</strong></div>
      <div><span>检测目的</span><strong>{{ report.purpose }}</strong></div>
      <div v-if="!hideCustomerInfo"><span>客户姓名</span><strong>{{ report.clientName }}</strong></div>
      <div v-if="!hideCustomerInfo"><span>客户手机</span><strong>{{ report.clientPhone }}</strong></div>
    </div>

    <div v-if="visibleSectionSummary.length" class="mobile-section-list">
      <details v-for="section in visibleSectionSummary" :key="section.category" class="mobile-section-card" :class="{ 'is-abnormal': section.abnormal.length }">
        <summary>
          <span>{{ section.category }}</span>
          <strong>{{ section.abnormal.length ? `${section.abnormal.length} 项异常` : '全部正常' }}</strong>
        </summary>
        <div v-if="section.abnormal.length" class="mobile-abnormal-list">
          <div v-for="item in section.abnormal" :key="item.item" class="mobile-abnormal-item">
            <span>{{ item.item }}</span>
            <strong>{{ item.remark || '异常' }}</strong>
          </div>
        </div>
      </details>
    </div>

    <template v-for="section in visibleSections" :key="section.category">
      <div v-if="compactNormalSections && !section.abnormal.length" class="report-normal-section-card">
        <strong>{{ section.category }}</strong>
        <span>全部正常</span>
      </div>
      <template v-else>
        <h3>{{ section.category }}记录</h3>
        <el-table
          :data="sectionRows(section)"
          border
          size="small"
          class="report-desktop-table"
          :row-class-name="reportRowClassName"
        >
          <el-table-column prop="item" label="检测项目" min-width="160" />
          <el-table-column prop="result" label="检测结果" width="110" />
          <el-table-column prop="remark" label="备注" min-width="160" />
        </el-table>
      </template>
      <div class="report-mobile-list">
        <article v-for="item in section.abnormal" :key="`${section.category}-${item.item}`" class="report-mobile-card is-abnormal">
          <div>
            <span>检测项目</span>
            <strong>{{ item.item }}</strong>
          </div>
          <div>
            <span>检测结果</span>
            <strong>{{ item.result }}</strong>
          </div>
          <div>
            <span>备注</span>
            <strong>{{ item.remark || '无' }}</strong>
          </div>
        </article>
      </div>
    </template>

    <div class="verdict-grid">
      <div><span>水泡车判定</span><strong>{{ report.floodVerdict }}</strong></div>
      <div><span>火烧车判定</span><strong>{{ report.fireVerdict }}</strong></div>
      <div><span>重大事故判定</span><strong>{{ report.crashVerdict }}</strong></div>
    </div>

    <div class="report-conclusion">
      <h3>检测结论</h3>
      <p><strong>车况评级：</strong>{{ report.grade }}</p>
      <p><strong>异常项汇总：</strong>{{ report.abnormalSummary }}</p>
      <p><strong>维修评估建议：</strong>{{ report.suggestion }}</p>
      <p><strong>报告生成时间：</strong>{{ report.createdAt }}</p>
    </div>
  </div>
</template>
