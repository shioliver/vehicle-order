<script setup lang="ts">
import { computed } from 'vue';
import type { InspectionGrade } from '@/types/domain';

const props = defineProps<{
  grade?: InspectionGrade | string;
}>();

const label = computed(() => (props.grade ? `${props.grade} 级` : '待评估'));
const gradeClass = computed(() => `grade-pill grade-${props.grade || 'pending'}`);
</script>

<template>
  <span :class="gradeClass">{{ label }}</span>
</template>
