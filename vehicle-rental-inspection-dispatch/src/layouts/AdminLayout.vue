<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adminMobileNavByRole, adminNavByRole, roleLabels } from '@/auth/permissions';
import type { ManagementRole } from '@/auth/permissions';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const currentRole = computed(() => auth.currentUser?.role as ManagementRole | undefined);
const navs = computed(() => (currentRole.value ? adminNavByRole[currentRole.value] : []));
const mobileNavs = computed(() => (currentRole.value ? adminMobileNavByRole[currentRole.value] : []));
const roleName = computed(() => (auth.currentUser ? roleLabels[auth.currentUser.role] : '管理员'));

function logout() {
  auth.logout();
  router.push('/login');
}

function handleUserCommand(command: string) {
  if (command === 'profile') router.push('/admin/profile');
  if (command === 'logout') logout();
}

function isDataCenterActive() {
  return route.path === '/admin/reports';
}

function isDataCenterChildActive(tab?: string) {
  return !!tab && isDataCenterActive() && String(route.query.tab || 'reports') === tab;
}
</script>

<template>
  <div class="app-layout">
    <aside class="side-nav">
      <div class="brand">
        <span class="brand-mark">车</span>
        <span>车检调度<span class="brand-subtitle">管理控制台</span></span>
      </div>
      <nav class="nav-list">
        <div v-for="nav in navs" :key="nav.key" class="nav-group" :class="{ 'is-open': nav.children && isDataCenterActive() }">
          <router-link class="nav-link" :class="{ 'router-link-active': nav.children && isDataCenterActive() }" :to="nav.to">
            <el-icon><component :is="nav.icon" /></el-icon>
            {{ nav.label }}
          </router-link>
          <div v-if="nav.children && isDataCenterActive()" class="nav-submenu">
            <router-link v-for="child in nav.children" :key="child.key" class="nav-sub-link" :class="{ active: isDataCenterChildActive(child.tab) }" :to="child.to">
              {{ child.label }}
            </router-link>
          </div>
        </div>
      </nav>
      <div class="side-footer">检测报告、车辆库存、租赁订单和网约车调度共用一套车辆档案。</div>
    </aside>
    <section class="admin-stage">
      <header class="top-bar admin-top-bar">
        <div class="top-bar-title">
          <el-icon><Monitor /></el-icon>
          <span>
            运营控制台
            <small>检测租赁调度一体化系统</small>
          </span>
        </div>
        <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand">
          <button class="admin-user-trigger" type="button">
            <span class="admin-avatar">{{ auth.currentUser?.name?.slice(0, 1) || '管' }}</span>
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
