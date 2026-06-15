<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { getRoleHome } from '@/auth/permissions';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({
  username: '',
  password: ''
});

async function submit() {
  loading.value = true;
  const ok = auth.login(form.username, form.password);
  loading.value = false;
  if (!ok) {
    ElMessage.error('账号或密码不正确');
    return;
  }
  router.push(auth.currentUser ? getRoleHome(auth.currentUser) : '/login');
}
</script>

<template>
  <div class="login-shell">
    <section class="login-brand" aria-hidden="true">
      <div class="login-glass-map">
        <span class="login-route-point start"></span>
        <span class="login-route-point mid"></span>
        <span class="login-route-point end"></span>
      </div>
      <div class="login-brand-copy">
        <span>City Drive</span>
        <h1>轻松上车</h1>
        <p>车辆、订单和行程都在一个入口里。</p>
      </div>
    </section>
    <section class="login-panel" aria-label="用户登录">
      <el-form class="login-card" :model="form" label-position="top" @keyup.enter="submit">
        <div class="login-app-mark">
          <el-icon><Van /></el-icon>
        </div>
        <span class="login-kicker">用户端 App</span>
        <h2>欢迎回来</h2>
        <p>登录后继续查看车辆、订单和检测报告。</p>
        <el-form-item label="账号">
          <el-input v-model="form.username" size="large" placeholder="请输入账号" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" size="large" type="password" show-password placeholder="请输入密码" autocomplete="current-password" />
        </el-form-item>
        <el-button class="login-submit" type="primary" size="large" :loading="loading" @click="submit">
          <el-icon><Right /></el-icon>
          登录
        </el-button>
      </el-form>
    </section>
  </div>
</template>
