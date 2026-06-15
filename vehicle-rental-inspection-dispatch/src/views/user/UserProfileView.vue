<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const isDriver = computed(() => auth.currentUser?.role === 'driver');
const roleName = computed(() => (isDriver.value ? '网约车司机' : '租车客户'));
const profileActions = computed(() => {
  if (isDriver.value) {
    return [
      { to: '/user/driver', title: '司机任务', icon: 'Guide' },
      { to: '/user/orders', title: '调度订单', icon: 'Tickets' },
      { to: '/user/reports', title: '车辆报告', icon: 'DocumentChecked' }
    ];
  }

  return [
    { to: '/user/rentals', title: '车辆租赁', icon: 'Van' },
    { to: '/user/publish', title: '发布车辆', icon: 'Plus' },
    { to: '/user/my-vehicles', title: '我的车辆', icon: 'House' },
    { to: '/user/orders', title: '我的订单', icon: 'Tickets' }
  ];
});

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <PageHeader title="我的" subtitle="账号信息与常用入口" />

  <section class="profile-panel">
    <div class="profile-hero">
      <span class="profile-avatar">{{ auth.currentUser?.name?.slice(0, 1) || '用' }}</span>
      <div class="profile-copy">
        <span class="profile-role">{{ roleName }}</span>
        <h2>{{ auth.currentUser?.name || roleName }}</h2>
        <p>{{ auth.currentUser?.phone || '暂无手机号' }}</p>
      </div>
    </div>

    <div class="profile-action-grid">
      <router-link v-for="item in profileActions" :key="item.title" :to="item.to" class="profile-action-item">
        <span><el-icon><component :is="item.icon" /></el-icon></span>
        <strong>{{ item.title }}</strong>
      </router-link>
    </div>

    <button type="button" class="profile-logout" @click="logout">
      <span>
        <el-icon><SwitchButton /></el-icon>
      </span>
      退出登录
    </button>
  </section>
</template>
