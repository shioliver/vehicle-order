<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { categoryLabels, inspectionCategories } from '@/data/inspectionCategories';
import { formatBeijingDateTime } from '@/utils/date';
import { downloadReportDoc } from '@/utils/reportExport';
import type { InspectionGrade, InspectionItemResult, InspectionReport, VehicleInfo } from '@/types/domain';

const active = ref('base');
const activeCategory = ref('外观检测');
const printSourceRef = ref<HTMLElement | null>(null);

const emptyForm = {
  plateNo: '',
  vin: '',
  brandModel: '',
  energyType: '燃油' as VehicleInfo['energyType'],
  color: '',
  produceDate: '',
  registerDate: '',
  mileage: 0,
  clientName: '',
  clientPhone: '',
  purpose: '车辆专业检测',
  inspectorName: '',
  inspectorNo: '',
  location: '',
  grade: 'A' as InspectionGrade,
  abnormalSummary: '',
  suggestion: ''
};

const form = reactive({ ...emptyForm });
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
const hasInput = computed(() => {
  const textInput = [form.plateNo, form.vin, form.brandModel, form.color, form.produceDate, form.registerDate, form.inspectorName, form.location].some((value) => value.trim());
  return textInput || form.mileage > 0 || items.some((item) => item.result !== '正常' || item.remark !== '无');
});
const categoryTabs = computed(() =>
  categoryLabels.map(([, label]) => ({
    label,
    total: items.filter((item) => item.category === label).length,
    abnormal: items.filter((item) => item.category === label && item.result === '异常').length
  }))
);
const currentItems = computed(() => items.filter((item) => item.category === activeCategory.value));
const vehicle = computed<VehicleInfo>(() => ({
  plateNo: form.plateNo || '未填写车牌',
  vin: form.vin || '未填写VIN',
  brandModel: form.brandModel || '未填写车型',
  energyType: form.energyType,
  color: form.color || '未填写',
  produceDate: form.produceDate || '未填写',
  registerDate: form.registerDate || '未填写',
  mileage: Number(form.mileage) || 0
}));
const report = computed<InspectionReport>(() => ({
  reportNo: `EXT${formatBeijingDateTime().slice(0, 10).replace(/\D/g, '')}`,
  clientName: form.clientName || '未填写',
  clientPhone: form.clientPhone || '未填写',
  purpose: form.purpose,
  inspectorName: form.inspectorName || '未填写',
  inspectorNo: form.inspectorNo || '未填写',
  location: form.location || '未填写',
  checkedAt: formatBeijingDateTime(),
  grade: form.grade,
  abnormalSummary: form.abnormalSummary || (abnormalCount.value ? '存在异常检测项，请补充异常说明。' : '未发现明显异常。'),
  suggestion: form.suggestion || '建议用户结合实际车况、保养记录和线下验车结果综合判断。',
  floodVerdict: calcFloodVerdict(),
  fireVerdict: calcFireVerdict(),
  crashVerdict: items.some((item) => item.category === '重大事故专项检测' && item.result === '异常') ? '确认事故车' : '正常',
  items: items.map((item) => ({ ...item })),
  createdAt: formatBeijingDateTime()
}));

function calcFloodVerdict(): InspectionReport['floodVerdict'] {
  const count = items.filter((item) => item.category === '水泡车专项检测' && item.result === '异常').length;
  if (count >= 2) return '确认水泡';
  if (count === 1) return '疑似水泡';
  return '正常';
}

function calcFireVerdict(): InspectionReport['fireVerdict'] {
  const count = items.filter((item) => item.category === '火烧车专项检测' && item.result === '异常').length;
  if (count >= 2) return '确认火烧';
  if (count === 1) return '疑似火烧';
  return '正常';
}

function resetForm() {
  Object.assign(form, emptyForm);
  items.forEach((item) => {
    item.result = '正常';
    item.remark = '无';
  });
  activeCategory.value = '外观检测';
  active.value = 'base';
}

function fillDemo() {
  Object.assign(form, {
    plateNo: '渝X26891',
    vin: 'LGBH52E05RYTOOL01',
    brandModel: '本田雅阁 260TURBO',
    energyType: '燃油',
    color: '星月白',
    produceDate: '2022-08-18',
    registerDate: '2022-10-12',
    mileage: 31800,
    clientName: '车主用户',
    clientPhone: '13800000002',
    inspectorName: '第三方检测员',
    inspectorNo: 'EXT001',
    location: '重庆市渝北区检测服务点',
    grade: 'A',
    abnormalSummary: '外观轻微使用痕迹，结构件未见明显异常。',
    suggestion: '建议上传本报告至租赁车源页，供租车用户参考。'
  });
  active.value = 'preview';
}

