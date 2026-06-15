<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/PageHeader.vue';
import StatusTag from '@/components/StatusTag.vue';
import GradeTag from '@/components/GradeTag.vue';
import { can } from '@/auth/permissions';
import { getErrorMessage } from '@/utils/errors';
import type { InspectionGrade, Vehicle, VehicleStatus } from '@/types/domain';

const fleet = useFleetStore();
const auth = useAuthStore();
const keyword = ref('');
const statusFilter = ref('');
const gradeFilter = ref('');
const energyFilter = ref('');
const dialogVisible = ref(false);
const dialogTitle = ref('新增车辆');

const form = reactive({
  id: '',
  plateNo: '',
  vin: '',
  brandModel: '',
  energyType: '燃油' as Vehicle['energyType'],
  color: '',
  produceDate: '',
  registerDate: '',
  mileage: 0,
  status: '待检测' as VehicleStatus,
  grade: 'A' as InspectionGrade,
  warehouse: '',
  parkingSpace: '',
  dailyPrice: 268,
  deposit: 3000
});

const vehicles = computed(() =>
  fleet.data.vehicles.filter((item) => {
    const matchedKeyword = `${item.plateNo}${item.vin}${item.brandModel}${item.status}`.includes(keyword.value.trim());
    const matchedStatus = !statusFilter.value || item.status === statusFilter.value;
    const matchedGrade = !gradeFilter.value || item.grade === gradeFilter.value;
    const matchedEnergy = !energyFilter.value || item.energyType === energyFilter.value;
    return matchedKeyword && matchedStatus && matchedGrade && matchedEnergy;
  })
);
const canCreateVehicle = computed(() => can(auth.currentUser, 'vehicle:create'));
const canUpdateVehicle = computed(() => can(auth.currentUser, 'vehicle:update'));
const canDeleteVehicle = computed(() => can(auth.currentUser, 'vehicle:delete'));
const canMutateVehicle = computed(() => canUpdateVehicle.value || canDeleteVehicle.value);

function resetForm() {
  Object.assign(form, {
    id: '',
    plateNo: '',
    vin: '',
    brandModel: '',
    energyType: '燃油',
    color: '',
    produceDate: '',
    registerDate: '',
    mileage: 0,
    status: '待检测',
    grade: 'A',
    warehouse: '',
    parkingSpace: '',
    dailyPrice: 268,
    deposit: 3000
  });
}

function openCreate() {
  resetForm();
  dialogTitle.value = '新增车辆';
  dialogVisible.value = true;
}

function openEdit(vehicle: Vehicle) {
  Object.assign(form, {
    ...vehicle,
    dailyPrice: vehicle.dailyPrice ?? 268,
    deposit: vehicle.deposit ?? 3000,
    warehouse: vehicle.warehouse ?? '',
    parkingSpace: vehicle.parkingSpace ?? '',
    grade: vehicle.grade ?? 'A'
  });
  dialogTitle.value = '编辑车辆';
  dialogVisible.value = true;
}

function saveVehicle() {
  if (!form.plateNo || !form.vin || !form.brandModel) {
    ElMessage.warning('请填写车牌、VIN 和品牌车型');
    return;
  }
  try {
    fleet.upsertVehicle({
      id: form.id || undefined,
      plateNo: form.plateNo,
      vin: form.vin,
      brandModel: form.brandModel,
      energyType: form.energyType,
      color: form.color,
      produceDate: form.produceDate,
      registerDate: form.registerDate,
      mileage: form.mileage,
      status: form.status,
      grade: form.grade,
      warehouse: form.warehouse || undefined,
      parkingSpace: form.parkingSpace || undefined,
      dailyPrice: form.dailyPrice,
      deposit: form.deposit
    });
    ElMessage.success(form.id ? '车辆已更新' : '车辆已新增');
    dialogVisible.value = false;
  } catch (error) {
    ElMessage.warning(getErrorMessage(error));
  }
}

async function removeVehicle(vehicle: Vehicle) {
  await ElMessageBox.confirm(`确定删除车辆 ${vehicle.plateNo} 吗？关联报告、订单、库存和调度记录也会移除。`, '删除车辆', {
    type: 'warning'
  });
  fleet.deleteVehicle(vehicle.id);
  ElMessage.success('车辆已删除');
}
</script>

