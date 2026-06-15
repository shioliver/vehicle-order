<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { roleLabels, userNavByRole } from '@/auth/permissions';
import type { UserAccountRole } from '@/auth/permissions';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const currentRole = computed(() => auth.currentUser?.role as UserAccountRole | undefined);
const navs = computed(() => (currentRole.value ? userNavByRole[currentRole.value] : []));
const mobileNavs = navs;
const roleName = computed(() => (auth.currentUser ? roleLabels[auth.currentUser.role] : '用户'));

function logout() {
  auth.logout();
  router.push('/login');
}

function handleUserCommand(command: string) {
  if (command === 'profile') router.push('/user/profile');
  if (command === 'logout') logout();
}
</script>

<template>
  <div class="app-layout">
    <aside class="side-nav">
      <div class="brand">
        <span class="brand-mark">用</span>
        <span>用户端<span class="brand-subtitle">{{ roleName }}</span></span>
      </div>
      <nav class="nav-list">
        <router-link v-for="nav in navs" :key="nav.key" class="nav-link" :to="nav.to">
          <el-icon><component :is="nav.icon" /></el-icon>
          {{ nav.label }}
        </router-link>
      </nav>
      <div class="side-footer">客户查报告、租车下单，司机查看调度任务。</div>
    </aside>
    <section class="admin-stage">
      <header class="top-bar admin-top-bar user-top-bar">
        <div class="top-bar-title">
          <el-icon><User /></el-icon>
          <span>用户服务台<small>{{ roleName }}</small></span>
        </div>
        <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand">
          <button class="admin-user-trigger" type="button">
            <span class="admin-avatar">{{ auth.currentUser?.name?.slice(0, 1) || '用' }}</span>
            <span class="admin-user-meta">
              <strong>{{ auth.currentUser?.name }}</strong>
              <small>{{ roleName }}</small>
            </span>
            <el-icon><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="admin-user-menu">
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>
                个人中心
              </el-dropdown-item>
              <el-dropdown-item command="logout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>
      <main class="main-shell">
        <router-view />
      </main>
    </section>
    <nav class="mobile-tabs">
      <router-link v-for="nav in mobileNavs" :key="nav.key" :to="nav.to">
        <el-icon><component :is="nav.icon" /></el-icon>
        <span>{{ nav.label }}</span>
      </router-link>
    </nav>
  </div>
</template>
