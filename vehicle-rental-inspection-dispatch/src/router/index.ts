import { createRouter, createWebHistory } from 'vue-router';
import { getEntrance, getRoleHome, isManagementRole, isUserRole } from '@/auth/permissions';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types/domain';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/inspection-tool',
      name: 'inspection-tool',
      component: () => import('@/views/InspectionToolRedirectView.vue')
    },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { entrance: 'admin' },
      children: [
        { path: '', redirect: '/admin/dashboard' },
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/views/admin/DashboardView.vue') },
        { path: 'vehicles', name: 'admin-vehicles', component: () => import('@/views/admin/VehicleCenterView.vue') },
        { path: 'inspection', name: 'admin-inspection', component: () => import('@/views/admin/InspectionView.vue'), meta: { roles: ['super_admin', 'inspection_admin'] as UserRole[] } },
        { path: 'inventory', name: 'admin-inventory', component: () => import('@/views/admin/InventoryView.vue'), meta: { roles: ['super_admin', 'rental_admin'] as UserRole[] } },
        { path: 'rentals', name: 'admin-rentals', component: () => import('@/views/admin/RentalOrdersView.vue'), meta: { roles: ['super_admin', 'rental_admin'] as UserRole[] } },
        { path: 'dispatch', name: 'admin-dispatch', component: () => import('@/views/admin/DispatchView.vue'), meta: { roles: ['super_admin', 'rental_admin'] as UserRole[] } },
        { path: 'reports', name: 'admin-reports', component: () => import('@/views/admin/ReportsView.vue') },
        { path: 'profile', name: 'admin-profile', component: () => import('@/views/admin/AdminProfileView.vue') }
      ]
    },
    {
      path: '/user',
      component: () => import('@/layouts/UserLayout.vue'),
      meta: { entrance: 'user' },
      children: [
        { path: '', redirect: '/user/home' },
        { path: 'home', name: 'user-home', component: () => import('@/views/user/UserHomeView.vue') },
        { path: 'reports', name: 'user-reports', component: () => import('@/views/user/UserReportsView.vue'), meta: { roles: ['driver'] as UserRole[] } },
        { path: 'rentals', name: 'user-rentals', component: () => import('@/views/user/UserRentalsView.vue'), meta: { roles: ['customer'] as UserRole[] } },
        { path: 'publish', name: 'user-publish', component: () => import('@/views/user/UserPublishVehicleView.vue'), meta: { roles: ['customer'] as UserRole[] } },
        { path: 'my-vehicles', name: 'user-my-vehicles', component: () => import('@/views/user/UserVehiclesView.vue'), meta: { roles: ['customer'] as UserRole[] } },
        {
          path: 'rentals/:vehicleId/report/:timestamp',
          name: 'user-rental-report-link',
          component: () => import('@/views/user/TemporaryVehicleReportView.vue'),
          meta: { roles: ['customer'] as UserRole[] }
        },
        { path: 'orders', name: 'user-orders', component: () => import('@/views/user/UserOrdersView.vue'), meta: { roles: ['customer', 'driver'] as UserRole[] } },
        { path: 'driver', name: 'user-driver', component: () => import('@/views/user/DriverTasksView.vue'), meta: { roles: ['driver'] as UserRole[] } },
        { path: 'profile', name: 'user-profile', component: () => import('@/views/user/UserProfileView.vue') }
      ]
    }
  ]
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.path === '/login') return true;
  if (!auth.currentUser) return '/login';

  const entrance = to.matched.find((record) => record.meta.entrance)?.meta.entrance as 'admin' | 'user' | undefined;
  if (entrance && getEntrance(auth.currentUser) !== entrance) return getRoleHome(auth.currentUser);

  const requiredRoles = to.matched.flatMap((record) => (record.meta.roles as UserRole[] | undefined) ?? []);
  if (requiredRoles.length && !requiredRoles.includes(auth.currentUser.role)) return getRoleHome(auth.currentUser);

  if (to.path.startsWith('/admin') && !isManagementRole(auth.currentUser.role)) return getRoleHome(auth.currentUser);
  if (to.path.startsWith('/user') && !isUserRole(auth.currentUser.role)) return getRoleHome(auth.currentUser);

  return true;
});

export default router;
