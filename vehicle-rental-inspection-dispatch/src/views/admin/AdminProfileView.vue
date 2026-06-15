<script setup lang="ts">
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <PageHeader title="我的" subtitle="管理端账号与常用操作" />

  <section class="profile-panel">
    <div class="profile-hero">
      <span class="profile-avatar">{{ auth.currentUser?.name?.slice(0, 1) || '管' }}</span>
      <div>
        <h2>{{ auth.currentUser?.name || '系统管理员' }}</h2>
        <p>{{ auth.currentUser?.phone || '暂无手机号' }}</p>
      </div>
    </div>
    <div class="profile-actions">
      <el-button @click="$router.push('/admin/dashboard')">
        <el-icon><HomeFilled /></el-icon>
        回到首页
      </el-button>
      <el-button type="danger" plain @click="logout">
        <el-icon><SwitchButton /></el-icon>
        退出登录
      </el-button>
    </div>
  </section>
</template>
