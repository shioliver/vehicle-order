import type { RouteLocationRaw } from 'vue-router';
import type { UserRole } from '@/types/domain';

export type AppEntrance = 'admin' | 'user';

export type PermissionAction =
  | 'vehicle:create'
  | 'vehicle:update'
  | 'vehicle:delete'
  | 'vehicle:updateInspectionFields'
  | 'vehicle:updateOperationFields'
  | 'report:create'
  | 'report:update'
  | 'report:delete'
  | 'report:view'
  | 'inventory:create'
  | 'inventory:createFromInspection'
  | 'inventory:update'
  | 'inventory:delete'
  | 'rental:create'
  | 'rental:update'
  | 'rental:delete'
  | 'dispatch:create'
  | 'dispatch:update'
  | 'dispatch:delete'
  | 'driver:create'
  | 'driver:update'
  | 'driver:delete'
  | 'system:reset';

export interface AppNavItem {
  readonly to: RouteLocationRaw;
  readonly label: string;
  readonly icon: string;
  readonly key: string;
  readonly children?: ReadonlyArray<AppNavItem & { readonly tab?: string }>;
}

export type ManagementRole = Extract<UserRole, 'super_admin' | 'inspection_admin' | 'rental_admin'>;
export type UserAccountRole = Extract<UserRole, 'customer' | 'driver'>;
export type RoleHolder = { readonly role: UserRole; readonly status?: '启用' | '停用' };

export const managementRoles: readonly ManagementRole[] = ['super_admin', 'inspection_admin', 'rental_admin'];
export const userRoles: readonly UserAccountRole[] = ['customer', 'driver'];

export const roleLabels: Readonly<Record<UserRole, string>> = {
  super_admin: '超级管理员',
  inspection_admin: '检测管理员',
  rental_admin: '租赁调度管理员',
  customer: '租车客户',
  driver: '司机'
};

export const roleEntrances: Readonly<Record<UserRole, AppEntrance>> = {
  super_admin: 'admin',
  inspection_admin: 'admin',
  rental_admin: 'admin',
  customer: 'user',
  driver: 'user'
};

export const roleHome: Readonly<Record<UserRole, string>> = {
  super_admin: '/admin/dashboard',
  inspection_admin: '/admin/inspection',
  rental_admin: '/admin/dashboard',
  customer: '/user/home',
  driver: '/user/home'
};

export const dataCenterChildren: ReadonlyArray<AppNavItem & { tab: string }> = [
  { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '检测报告', icon: 'Document', key: 'data-reports', tab: 'reports' },
  { to: { path: '/admin/reports', query: { tab: 'inventory' } }, label: '入库流水', icon: 'Document', key: 'data-inventory', tab: 'inventory' },
  { to: { path: '/admin/reports', query: { tab: 'rentals' } }, label: '租赁订单', icon: 'Document', key: 'data-rentals', tab: 'rentals' },
  { to: { path: '/admin/reports', query: { tab: 'dispatch' } }, label: '调度任务', icon: 'Document', key: 'data-dispatch', tab: 'dispatch' },
  { to: { path: '/admin/reports', query: { tab: 'drivers' } }, label: '司机池', icon: 'Document', key: 'data-drivers', tab: 'drivers' }
];

export const adminNavByRole: Readonly<Record<ManagementRole, ReadonlyArray<AppNavItem>>> = {
  super_admin: [
    { to: '/admin/dashboard', label: '工作台', icon: 'DataBoard', key: 'dashboard' },
    { to: '/admin/vehicles', label: '车辆中心', icon: 'Van', key: 'vehicles' },
    { to: '/admin/inspection', label: '检测录入', icon: 'DocumentChecked', key: 'inspection' },
    { to: '/admin/inventory', label: '入库预备库', icon: 'House', key: 'inventory' },
    { to: '/admin/rentals', label: '租赁订单', icon: 'Tickets', key: 'rentals' },
    { to: '/admin/dispatch', label: '调度管理', icon: 'Guide', key: 'dispatch' },
    { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '数据中心', icon: 'Document', key: 'reports', children: dataCenterChildren },
    { to: '/admin/profile', label: '我的', icon: 'User', key: 'profile' }
  ],
  inspection_admin: [
    { to: '/admin/dashboard', label: '工作台', icon: 'DataBoard', key: 'dashboard' },
    { to: '/admin/vehicles', label: '车辆中心', icon: 'Van', key: 'vehicles' },
    { to: '/admin/inspection', label: '检测录入', icon: 'DocumentChecked', key: 'inspection' },
    { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '数据中心', icon: 'Document', key: 'reports', children: dataCenterChildren },
    { to: '/admin/profile', label: '我的', icon: 'User', key: 'profile' }
  ],
  rental_admin: [
    { to: '/admin/dashboard', label: '工作台', icon: 'DataBoard', key: 'dashboard' },
    { to: '/admin/vehicles', label: '车辆中心', icon: 'Van', key: 'vehicles' },
    { to: '/admin/inventory', label: '入库预备库', icon: 'House', key: 'inventory' },
    { to: '/admin/rentals', label: '租赁订单', icon: 'Tickets', key: 'rentals' },
    { to: '/admin/dispatch', label: '调度管理', icon: 'Guide', key: 'dispatch' },
    { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '数据中心', icon: 'Document', key: 'reports', children: dataCenterChildren },
    { to: '/admin/profile', label: '我的', icon: 'User', key: 'profile' }
  ]
};

