<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getRoleHome } from '@/auth/permissions';
import { useAuthStore } from '@/stores/auth';

defineProps<{
  title: string;
  subtitle?: string;
}>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const homePath = computed(() => (auth.currentUser ? getRoleHome(auth.currentUser) : '/login'));
const showMobileBack = computed(() => route.path !== homePath.value);

function backHome() {
  router.push(homePath.value);
}
</script>

<template>
  <div class="page-header">
    <div>
      <div class="page-title-row">
        <button v-if="showMobileBack" class="mobile-back-button" type="button" aria-label="返回首页" @click="backHome">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <h1>{{ title }}</h1>
      </div>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-header-actions">
      <slot />
    </div>
  </div>
</template>
