<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/PageHeader.vue';
import ReportPreview from '@/components/ReportPreview.vue';
import InspectionAgent from '@/components/InspectionAgent.vue';
import { suggestRemark } from '@/services/inspectionAgent';
import { inspectionCategories } from '@/db/schema';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/auth/permissions';
import { formatBeijingDateTime } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import type { InspectionGrade, InspectionItemResult, InspectionReport, Vehicle } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const active = ref('base');
const activeItemCategory = ref('外观检测');
const generatedReportId = ref('');
let keepGeneratedPreviewOnNextChange = false;

const initialForm = {
  vehicleId: '',
  plateNo: '渝A12354',
  vin: 'LGBH52E05RY123454',
  brandModel: '传祺M8 大师版',
  energyType: '燃油' as Vehicle['energyType'],
  color: '星夜黑',
  produceDate: '2023-05-10',
  registerDate: '2023-07-18',
  mileage: 28600,
  clientName: '李四',
  clientPhone: '13800000002',
  purpose: '入库检测',
  inspectorName: '张三',
  inspectorNo: 'PG001',
  location: '重庆市渝北区车辆智能检测中心',
  grade: 'A' as InspectionGrade,
  abnormalSummary: '外观轻微划痕，内饰正常，底盘无明显异常。',
  suggestion: '建议补漆抛光后进入网约车预备库。',
  autoStockIn: true
};

const form = reactive({ ...initialForm });

const categoryLabels = [
  ['exterior', '外观检测'],
  ['cabin', '机舱检测'],
  ['interior', '内饰检测'],
  ['flood', '水泡车专项检测'],
  ['fire', '火烧车专项检测'],
  ['crash', '重大事故专项检测'],
  ['electric', '电子系统检测'],
  ['chassis', '底盘检测']
] as const;

const items = reactive<InspectionItemResult[]>(
  categoryLabels.flatMap(([key, label]) =>
    inspectionCategories[key].map((item) => ({
      category: label,
      item,
      result: '正常' as const,
      remark: '无'
    }))
  )
);

const abnormalCount = computed(() => items.filter((item) => item.result === '异常').length);
const completedCount = computed(() => items.filter((item) => item.result !== '不适用' || item.remark).length);
const itemCategoryTabs = computed(() =>
  categoryLabels.map(([, label]) => ({
    label,
    total: items.filter((item) => item.category === label).length,
    abnormal: items.filter((item) => item.category === label && item.result === '异常').length
  }))
);
const currentCategoryItems = computed(() => items.filter((item) => item.category === activeItemCategory.value));
const hasDraftPreview = computed(() => {
  const formChanged = Object.entries(initialForm).some(([key, value]) => form[key as keyof typeof form] !== value);
  const itemChanged = items.some((item) => item.result !== '正常' || item.remark !== '无');
  return formChanged || itemChanged;
});
const draftVehicle = computed<Vehicle>(() => ({
  id: form.vehicleId || 'draft-preview-vehicle',
  plateNo: form.plateNo || '未填写车牌',
  vin: form.vin || '未填写VIN',
  brandModel: form.brandModel || '未填写车型',
  energyType: form.energyType,
  color: form.color || '未填写',
  produceDate: form.produceDate || '未填写',
  registerDate: form.registerDate || '未填写',
  mileage: form.mileage || 0,
  status: form.autoStockIn ? '预备库' : '已检测',
  grade: form.grade,
  updatedAt: formatBeijingDateTime()
}));
const draftReport = computed<InspectionReport>(() => ({
  id: 'draft-preview-report',
  reportNo: '预览草稿',
  vehicleId: draftVehicle.value.id,
  clientName: form.clientName || '未填写',
  clientPhone: form.clientPhone || '未填写',
  purpose: form.purpose,
  inspectorName: form.inspectorName || '未填写',
  inspectorNo: form.inspectorNo || '未填写',
  location: form.location || '未填写',
  checkedAt: formatBeijingDateTime(),
  grade: form.grade,
  abnormalSummary: form.abnormalSummary || (abnormalCount.value ? '存在异常检测项，请完善异常汇总。' : '未发现明显异常。'),
  suggestion: form.suggestion || '建议按运营标准完成清洁、补能和随车物品核验。',
  floodVerdict: calcFloodVerdict(items),
  fireVerdict: calcFireVerdict(items),
  crashVerdict: items.some((item) => item.category === '重大事故专项检测' && item.result === '异常') ? '确认事故车' : '正常',
  items: items.map((item) => ({ ...item })),
  createdAt: formatBeijingDateTime()
}));
const generatedReport = computed(() => fleet.data.reports.find((report) => report.id === generatedReportId.value));
const generatedVehicle = computed(() => fleet.data.vehicles.find((vehicle) => vehicle.id === generatedReport.value?.vehicleId));
const previewReport = computed(() => generatedReport.value ?? draftReport.value);
const previewVehicle = computed(() => generatedVehicle.value ?? draftVehicle.value);
const hasPreview = computed(() => Boolean(generatedReport.value && generatedVehicle.value) || hasDraftPreview.value);
const canCreateReport = computed(() => can(auth.currentUser, 'report:create'));