<template>
  <PageHeader title="车辆中心" subtitle="所有业务共用的车辆主档案" />

  <section class="panel">
    <div class="data-table-card-head">
      <div>
        <h2>车辆档案</h2>
        <p>统一维护车牌、VIN、评级、库存位置和租赁价格。</p>
      </div>
      <span>共 {{ vehicles.length }} 辆</span>
    </div>
    <div class="data-center-toolbar">
      <div class="table-filter-bar">
        <el-input v-model="keyword" placeholder="搜索车牌 / VIN / 车型" clearable />
        <el-select v-model="statusFilter" clearable placeholder="车辆状态">
          <el-option v-for="status in ['待检测','检测中','已检测','待入库','预备库','可租赁','已出租','调度中','运营中','维修中','保养中','停用']" :key="status" :label="status" :value="status" />
        </el-select>
        <el-select v-model="gradeFilter" clearable placeholder="评级">
          <el-option label="S 级" value="S" />
          <el-option label="A 级" value="A" />
          <el-option label="B 级" value="B" />
          <el-option label="C 级" value="C" />
          <el-option label="D 级" value="D" />
        </el-select>
        <el-select v-model="energyFilter" clearable placeholder="能源">
          <el-option label="燃油" value="燃油" />
          <el-option label="纯电" value="纯电" />
          <el-option label="混动" value="混动" />
        </el-select>
      </div>
      <div class="table-action-bar">
        <el-button v-if="canCreateVehicle" type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增车辆
        </el-button>
      </div>
    </div>
    <div class="table-shell desktop-table">
      <el-table :data="vehicles" size="large" class="compact-data-table no-wrap-table">
        <el-table-column prop="plateNo" label="车牌" width="110" fixed show-overflow-tooltip />
        <el-table-column prop="vin" label="VIN" min-width="180" show-overflow-tooltip />
        <el-table-column prop="brandModel" label="品牌车型" min-width="190" show-overflow-tooltip />
        <el-table-column prop="energyType" label="能源" width="90" show-overflow-tooltip />
        <el-table-column prop="mileage" label="里程" width="110">
          <template #default="{ row }">{{ row.mileage }} km</template>
        </el-table-column>
        <el-table-column label="评级" width="90">
          <template #default="{ row }"><GradeTag :grade="row.grade" /></template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><StatusTag :status="row.status" /></template>
        </el-table-column>
        <el-table-column prop="warehouse" label="仓库" min-width="170" show-overflow-tooltip />
        <el-table-column prop="parkingSpace" label="车位" width="90" show-overflow-tooltip />
        <el-table-column v-if="canMutateVehicle" label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canUpdateVehicle" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canDeleteVehicle" size="small" type="danger" @click="removeVehicle(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="mobile-card-list admin-mobile-list">
      <article v-for="vehicle in vehicles" :key="vehicle.id" class="mobile-record-card">
        <div class="mobile-record-head">
          <div class="mobile-record-title">{{ vehicle.plateNo }} {{ vehicle.brandModel }}</div>
          <div class="mobile-record-badges">
            <GradeTag :grade="vehicle.grade" />
            <StatusTag :status="vehicle.status" />
          </div>
        </div>
        <div class="mobile-record-grid">
          <div><span>VIN</span><strong>{{ vehicle.vin }}</strong></div>
          <div><span>能源/里程</span><strong>{{ vehicle.energyType }} | {{ vehicle.mileage }} km</strong></div>
          <div><span>仓库车位</span><strong>{{ vehicle.warehouse || '待分配' }} {{ vehicle.parkingSpace || '' }}</strong></div>
        </div>
        <div v-if="canMutateVehicle" class="mobile-record-actions">
          <el-button v-if="canUpdateVehicle" @click="openEdit(vehicle)">编辑</el-button>
          <el-button v-if="canDeleteVehicle" type="danger" @click="removeVehicle(vehicle)">删除</el-button>
        </div>
      </article>
    </div>
  </section>

  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px">
    <el-form label-position="top">
      <div class="grid-3">
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
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option v-for="status in ['待检测','检测中','已检测','待入库','预备库','可租赁','已出租','调度中','运营中','维修中','保养中','停用']" :key="status" :label="status" :value="status" />
          </el-select>
        </el-form-item>
        <el-form-item label="生产日期"><el-date-picker v-model="form.produceDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
        <el-form-item label="首次上牌"><el-date-picker v-model="form.registerDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
        <el-form-item label="里程"><el-input-number v-model="form.mileage" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="评级"><el-segmented v-model="form.grade" :options="['S','A','B','C','D']" /></el-form-item>
        <el-form-item label="仓库"><el-input v-model="form.warehouse" /></el-form-item>
        <el-form-item label="车位"><el-input v-model="form.parkingSpace" /></el-form-item>
        <el-form-item label="日租价格"><el-input-number v-model="form.dailyPrice" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="押金"><el-input-number v-model="form.deposit" :min="0" style="width: 100%" /></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button v-if="form.id ? canUpdateVehicle : canCreateVehicle" type="primary" @click="saveVehicle">保存</el-button>
    </template>
  </el-dialog>
</template>