function validateDraft() {
  if (!form.plateNo.trim() || !form.vin.trim() || !form.brandModel.trim()) {
    ElMessage.warning('请至少填写车牌、VIN码和品牌车型');
    return false;
  }
  if (items.some((item) => item.result === '异常' && (!item.remark.trim() || item.remark === '无'))) {
    ElMessage.warning('异常检测项必须填写备注');
    return false;
  }
  return true;
}

function exportWord() {
  if (!validateDraft()) return;
  downloadReportDoc(report.value, vehicle.value);
}

async function printReport() {
  if (!validateDraft()) return;
  active.value = 'preview';
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

function sectionItems(category: string) {
  return report.value.items.filter((item) => item.category === category);
}
</script>

<template>
  <div class="tool-shell">
    <header class="tool-header">
      <div>
        <span>独立应用</span>
        <h1>二手车检测报告工具</h1>
      </div>
      <div class="tool-actions">
        <el-button @click="fillDemo">示例</el-button>
        <el-button @click="resetForm">重置</el-button>
        <el-button type="primary" @click="exportWord">导出 Word</el-button>
        <el-button type="primary" plain @click="printReport">打印</el-button>
      </div>
    </header>

    <main class="tool-main">
      <section class="panel editor-panel">
        <div class="stats-row">
          <div><span>检测项</span><strong>{{ items.length }}</strong></div>
          <div :class="{ danger: abnormalCount > 0 }"><span>异常项</span><strong>{{ abnormalCount }}</strong></div>
          <div><span>评级</span><strong>{{ form.grade }} 级</strong></div>
          <div><span>用途</span><strong>{{ form.purpose }}</strong></div>
        </div>

        <el-tabs v-model="active">
          <el-tab-pane label="基础信息" name="base">
            <el-form label-position="top">
              <div class="form-grid-3">
                <el-form-item label="车牌号码"><el-input v-model="form.plateNo" placeholder="请输入车牌" /></el-form-item>
                <el-form-item label="VIN码"><el-input v-model="form.vin" maxlength="17" placeholder="请输入VIN码" /></el-form-item>
                <el-form-item label="品牌车型"><el-input v-model="form.brandModel" placeholder="品牌和车型" /></el-form-item>
                <el-form-item label="能源类型">
                  <el-select v-model="form.energyType"><el-option label="燃油" value="燃油" /><el-option label="纯电" value="纯电" /><el-option label="混动" value="混动" /></el-select>
                </el-form-item>
                <el-form-item label="颜色"><el-input v-model="form.color" /></el-form-item>
                <el-form-item label="表显里程"><el-input-number v-model="form.mileage" :min="0" :step="100" controls-position="right" /></el-form-item>
                <el-form-item label="生产日期"><el-date-picker v-model="form.produceDate" value-format="YYYY-MM-DD" type="date" /></el-form-item>
                <el-form-item label="首次上牌"><el-date-picker v-model="form.registerDate" value-format="YYYY-MM-DD" type="date" /></el-form-item>
                <el-form-item label="检测目的">
                  <el-select v-model="form.purpose">
                    <el-option label="车辆专业检测" value="车辆专业检测" />
                    <el-option label="购前检测" value="购前检测" />
                    <el-option label="置换评估" value="置换评估" />
                    <el-option label="还车检测" value="还车检测" />
                  </el-select>
                </el-form-item>
                <el-form-item label="车况评级"><el-segmented v-model="form.grade" :options="['S', 'A', 'B', 'C', 'D']" /></el-form-item>
                <el-form-item label="客户姓名"><el-input v-model="form.clientName" /></el-form-item>
                <el-form-item label="客户手机号"><el-input v-model="form.clientPhone" /></el-form-item>
                <el-form-item label="评估师"><el-input v-model="form.inspectorName" /></el-form-item>
                <el-form-item label="评估师工号"><el-input v-model="form.inspectorNo" /></el-form-item>
                <el-form-item label="检测地点"><el-input v-model="form.location" /></el-form-item>
              </div>
              <el-form-item label="异常项汇总"><el-input v-model="form.abnormalSummary" type="textarea" :rows="3" /></el-form-item>
              <el-form-item label="维修/评估建议"><el-input v-model="form.suggestion" type="textarea" :rows="3" /></el-form-item>
              <div class="step-actions"><el-button type="primary" @click="active = 'items'">继续填写检测项</el-button></div>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="检测项目" name="items">
            <div class="category-grid">
              <button v-for="tab in categoryTabs" :key="tab.label" type="button" :class="{ active: activeCategory === tab.label, danger: tab.abnormal }" @click="activeCategory = tab.label">
                <span>{{ tab.label }}</span>
                <strong>{{ tab.abnormal }}/{{ tab.total }}</strong>
              </button>
            </div>

            <el-table :data="currentItems" border size="large" class="desktop-item-table" max-height="520">
              <el-table-column prop="item" label="检测项目" min-width="180" />
              <el-table-column label="结果" width="160">
                <template #default="{ row }">
                  <el-select v-model="row.result"><el-option label="正常" value="正常" /><el-option label="异常" value="异常" /><el-option label="不适用" value="不适用" /></el-select>
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="220"><template #default="{ row }"><el-input v-model="row.remark" /></template></el-table-column>
            </el-table>

            <div class="mobile-item-list">
              <article v-for="item in currentItems" :key="item.item" class="mobile-item-card" :class="{ danger: item.result === '异常' }">
                <div class="mobile-item-head"><strong>{{ item.item }}</strong><span>{{ item.result }}</span></div>
                <el-segmented v-model="item.result" :options="['正常', '异常', '不适用']" />
                <el-input v-model="item.remark" placeholder="备注，异常项必填" />
              </article>
            </div>

            <div class="step-actions">
              <el-button @click="active = 'base'">返回基础信息</el-button>
              <el-button type="primary" @click="active = 'preview'">查看报告预览</el-button>
            </div>
          </el-tab-pane>

          <el-tab-pane label="报告预览" name="preview">
            <div ref="printSourceRef">
              <section v-if="hasInput" class="report-paper">
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
                  <div><span>客户姓名</span><strong>{{ report.clientName }}</strong></div>
                  <div><span>客户手机</span><strong>{{ report.clientPhone }}</strong></div>
                </div>
                <template v-for="tab in categoryTabs" :key="tab.label">
                  <h3>{{ tab.label }}记录</h3>
                  <table class="report-table">
                    <thead><tr><th>检测项目</th><th>检测结果</th><th>备注</th></tr></thead>
                    <tbody>
                      <tr v-for="item in sectionItems(tab.label)" :key="`${tab.label}-${item.item}`" :class="{ 'is-abnormal': item.result === '异常' }">
                        <td>{{ item.item }}</td>
                        <td :class="{ 'is-result-abnormal': item.result === '异常' }">{{ item.result }}</td>
                        <td>{{ item.remark || '无' }}</td>
                      </tr>
                    </tbody>
                  </table>
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
              </section>
              <el-empty v-else description="请先录入检测信息，预览区不会展示空报告" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>
    </main>
  </div>
</template>

<style scoped>
.tool-shell {
  min-height: 100vh;
  padding: 18px;
  background: linear-gradient(180deg, #eef5ff 0%, #eaf2f7 100%);
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1440px;
  margin: 0 auto 16px;
  padding: 16px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 14px 34px rgba(15, 23, 42, .08);
}

.tool-header span {
  display: block;
  color: var(--primary);
  font-weight: 900;
  margin-bottom: 4px;
}

.tool-header h1 {
  margin: 0;
  font-size: 24px;
}

.tool-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tool-main {
  max-width: 1440px;
  margin: 0 auto;
}

.editor-panel {
  padding: 18px 20px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.stats-row div {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8fbff;
}

.stats-row span {
  display: block;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.stats-row strong {
  display: block;
  margin-top: 4px;
  font-size: 20px;
}

.danger strong,
.danger span {
  color: var(--danger);
}

:deep(.el-input-number),
:deep(.el-date-editor),
:deep(.el-select) {
  width: 100%;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.category-grid button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 54px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fbfdff;
  color: var(--text);
  font-weight: 900;
  cursor: pointer;
}

.category-grid button.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.category-grid button.danger {
  border-color: #fecaca;
  background: var(--danger-soft);
  color: var(--danger);
}

.mobile-item-list {
  display: none;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

@media (max-width: 820px) {
  .tool-shell {
    padding: 10px;
  }

  .tool-header {
    display: grid;
    padding: 12px;
    border-radius: 10px;
  }

  .tool-header h1 {
    font-size: 20px;
  }

  .tool-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .tool-actions .el-button {
    margin: 0;
    padding: 0 8px;
  }

  .editor-panel {
    padding: 14px;
  }

  .stats-row,
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .stats-row div {
    padding: 10px;
  }

  .category-grid button {
    min-height: 48px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 14px;
  }

  .desktop-item-table {
    display: none;
  }

  .mobile-item-list {
    display: grid;
    gap: 10px;
  }

  .mobile-item-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
  }

  .mobile-item-card.danger {
    border-color: #fecaca;
    background: var(--danger-soft);
  }

  .mobile-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .mobile-item-head span {
    flex: 0 0 auto;
    padding: 4px 10px;
    border-radius: 999px;
    color: var(--primary);
    background: var(--primary-soft);
    font-weight: 900;
    font-size: 12px;
  }

  .mobile-item-card.danger .mobile-item-head span {
    color: var(--danger);
    background: #fee2e2;
  }

  .step-actions {
    position: sticky;
    bottom: 8px;
    z-index: 4;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: rgba(255, 255, 255, .95);
  }

  .step-actions .el-button {
    margin: 0;
  }
}
</style>