watch(
  [() => ({ ...form }), () => items.map((item) => `${item.category}|${item.item}|${item.result}|${item.remark}`).join('\n')],
  () => {
    if (keepGeneratedPreviewOnNextChange) return;
    if (generatedReportId.value) generatedReportId.value = '';
  }
);

function calcFloodVerdict(source: InspectionItemResult[]): InspectionReport['floodVerdict'] {
  const count = source.filter((item) => item.category === '水泡车专项检测' && item.result === '异常').length;
  if (count >= 2) return '确认水泡';
  if (count === 1) return '疑似水泡';
  return '正常';
}

function calcFireVerdict(source: InspectionItemResult[]): InspectionReport['fireVerdict'] {
  const count = source.filter((item) => item.category === '火烧车专项检测' && item.result === '异常').length;
  if (count >= 2) return '确认火烧';
  if (count === 1) return '疑似火烧';
  return '正常';
}

function resetForm() {
  Object.assign(form, { ...initialForm });
  items.forEach((item) => {
    item.result = '正常';
    item.remark = '无';
  });
  activeItemCategory.value = '外观检测';
  active.value = 'base';
}

function fillVehicle() {
  const vehicle = fleet.data.vehicles.find((item) => item.id === form.vehicleId);
  if (!vehicle) return;
  Object.assign(form, {
    plateNo: vehicle.plateNo,
    vin: vehicle.vin,
    brandModel: vehicle.brandModel,
    energyType: vehicle.energyType,
    color: vehicle.color,
    produceDate: vehicle.produceDate,
    registerDate: vehicle.registerDate,
    mileage: vehicle.mileage
  });
}

const agentContext = computed(() => ({
  form: {
    plateNo: form.plateNo,
    vin: form.vin,
    brandModel: form.brandModel,
    energyType: form.energyType,
    color: form.color,
    produceDate: form.produceDate,
    registerDate: form.registerDate,
    mileage: form.mileage,
    purpose: form.purpose,
    grade: form.grade,
    abnormalSummary: form.abnormalSummary,
    suggestion: form.suggestion
  },
  items: items.map((item) => ({ ...item }))
}));

function applyAgentSummary(payload: { abnormalSummary: string; suggestion: string }) {
  if (payload.abnormalSummary) form.abnormalSummary = payload.abnormalSummary;
  if (payload.suggestion) form.suggestion = payload.suggestion;
}

function applyAgentJudgement(payload: {
  grade: typeof form.grade;
  floodVerdict?: string;
  fireVerdict?: string;
  crashVerdict?: string;
  riskTags?: string[];
  reasoning?: string;
}) {
  if (payload.grade) form.grade = payload.grade;
  if (payload.reasoning) {
    const tag = payload.riskTags?.length ? `风险标签：${payload.riskTags.join('、')}。` : '';
    form.abnormalSummary = `${tag}${payload.reasoning}`.trim();
  }
}

function focusOnItem(payload: { category: string; item: string }) {
  active.value = 'items';
  activeItemCategory.value = payload.category;
  nextTick(() => {
    const target = items.find((i) => i.category === payload.category && i.item === payload.item);
    if (target) ElMessage.info(`请关注：${payload.category} - ${payload.item}`);
  });
}

const remarkLoading = reactive<Record<string, boolean>>({});
function remarkKey(item: { category: string; item: string }) {
  return `${item.category}::${item.item}`;
}
async function aiCompleteRemark(row: { category: string; item: string; remark: string }) {
  const key = remarkKey(row);
  if (remarkLoading[key]) return;
  remarkLoading[key] = true;
  try {
    const text = await suggestRemark({
      category: row.category,
      item: row.item,
      currentRemark: row.remark,
      vehicle: { brandModel: form.brandModel, mileage: form.mileage, produceDate: form.produceDate }
    });
    if (text) {
      row.remark = text;
      ElMessage.success('已生成备注');
    }
  } catch (error) {
    ElMessage.warning(`生成失败：${(error as Error).message}`);
  } finally {
    remarkLoading[key] = false;
  }
}