export const adminMobileNavByRole: Readonly<Record<ManagementRole, ReadonlyArray<AppNavItem>>> = {
  super_admin: [
    { to: '/admin/dashboard', label: '首页', icon: 'HomeFilled', key: 'dashboard' },
    { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '数据', icon: 'Document', key: 'reports' },
    { to: '/admin/inspection', label: '检测', icon: 'DocumentChecked', key: 'inspection' },
    { to: '/admin/dispatch', label: '调度', icon: 'Guide', key: 'dispatch' },
    { to: '/admin/profile', label: '我的', icon: 'User', key: 'profile' }
  ],
  inspection_admin: [
    { to: '/admin/dashboard', label: '首页', icon: 'HomeFilled', key: 'dashboard' },
    { to: '/admin/inspection', label: '检测', icon: 'DocumentChecked', key: 'inspection' },
    { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '报告', icon: 'Document', key: 'reports' },
    { to: '/admin/vehicles', label: '车辆', icon: 'Van', key: 'vehicles' },
    { to: '/admin/profile', label: '我的', icon: 'User', key: 'profile' }
  ],
  rental_admin: [
    { to: '/admin/dashboard', label: '首页', icon: 'HomeFilled', key: 'dashboard' },
    { to: '/admin/inventory', label: '入库', icon: 'House', key: 'inventory' },
    { to: '/admin/rentals', label: '订单', icon: 'Tickets', key: 'rentals' },
    { to: '/admin/dispatch', label: '调度', icon: 'Guide', key: 'dispatch' },
    { to: '/admin/profile', label: '我的', icon: 'User', key: 'profile' }
  ]
};

export const userNavByRole: Readonly<Record<UserAccountRole, ReadonlyArray<AppNavItem>>> = {
  customer: [
    { to: '/user/home', label: '首页', icon: 'HomeFilled', key: 'home' },
    { to: '/user/rentals', label: '租车', icon: 'Van', key: 'rentals' },
    { to: '/user/publish', label: '发布', icon: 'Plus', key: 'publish' },
    { to: '/user/my-vehicles', label: '车辆', icon: 'Tickets', key: 'vehicles' },
    { to: '/user/profile', label: '我的', icon: 'User', key: 'profile' }
  ],
  driver: [
    { to: '/user/home', label: '首页', icon: 'HomeFilled', key: 'home' },
    { to: '/user/reports', label: '报告', icon: 'DocumentChecked', key: 'reports' },
    { to: '/user/orders', label: '订单', icon: 'Tickets', key: 'orders' },
    { to: '/user/driver', label: '任务', icon: 'Guide', key: 'driver' },
    { to: '/user/profile', label: '我的', icon: 'User', key: 'profile' }
  ]
};

export const actionPermissions: Readonly<Record<PermissionAction, readonly UserRole[]>> = {
  'vehicle:create': ['super_admin', 'inspection_admin', 'customer'],
  'vehicle:update': ['super_admin', 'customer'],
  'vehicle:delete': ['super_admin'],
  'vehicle:updateInspectionFields': ['super_admin', 'inspection_admin'],
  'vehicle:updateOperationFields': ['super_admin', 'rental_admin'],
  'report:create': ['super_admin', 'inspection_admin'],
  'report:update': ['super_admin', 'inspection_admin'],
  'report:delete': ['super_admin', 'inspection_admin'],
  'report:view': ['super_admin', 'inspection_admin', 'rental_admin', 'customer', 'driver'],
  'inventory:create': ['super_admin', 'rental_admin'],
  'inventory:createFromInspection': ['super_admin', 'inspection_admin'],
  'inventory:update': ['super_admin', 'rental_admin'],
  'inventory:delete': ['super_admin', 'rental_admin'],
  'rental:create': ['super_admin', 'rental_admin', 'customer'],
  'rental:update': ['super_admin', 'rental_admin', 'customer'],
  'rental:delete': ['super_admin', 'rental_admin'],
  'dispatch:create': ['super_admin', 'rental_admin'],
  'dispatch:update': ['super_admin', 'rental_admin', 'driver'],
  'dispatch:delete': ['super_admin', 'rental_admin'],
  'driver:create': ['super_admin', 'rental_admin'],
  'driver:update': ['super_admin', 'rental_admin'],
  'driver:delete': ['super_admin', 'rental_admin'],
  'system:reset': ['super_admin']
};

export function isManagementRole(role?: UserRole) {
  return !!role && managementRoles.some((item) => item === role);
}

export function isUserRole(role?: UserRole) {
  return !!role && userRoles.some((item) => item === role);
}

export function can(user: RoleHolder | null | undefined, action: PermissionAction) {
  return !!user && user.status !== '停用' && actionPermissions[action].includes(user.role);
}

export function requireAction(user: RoleHolder | null | undefined, action: PermissionAction) {
  if (!can(user, action)) throw new Error('当前账号无权限执行此操作');
}

export function getRoleHome(user: RoleHolder) {
  return roleHome[user.role];
}

export function getEntrance(user: RoleHolder) {
  return roleEntrances[user.role];
}
