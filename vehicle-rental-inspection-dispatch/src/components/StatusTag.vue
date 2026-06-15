<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: string;
}>();

const toneMap: Record<string, string> = {
  预备库: 'primary',
  可租赁: 'success',
  已出租: 'warning',
  调度中: 'warning',
  运营中: 'success',
  维修中: 'danger',
  待检测: 'info',
  已检测: 'primary',
  待审核: 'warning',
  待取车: 'primary',
  租赁中: 'success',
  待接收: 'warning',
  执行中: 'primary',
  已完成: 'success',
  已取消: 'info',
  入库: 'success',
  出库: 'warning',
  调拨: 'primary',
  空闲: 'success',
  出车中: 'primary',
  休息: 'info',
  忙碌: 'warning',
  停用: 'danger'
};

const statusClass = computed(() => `status-pill status-${toneMap[props.status] || 'info'}`);
</script>

<template>
  <span :class="statusClass">
    <span class="status-dot" />
    {{ status }}
  </span>
</template>