async function submit() {
  if (!form.plateNo || !form.clientPhone) {
    ElMessage.warning('请填写车牌和客户手机号');
    return;
  }
  const abnormalWithoutRemark = items.some((item) => item.result === '异常' && (!item.remark || item.remark === '无'));
  if (abnormalWithoutRemark) {
    ElMessage.warning('异常检测项必须填写备注');
    return;
  }
  try {
    const report = fleet.createInspection({ ...form, items: items.map((item) => ({ ...item })) });
    const autoStockIn = form.autoStockIn;
    generatedReportId.value = report.id;
    keepGeneratedPreviewOnNextChange = true;
    resetForm();
    await nextTick();
    keepGeneratedPreviewOnNextChange = false;
    active.value = 'preview';
    ElMessage.success(autoStockIn ? '报告已生成，车辆已同步到网约车预备库' : '报告已生成');
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}
</script>

<template>
  <PageHeader title="检测录入" subtitle="按检测报告模板录入，生成 Word 报告，并可一键入库联动" />

  <section class="flow-strip inspection-stats">
    <div class="flow-step"><span>检测项</span><strong>{{ completedCount }} 项</strong></div>
    <div class="flow-step" :class="{ 'is-danger': abnormalCount > 0 }"><span>异常项</span><strong>{{ abnormalCount }} 项</strong></div>
    <div class="flow-step"><span>报告评级</span><strong>{{ form.grade }} 级</strong></div>
    <div class="flow-step"><span>联动状态</span><strong>{{ form.autoStockIn ? '自动入库' : '仅生成报告' }}</strong></div>
  </section>

  <el-tabs v-model="active" class="panel">
    <el-tab-pane label="基础信息" name="base">
      <el-form class="inspection-form" label-position="top">
        <div class="grid-3">
          <el-form-item label="选择已有车辆">
            <el-select v-model="form.vehicleId" clearable filterable placeholder="可选" @change="fillVehicle">
              <el-option v-for="vehicle in fleet.data.vehicles" :key="vehicle.id" :label="`${vehicle.plateNo} ${vehicle.brandModel}`" :value="vehicle.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="车牌号码"><el-input v-model="form.plateNo" /></el-form-item>
          <el-form-item label="VIN码"><el-input v-model="form.vin" maxlength="17" /></el-form-item>
          <el-form-item label="品牌车型"><el-input v-model="form.brandModel" /></el-form-item>
          <el-form-item label="能源类型">
            <el-select v-model="form.energyType">
              <el-option label="燃油" value="燃油" />
              <el-option label="纯电" value="纯电" />
              <el-option label="混动" value="混动" />
            </el-select>
          </el-form-item>
          <el-form-item label="颜色"><el-input v-model="form.color" /></el-form-item>
          <el-form-item label="生产日期"><el-date-picker v-model="form.produceDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
          <el-form-item label="首次上牌"><el-date-picker v-model="form.registerDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
          <el-form-item label="表显里程"><el-input-number v-model="form.mileage" :min="0" style="width: 100%" /></el-form-item>
          <el-form-item label="客户姓名"><el-input v-model="form.clientName" /></el-form-item>
          <el-form-item label="客户手机号"><el-input v-model="form.clientPhone" /></el-form-item>
          <el-form-item label="检测目的">
            <el-select v-model="form.purpose">
              <el-option label="购前检测" value="购前检测" />
              <el-option label="置换评估" value="置换评估" />
              <el-option label="入库检测" value="入库检测" />
              <el-option label="车辆专业检测" value="车辆专业检测" />
              <el-option label="还车检测" value="还车检测" />
            </el-select>
          </el-form-item>
          <el-form-item label="评估师"><el-input v-model="form.inspectorName" /></el-form-item>
          <el-form-item label="评估师工号"><el-input v-model="form.inspectorNo" /></el-form-item>
          <el-form-item label="检测地点"><el-input v-model="form.location" /></el-form-item>
          <el-form-item label="车况评级">
            <el-segmented v-model="form.grade" :options="['S', 'A', 'B', 'C', 'D']" />
          </el-form-item>
          <el-form-item label="检测后联动">
            <el-switch v-model="form.autoStockIn" active-text="检测通过后直接入库到网约车预备库" />
          </el-form-item>
        </div>
        <el-form-item label="异常项汇总"><el-input v-model="form.abnormalSummary" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="维修/评估建议"><el-input v-model="form.suggestion" type="textarea" :rows="3" /></el-form-item>
        <div class="form-actions inspection-form-actions">
          <el-button @click="resetForm">重置表单</el-button>
          <el-button @click="active = 'items'">填写检测项</el-button>
          <el-button v-if="canCreateReport" type="primary" @click="submit">生成报告</el-button>
        </div>
      </el-form>
    </el-tab-pane>

    <el-tab-pane label="检测项目" name="items">
      <div class="module-check-nav">
        <button
          v-for="tab in itemCategoryTabs"
          :key="tab.label"
          type="button"
          class="module-check-tab"
          :class="{ active: activeItemCategory === tab.label, 'is-abnormal': tab.abnormal > 0 }"
          @click="activeItemCategory = tab.label"
        >
          <span>{{ tab.label }}</span>
          <strong>{{ tab.abnormal }}/{{ tab.total }}</strong>
        </button>
      </div>
      <div class="module-check-summary" :class="{ 'is-abnormal': currentCategoryItems.some((item) => item.result === '异常') }">
        当前模块：<strong>{{ activeItemCategory }}</strong>
        <span>共 {{ currentCategoryItems.length }} 项</span>
        <span>异常 {{ currentCategoryItems.filter((item) => item.result === '异常').length }} 项</span>
      </div>
      <div class="table-shell check-item-table desktop-table">
        <el-table :data="currentCategoryItems" border size="large" max-height="620">
          <el-table-column prop="item" label="检测项目" min-width="180" />
          <el-table-column label="结果" width="170">
            <template #default="{ row }">
              <el-select v-model="row.result">
                <el-option label="正常" value="正常" />
                <el-option label="异常" value="异常" />
                <el-option label="不适用" value="不适用" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="260">
            <template #default="{ row }">
              <div class="remark-cell">
                <el-input v-model="row.remark" />
                <el-button
                  size="small"
                  :loading="remarkLoading[`${row.category}::${row.item}`]"
                  :disabled="row.result !== '异常'"
                  title="AI 生成备注"
                  @click="aiCompleteRemark(row)"
                >
                  <el-icon><MagicStick /></el-icon>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-card-list check-mobile-list">
        <article v-for="item in currentCategoryItems" :key="`${item.category}-${item.item}`" class="mobile-record-card" :class="{ 'is-abnormal': item.result === '异常' }">
          <div class="mobile-record-title">{{ item.item }}</div>
          <div class="mobile-field">
            <span>结果</span>
            <el-select v-model="item.result" size="large">
              <el-option label="正常" value="正常" />
              <el-option label="异常" value="异常" />
              <el-option label="不适用" value="不适用" />
            </el-select>
          </div>
          <div class="mobile-field">
            <span>备注</span>
            <div class="remark-cell">
              <el-input v-model="item.remark" size="large" />
              <el-button
                size="small"
                :loading="remarkLoading[`${item.category}::${item.item}`]"
                :disabled="item.result !== '异常'"
                @click="aiCompleteRemark(item)"
              >
                <el-icon><MagicStick /></el-icon>
              </el-button>
            </div>
          </div>
        </article>
      </div>
      <div class="form-actions inspection-form-actions">
        <el-button @click="active = 'base'">返回基础信息</el-button>
        <el-button @click="resetForm">重置表单</el-button>
        <el-button v-if="canCreateReport" type="primary" @click="submit">生成报告</el-button>
      </div>
    </el-tab-pane>

    <el-tab-pane label="报告预览" name="preview">
      <ReportPreview v-if="hasPreview" :report="previewReport" :vehicle="previewVehicle" show-normal-sections />
      <el-empty v-else description="请先录入检测信息后查看预览" />
    </el-tab-pane>
  </el-tabs>

  <InspectionAgent
    :context="agentContext"
    @apply-summary="applyAgentSummary"
    @apply-judgement="applyAgentJudgement"
    @focus-item="focusOnItem"
  />
</template>

<style scoped>
.remark-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.remark-cell .el-input {
  flex: 1;
}
</style>
