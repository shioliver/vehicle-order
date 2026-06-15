# Role Permission Shared Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centralized role-permission system for the shared used-car inspection/rental and ride-hailing dispatch platform, including role-aware PC/mobile menus, guarded data mutations, and customer temporary vehicle report links.

**Architecture:** Keep the current `/admin` and `/user` entrances, but replace the two-role model with five roles and a central permission config. Route guards, layouts, page buttons, and store/repository mutations should all consume the same permission vocabulary so PC and mobile behavior stays consistent.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Pinia, Element Plus, current localStorage-backed `fleetRepository` with existing SQLite scaffold preserved.

---

## File Structure

- Modify `src/types/domain.ts`: expand `UserRole`, add optional user status and driver account linkage.
- Create `src/auth/permissions.ts`: central roles, route groups, menu config, action permissions, helper functions.
- Create `src/auth/session.ts`: shared auth storage key and current-user access helpers for route guards and repository enforcement.
- Modify `src/stores/auth.ts`: use shared session helpers and new role redirects.
- Modify `src/db/seed.ts`: add demo users for all five roles and link driver account to driver data.
- Modify `src/router/index.ts`: add role-aware route metadata and temporary report route.
- Modify `src/layouts/AdminLayout.vue`: generate PC sidebar and mobile tabs from permission config.
- Modify `src/layouts/UserLayout.vue`: generate PC sidebar and mobile tabs from permission config.
- Modify `src/stores/fleet.ts`: call repository methods with the current actor where mutation permissions are needed.
- Modify `src/db/fleetRepository.ts`: enforce mutation permissions centrally and keep data integrity checks.
- Modify admin pages: `VehicleCenterView.vue`, `InspectionView.vue`, `InventoryView.vue`, `RentalOrdersView.vue`, `DispatchView.vue`, `ReportsView.vue`.
- Modify user pages: `UserHomeView.vue`, `UserRentalsView.vue`, `UserOrdersView.vue`, `DriverTasksView.vue`, `UserReportsView.vue`, `UserProfileView.vue`.
- Create `src/views/user/TemporaryVehicleReportView.vue`: 30-minute read-only report route.
- Modify `src/views/LoginView.vue`: demo account shortcuts for the five roles.
- Modify `src/styles/theme.css`: small styles for role-aware navigation and temporary report states if needed.

---

### Task 1: Role Types, Session Helpers, And Permission Config

**Files:**
- Modify: `src/types/domain.ts`
- Create: `src/auth/session.ts`
- Create: `src/auth/permissions.ts`
- Modify: `src/db/seed.ts`
- Modify: `src/views/LoginView.vue`

- [ ] **Step 1: Expand domain roles**

In `src/types/domain.ts`, replace:

```ts
export type UserRole = 'admin' | 'user';
```

with:

```ts
export type UserRole = 'super_admin' | 'inspection_admin' | 'rental_admin' | 'customer' | 'driver';

export type UserStatus = '启用' | '停用';
```

Then update `AppUser`:

```ts
export interface AppUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone: string;
  status?: UserStatus;
}
```

Update `Driver` to allow account linkage:

```ts
export interface Driver {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  licenseNo: string;
  status: '空闲' | '出车中' | '休息' | '停用';
}
```

- [ ] **Step 2: Run type check and confirm expected failures**

Run:

```bash
npm run build
```

Expected: FAIL because `admin` and `user` literals in router, auth, login, and seed no longer match `UserRole`.

- [ ] **Step 3: Add session helpers**

Create `src/auth/session.ts`:

```ts
import type { AppUser } from '@/types/domain';

export const AUTH_KEY = 'vehicle-fleet-auth-v1';

export function readCurrentUser(): AppUser | null {
  return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') as AppUser | null;
}

export function writeCurrentUser(user: AppUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  localStorage.removeItem(AUTH_KEY);
}
```

- [ ] **Step 4: Add permission config**

Create `src/auth/permissions.ts`:

```ts
import type { RouteLocationRaw } from 'vue-router';
import type { AppUser, UserRole } from '@/types/domain';

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
  | 'driver:delete';

export interface AppNavItem {
  to: RouteLocationRaw;
  label: string;
  icon: string;
  key: string;
  children?: Array<AppNavItem & { tab?: string }>;
}

const managementRoles: UserRole[] = ['super_admin', 'inspection_admin', 'rental_admin'];
const userRoles: UserRole[] = ['customer', 'driver'];

export const roleLabels: Record<UserRole, string> = {
  super_admin: '超级管理员',
  inspection_admin: '检测管理员',
  rental_admin: '租赁调度管理员',
  customer: '租车客户',
  driver: '司机'
};

export const roleEntrances: Record<UserRole, AppEntrance> = {
  super_admin: 'admin',
  inspection_admin: 'admin',
  rental_admin: 'admin',
  customer: 'user',
  driver: 'user'
};

export const roleHome: Record<UserRole, string> = {
  super_admin: '/admin/dashboard',
  inspection_admin: '/admin/inspection',
  rental_admin: '/admin/dashboard',
  customer: '/user/home',
  driver: '/user/driver'
};

const dataCenterChildren = [
  { to: { path: '/admin/reports', query: { tab: 'reports' } }, label: '检测报告', icon: 'Document', key: 'data-reports', tab: 'reports' },
  { to: { path: '/admin/reports', query: { tab: 'inventory' } }, label: '入库流水', icon: 'Document', key: 'data-inventory', tab: 'inventory' },
  { to: { path: '/admin/reports', query: { tab: 'rentals' } }, label: '租赁订单', icon: 'Document', key: 'data-rentals', tab: 'rentals' },
  { to: { path: '/admin/reports', query: { tab: 'dispatch' } }, label: '调度任务', icon: 'Document', key: 'data-dispatch', tab: 'dispatch' },
  { to: { path: '/admin/reports', query: { tab: 'drivers' } }, label: '司机池', icon: 'Document', key: 'data-drivers', tab: 'drivers' }
];

export const adminNavByRole: Record<Extract<UserRole, 'super_admin' | 'inspection_admin' | 'rental_admin'>, AppNavItem[]> = {
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

export const adminMobileNavByRole: typeof adminNavByRole = {
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

export const userNavByRole: Record<Extract<UserRole, 'customer' | 'driver'>, AppNavItem[]> = {
  customer: [
    { to: '/user/home', label: '首页', icon: 'HomeFilled', key: 'home' },
    { to: '/user/rentals', label: '租车', icon: 'Van', key: 'rentals' },
    { to: '/user/orders', label: '订单', icon: 'Tickets', key: 'orders' },
    { to: '/user/reports', label: '报告', icon: 'DocumentChecked', key: 'reports' },
    { to: '/user/profile', label: '我的', icon: 'User', key: 'profile' }
  ],
  driver: [
    { to: '/user/home', label: '首页', icon: 'HomeFilled', key: 'home' },
    { to: '/user/driver', label: '任务', icon: 'Guide', key: 'driver' },
    { to: '/user/profile', label: '我的', icon: 'User', key: 'profile' }
  ]
};

export const actionPermissions: Record<PermissionAction, UserRole[]> = {
  'vehicle:create': ['super_admin', 'inspection_admin'],
  'vehicle:update': ['super_admin'],
  'vehicle:delete': ['super_admin'],
  'vehicle:updateInspectionFields': ['super_admin', 'inspection_admin'],
  'vehicle:updateOperationFields': ['super_admin', 'rental_admin'],
  'report:create': ['super_admin', 'inspection_admin'],
  'report:update': ['super_admin', 'inspection_admin'],
  'report:delete': ['super_admin', 'inspection_admin'],
  'report:view': ['super_admin', 'inspection_admin', 'rental_admin', 'customer'],
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
  'driver:delete': ['super_admin', 'rental_admin']
};

export function isManagementRole(role?: UserRole) {
  return !!role && managementRoles.includes(role);
}

export function isUserRole(role?: UserRole) {
  return !!role && userRoles.includes(role);
}

export function can(user: AppUser | null | undefined, action: PermissionAction) {
  return !!user && actionPermissions[action].includes(user.role);
}

export function requireAction(user: AppUser | null | undefined, action: PermissionAction) {
  if (!can(user, action)) throw new Error('当前账号无权限执行此操作');
}

export function getRoleHome(user: AppUser) {
  return roleHome[user.role];
}

export function getEntrance(user: AppUser) {
  return roleEntrances[user.role];
}
```

- [ ] **Step 5: Update seed users**

In `src/db/seed.ts`, replace the `users` array with:

```ts
users: [
  { id: 'u-super', username: 'admin', password: '123456', name: '超级管理员', role: 'super_admin', phone: '13800000001', status: '启用' },
  { id: 'u-inspection-admin', username: 'inspector', password: '123456', name: '检测管理员', role: 'inspection_admin', phone: '13800000011', status: '启用' },
  { id: 'u-rental-admin', username: 'rentaladmin', password: '123456', name: '租赁调度管理员', role: 'rental_admin', phone: '13800000012', status: '启用' },
  { id: 'u-user', username: 'user', password: '123456', name: '租车客户', role: 'customer', phone: '13800000002', status: '启用' },
  { id: 'u-driver', username: 'driver', password: '123456', name: '网约车司机', role: 'driver', phone: '13800000003', status: '启用' }
],
```

Find driver `d-001` and add:

```ts
userId: 'u-driver',
```

- [ ] **Step 6: Update login shortcuts**

In `src/views/LoginView.vue`, update `fill`:

```ts
function fill(role: 'admin' | 'inspector' | 'rentaladmin' | 'user' | 'driver') {
  form.username = role;
  form.password = '123456';
}
```

Update the redirect in `submit`:

```ts
import { getRoleHome } from '@/auth/permissions';
```

```ts
router.push(auth.currentUser ? getRoleHome(auth.currentUser) : '/login');
```

Update the helper text:

```html
<p style="color: var(--muted); margin-top: -4px">演示账号：admin / inspector / rentaladmin / user / driver，密码均为 123456</p>
```

Update quick buttons:

```html
<el-button @click="fill('admin')">超级管理员</el-button>
<el-button @click="fill('inspector')">检测管理员</el-button>
<el-button @click="fill('rentaladmin')">租赁调度管理员</el-button>
<el-button @click="fill('user')">租车用户</el-button>
<el-button @click="fill('driver')">司机用户</el-button>
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: FAIL only on router/auth role checks that still assume `admin` and `user`. Those failures are addressed in Task 2.

---

### Task 2: Auth Store And Route Guards

**Files:**
- Modify: `src/stores/auth.ts`
- Modify: `src/router/index.ts`

- [ ] **Step 1: Update auth store to use session helpers**

Replace the top of `src/stores/auth.ts` with:

```ts
import { defineStore } from 'pinia';
import { fleetRepository } from '@/db/fleetRepository';
import { AUTH_KEY, clearCurrentUser, readCurrentUser, writeCurrentUser } from '@/auth/session';
import type { AppUser } from '@/types/domain';
```

Replace `currentUser` initialization:

```ts
currentUser: readCurrentUser() as AppUser | null
```

Replace login persistence:

```ts
this.currentUser = user;
writeCurrentUser(user);
```

Replace logout:

```ts
this.currentUser = null;
clearCurrentUser();
```

Remove direct `localStorage` usage from `auth.ts`. `AUTH_KEY` may remain imported only if TypeScript reports it is used; otherwise remove it.

- [ ] **Step 2: Add route metadata vocabulary**

In `src/router/index.ts`, import:

```ts
import { can, getEntrance, getRoleHome, isManagementRole, isUserRole } from '@/auth/permissions';
import type { PermissionAction, UserRole } from '@/auth/permissions';
```

If `PermissionAction` is not exported as type from the module path after Step 1, import it from `@/auth/permissions`.

- [ ] **Step 3: Update route meta**

For `/admin`, replace `meta: { role: 'admin' }` with:

```ts
meta: { entrance: 'admin' }
```

For `/user`, replace `meta: { role: 'user' }` with:

```ts
meta: { entrance: 'user' }
```

Add route-level required roles to children:

```ts
{ path: 'inspection', name: 'admin-inspection', component: () => import('@/views/admin/InspectionView.vue'), meta: { roles: ['super_admin', 'inspection_admin'] as UserRole[] } },
{ path: 'inventory', name: 'admin-inventory', component: () => import('@/views/admin/InventoryView.vue'), meta: { roles: ['super_admin', 'rental_admin'] as UserRole[] } },
{ path: 'rentals', name: 'admin-rentals', component: () => import('@/views/admin/RentalOrdersView.vue'), meta: { roles: ['super_admin', 'rental_admin'] as UserRole[] } },
{ path: 'dispatch', name: 'admin-dispatch', component: () => import('@/views/admin/DispatchView.vue'), meta: { roles: ['super_admin', 'rental_admin'] as UserRole[] } },
```

Leave `/admin/dashboard`, `/admin/vehicles`, `/admin/reports`, and `/admin/profile` accessible to all management roles.

For `/user/driver`, add:

```ts
meta: { roles: ['driver'] as UserRole[] }
```

For `/user/rentals` and `/user/orders`, add:

```ts
meta: { roles: ['customer'] as UserRole[] }
```

- [ ] **Step 4: Add temporary report route**

Inside `/user` children, add:

```ts
{
  path: 'rentals/:vehicleId/report/:timestamp',
  name: 'user-rental-report-link',
  component: () => import('@/views/user/TemporaryVehicleReportView.vue'),
  meta: { roles: ['customer'] as UserRole[] }
},
```

The component is created in Task 6.

- [ ] **Step 5: Replace route guard**

Replace the `beforeEach` body with:

```ts
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
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: FAIL because layouts still use hard-coded menus and old role labels. Task 3 resolves this.

---

### Task 3: Role-Aware Admin And User Layout Navigation

**Files:**
- Modify: `src/layouts/AdminLayout.vue`
- Modify: `src/layouts/UserLayout.vue`
- Modify: `src/styles/theme.css` if spacing breaks.

- [ ] **Step 1: Replace admin hard-coded navs**

In `src/layouts/AdminLayout.vue`, import:

```ts
import { computed } from 'vue';
import { adminMobileNavByRole, adminNavByRole, roleLabels } from '@/auth/permissions';
import type { UserRole } from '@/types/domain';
```

Replace hard-coded `navs` and `mobileNavs` with:

```ts
const currentRole = computed(() => auth.currentUser?.role as Extract<UserRole, 'super_admin' | 'inspection_admin' | 'rental_admin'> | undefined);
const navs = computed(() => (currentRole.value ? adminNavByRole[currentRole.value] : []));
const mobileNavs = computed(() => (currentRole.value ? adminMobileNavByRole[currentRole.value] : []));
const roleName = computed(() => (auth.currentUser ? roleLabels[auth.currentUser.role] : '管理员'));
```

Update template loops from `v-for="nav in navs"` to keep working with computed refs. Vue unwraps computed refs in templates, so no `.value` is needed.

Replace fixed `系统管理员` text with:

```html
<small>{{ roleName }}</small>
```

- [ ] **Step 2: Keep data center active helpers**

Keep:

```ts
function isDataCenterActive() {
  return route.path === '/admin/reports';
}

function isDataCenterChildActive(tab: string) {
  return isDataCenterActive() && String(route.query.tab || 'reports') === tab;
}
```

If TypeScript complains that `tab` might be undefined, change it to:

```ts
function isDataCenterChildActive(tab?: string) {
  return !!tab && isDataCenterActive() && String(route.query.tab || 'reports') === tab;
}
```

- [ ] **Step 3: Replace user hard-coded navs**

In `src/layouts/UserLayout.vue`, import:

```ts
import { computed } from 'vue';
import { roleLabels, userNavByRole } from '@/auth/permissions';
import type { UserRole } from '@/types/domain';
```

Replace hard-coded `navs` and `mobileNavs` with:

```ts
const currentRole = computed(() => auth.currentUser?.role as Extract<UserRole, 'customer' | 'driver'> | undefined);
const navs = computed(() => (currentRole.value ? userNavByRole[currentRole.value] : []));
const mobileNavs = navs;
const roleName = computed(() => (auth.currentUser ? roleLabels[auth.currentUser.role] : '用户'));
```

Replace the sidebar subtitle:

```html
<span>用户端<span class="brand-subtitle">{{ roleName }}</span></span>
```

Replace top-bar small text:

```html
<span>用户服务台<small>{{ roleName }}</small></span>
```

Replace trigger small text:

```html
<small>{{ roleName }}</small>
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS or only errors from permission-enforcement imports not yet introduced. Fix any typing errors in `permissions.ts` before moving on.

- [ ] **Step 5: Manual browser check**

With dev server running at `http://localhost:5173/`, log in with:

- `admin / 123456`: sees all admin menus.
- `inspector / 123456`: sees inspection-focused admin menus.
- `rentaladmin / 123456`: sees rental/dispatch-focused admin menus.
- `user / 123456`: sees customer user menus.
- `driver / 123456`: sees driver user menus.

Expected: each account lands on the correct home page and no old `admin/user` role label is visible in the top user trigger.

---

### Task 4: Repository And Store Mutation Permission Enforcement

**Files:**
- Modify: `src/db/fleetRepository.ts`
- Modify: `src/stores/fleet.ts`

- [ ] **Step 1: Import session and permission helpers into repository**

At the top of `src/db/fleetRepository.ts`, add:

```ts
import { readCurrentUser } from '@/auth/session';
import { requireAction, type PermissionAction } from '@/auth/permissions';
```

Add this helper near the top-level constants:

```ts
function assertAction(action: PermissionAction) {
  requireAction(readCurrentUser(), action);
}
```

- [ ] **Step 2: Guard vehicle mutations**

At the start of `upsertVehicle`, after `const data = this.load();`, add:

```ts
assertAction(input.id ? 'vehicle:update' : 'vehicle:create');
```

At the start of `deleteVehicle`, add:

```ts
assertAction('vehicle:delete');
```

If this blocks `inspection_admin` from editing inspection-related fields through existing vehicle forms, page-level work in Task 5 should avoid showing generic vehicle edit for that role. Full field-level split can be added later when the vehicle form is split into inspection and operation sections.

- [ ] **Step 3: Guard report mutations**

At the start of `updateReport`, add:

```ts
assertAction('report:update');
```

At the start of `deleteReport`, add:

```ts
assertAction('report:delete');
```

At the start of `createInspection`, add:

```ts
assertAction('report:create');
```

- [ ] **Step 4: Guard inventory mutations**

At the start of `stockIn`, add:

```ts
assertAction('inventory:create');
```

At the start of `upsertInventoryRecord`, add:

```ts
assertAction(input.id ? 'inventory:update' : 'inventory:create');
```

At the start of `deleteInventoryRecord`, add:

```ts
assertAction('inventory:delete');
```

Inside `createInspection`, auto-stock-in must remain allowed for `inspection_admin`. Do not call `stockIn` from `createInspection`; the current inline inventory record creation is correct. The `createInspection` permission covers this approved flow.

- [ ] **Step 5: Guard rental mutations**

At the start of `createRentalOrder`, add:

```ts
assertAction('rental:create');
```

At the start of `upsertRentalOrder`, add:

```ts
assertAction(order.id ? 'rental:update' : 'rental:create');
```

At the start of `deleteRentalOrder`, add:

```ts
assertAction('rental:delete');
```

When a customer updates their own order status, this broad `rental:update` is allowed. Task 5 will keep customer status actions constrained to cancel/request return.

- [ ] **Step 6: Guard dispatch and driver mutations**

At the start of `createDispatchTask`, add:

```ts
assertAction('dispatch:create');
```

At the start of `upsertDispatchTask`, add:

```ts
assertAction(task.id ? 'dispatch:update' : 'dispatch:create');
```

At the start of `deleteDispatchTask`, add:

```ts
assertAction('dispatch:delete');
```

At the start of `upsertDriver`, add:

```ts
assertAction(driver.id ? 'driver:update' : 'driver:create');
```

At the start of `deleteDriver`, add:

```ts
assertAction('driver:delete');
```

- [ ] **Step 7: Build and inspect permission failures**

Run:

```bash
npm run build
```

Expected: PASS. If build fails because any function parameter name differs from the snippets, use the actual parameter names from `fleetRepository.ts` and keep the same permission action mapping.

- [ ] **Step 8: Manual permission smoke test**

Start dev server and test:

```bash
npm run dev -- --host 0.0.0.0
```

Manual checks:

- Login `inspector`, then open `/admin/rentals`; expected route redirects to inspection/admin home.
- Login `rentaladmin`, then open `/admin/inspection`; expected route redirects to rental/admin home.
- Login `user`, then open `/admin/dashboard`; expected route redirects to `/user/home`.
- Login `driver`, then open `/user/rentals`; expected route redirects to `/user/driver`.

---

### Task 5: Page-Level Button And Data Filtering Permissions

**Files:**
- Modify: `src/views/admin/VehicleCenterView.vue`
- Modify: `src/views/admin/InspectionView.vue`
- Modify: `src/views/admin/InventoryView.vue`
- Modify: `src/views/admin/RentalOrdersView.vue`
- Modify: `src/views/admin/DispatchView.vue`
- Modify: `src/views/admin/ReportsView.vue`
- Modify: `src/views/user/UserOrdersView.vue`
- Modify: `src/views/user/DriverTasksView.vue`
- Modify: `src/views/user/UserHomeView.vue`
- Modify: `src/views/user/UserProfileView.vue`

- [ ] **Step 1: Add page permission computed values**

In each page that shows mutation buttons, add imports:

```ts
import { computed } from 'vue';
import { can } from '@/auth/permissions';
import { useAuthStore } from '@/stores/auth';
```

If the page already imports `computed`, only add `can` and `useAuthStore`.

Add:

```ts
const auth = useAuthStore();
```

Then add page-specific booleans. For `ReportsView.vue`:

```ts
const canCreateReport = computed(() => can(auth.currentUser, 'report:create'));
const canUpdateReport = computed(() => can(auth.currentUser, 'report:update'));
const canDeleteReport = computed(() => can(auth.currentUser, 'report:delete'));
const canCreateInventory = computed(() => can(auth.currentUser, 'inventory:create'));
const canUpdateInventory = computed(() => can(auth.currentUser, 'inventory:update'));
const canDeleteInventory = computed(() => can(auth.currentUser, 'inventory:delete'));
const canCreateRental = computed(() => can(auth.currentUser, 'rental:create'));
const canUpdateRental = computed(() => can(auth.currentUser, 'rental:update'));
const canDeleteRental = computed(() => can(auth.currentUser, 'rental:delete'));
const canCreateDispatch = computed(() => can(auth.currentUser, 'dispatch:create'));
const canUpdateDispatch = computed(() => can(auth.currentUser, 'dispatch:update'));
const canDeleteDispatch = computed(() => can(auth.currentUser, 'dispatch:delete'));
const canCreateDriver = computed(() => can(auth.currentUser, 'driver:create'));
const canUpdateDriver = computed(() => can(auth.currentUser, 'driver:update'));
const canDeleteDriver = computed(() => can(auth.currentUser, 'driver:delete'));
```

- [ ] **Step 2: Hide admin create buttons**

Examples:

In `InspectionView.vue`, show generate report actions only when:

```html
v-if="canCreateReport"
```

In `InventoryView.vue`, show stock-in and edit/delete buttons only when the matching inventory permissions are true:

```html
<el-button v-if="canCreateInventory" type="primary" @click="openCreate">新增入库</el-button>
<el-button v-if="canUpdateInventory" @click="openEdit(row)">编辑</el-button>
<el-button v-if="canDeleteInventory" type="danger" @click="remove(row)">删除</el-button>
```

Use the actual local function names in each file.

- [ ] **Step 3: Hide data center row actions by active tab**

In `ReportsView.vue`, bind each action button to the matching boolean:

```html
<el-button v-if="canUpdateReport" size="small" @click="openEditReport(row)">编辑</el-button>
<el-button v-if="canDeleteReport" size="small" type="danger" @click="removeReport(row)">删除</el-button>
```

For inventory:

```html
<el-button v-if="canUpdateInventory" size="small" @click="openEditInventory(row)">编辑</el-button>
<el-button v-if="canDeleteInventory" size="small" type="danger" @click="removeInventory(row)">删除</el-button>
```

For rental, dispatch, and driver tabs, use the matching `canUpdate*` and `canDelete*` booleans.

Keep preview buttons visible for read-only roles.

- [ ] **Step 4: Filter customer and driver data**

In `UserOrdersView.vue`, filter orders to the logged-in customer:

```ts
const orders = computed(() =>
  fleet.data.rentalOrders.filter((item) => item.userId === auth.currentUser?.id)
);
```

If the page already has keyword filtering, compose both filters:

```ts
const orders = computed(() =>
  fleet.data.rentalOrders.filter((item) => {
    const ownOrder = item.userId === auth.currentUser?.id;
    const keywordText = `${item.orderNo}${fleet.vehicleName(item.vehicleId)}${item.customerName}${item.status}`;
    return ownOrder && keywordText.includes(keyword.value.trim());
  })
);
```

In `DriverTasksView.vue`, find the driver record:

```ts
const currentDriver = computed(() => fleet.data.drivers.find((driver) => driver.userId === auth.currentUser?.id || driver.phone === auth.currentUser?.phone));
```

Filter tasks:

```ts
const tasks = computed(() =>
  fleet.data.dispatchTasks.filter((task) => task.driverId === currentDriver.value?.id)
);
```

- [ ] **Step 5: Remove customer access to driver task shortcuts**

In `UserHomeView.vue` and `UserProfileView.vue`, use:

```ts
const isDriver = computed(() => auth.currentUser?.role === 'driver');
const isCustomer = computed(() => auth.currentUser?.role === 'customer');
```

Show customer rental/order/report shortcuts only for `isCustomer`. Show driver task shortcuts only for `isDriver`.

- [ ] **Step 6: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Manual role checks**

Manual checks:

- `inspector` can open data center and preview rental/dispatch data but sees no edit/delete/create buttons for rental/dispatch/driver modules.
- `rentaladmin` can preview inspection reports but sees no edit/delete buttons for reports.
- `user` sees no task menu.
- `driver` sees no rental/order/report menus except profile/home as configured.

---

### Task 6: Customer Temporary Vehicle Report Link

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/views/user/UserRentalsView.vue`
- Create: `src/views/user/TemporaryVehicleReportView.vue`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Add route if not already added**

Confirm `src/router/index.ts` contains this child route under `/user`:

```ts
{
  path: 'rentals/:vehicleId/report/:timestamp',
  name: 'user-rental-report-link',
  component: () => import('@/views/user/TemporaryVehicleReportView.vue'),
  meta: { roles: ['customer'] as UserRole[] }
},
```

- [ ] **Step 2: Add report link action to rental cards**

In `src/views/user/UserRentalsView.vue`, import:

```ts
import { useRouter } from 'vue-router';
```

Add:

```ts
const router = useRouter();

function openVehicleReport(vehicleId: string) {
  router.push(`/user/rentals/${vehicleId}/report/${Date.now()}`);
}

function hasVehicleReport(vehicleId: string) {
  return fleet.data.reports.some((report) => report.vehicleId === vehicleId);
}
```

On each rental vehicle card, add:

```html
<el-button v-if="hasVehicleReport(vehicle.id)" plain @click="openVehicleReport(vehicle.id)">查看检测报告</el-button>
```

Use the local vehicle loop variable name from the existing file.

- [ ] **Step 3: Create temporary report view**

Create `src/views/user/TemporaryVehicleReportView.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReportPreview from '@/components/ReportPreview.vue';
import { useFleetStore } from '@/stores/fleet';

const route = useRoute();
const router = useRouter();
const fleet = useFleetStore();
const vehicleId = computed(() => String(route.params.vehicleId || ''));
const timestamp = computed(() => Number(route.params.timestamp || 0));
const now = Date.now();
const expiresInMs = 30 * 60 * 1000;

const isExpired = computed(() => !timestamp.value || Math.abs(now - timestamp.value) > expiresInMs);
const vehicle = computed(() => fleet.data.vehicles.find((item) => item.id === vehicleId.value));
const report = computed(() => {
  if (!vehicle.value?.lastInspectionId) {
    return fleet.data.reports.find((item) => item.vehicleId === vehicleId.value);
  }
  return fleet.data.reports.find((item) => item.id === vehicle.value?.lastInspectionId);
});

function backToRentals() {
  router.push('/user/rentals');
}
</script>

<template>
  <div class="temporary-report-page">
    <button class="floating-back" type="button" @click="backToRentals">
      <el-icon><ArrowLeft /></el-icon>
    </button>

    <section v-if="isExpired" class="panel temporary-report-state">
      <h1>报告链接已过期</h1>
      <p>检测报告临时链接有效期为 30 分钟，请回到租车页面重新打开。</p>
      <el-button type="primary" @click="backToRentals">返回租车</el-button>
    </section>

    <section v-else-if="!vehicle || !report" class="panel temporary-report-state">
      <h1>暂无检测报告</h1>
      <p>这辆车还没有可查看的检测报告。</p>
      <el-button type="primary" @click="backToRentals">返回租车</el-button>
    </section>

    <section v-else class="panel temporary-report-panel">
      <div class="temporary-report-head">
        <div>
          <h1>车辆检测报告</h1>
          <p>{{ vehicle.plateNo }} {{ vehicle.brandModel }}</p>
        </div>
        <el-button plain @click="backToRentals">返回租车</el-button>
      </div>
      <ReportPreview :report="report" :vehicle="vehicle" compact-normal-sections />
    </section>
  </div>
</template>
```

- [ ] **Step 4: Add compact styles**

In `src/styles/theme.css`, add:

```css
.temporary-report-page {
  display: grid;
  gap: 16px;
}

.temporary-report-panel,
.temporary-report-state {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

.temporary-report-state {
  min-height: 320px;
  display: grid;
  place-items: center;
  text-align: center;
  align-content: center;
  gap: 12px;
}

.temporary-report-state h1,
.temporary-report-head h1 {
  margin: 0;
  font-size: 28px;
}

.temporary-report-state p,
.temporary-report-head p {
  margin: 0;
  color: var(--muted);
}

.temporary-report-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

@media (max-width: 768px) {
  .temporary-report-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
```

- [ ] **Step 5: Build and manual expiry check**

Run:

```bash
npm run build
```

Expected: PASS.

Manual checks:

- Login `user`.
- Open `/user/rentals`.
- Click `查看检测报告` on a vehicle with a report.
- Expected: report opens and shows read-only preview.
- Change the URL timestamp to a value older than 30 minutes, for example subtract `1800001`.
- Expected: page shows expired state.

---

### Task 7: Role-Specific Dashboard And Mobile UX Cleanup

**Files:**
- Modify: `src/views/admin/DashboardView.vue`
- Modify: `src/views/user/UserHomeView.vue`
- Modify: `src/views/user/UserProfileView.vue`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Add role-aware dashboard sections**

In `DashboardView.vue`, import auth and role helpers:

```ts
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
```

Add:

```ts
const auth = useAuthStore();
const isSuperAdmin = computed(() => auth.currentUser?.role === 'super_admin');
const isInspectionAdmin = computed(() => auth.currentUser?.role === 'inspection_admin');
const isRentalAdmin = computed(() => auth.currentUser?.role === 'rental_admin');
```

Use existing metric values and show sections conditionally:

```html
<section v-if="isInspectionAdmin" class="panel">
  <h2 class="panel-title">检测工作台</h2>
  <!-- show待检测车辆、今日报告、异常报告、自动入库结果 -->
</section>
<section v-else-if="isRentalAdmin" class="panel">
  <h2 class="panel-title">租赁调度工作台</h2>
  <!-- show预备库、可租车辆、进行中订单、调度任务、司机状态 -->
</section>
<section v-else class="panel">
  <h2 class="panel-title">全局运营工作台</h2>
  <!-- keep existing global dashboard content -->
</section>
```

Use concrete existing cards and computed metrics already in the file; do not add new data fields unless the values can be computed from `fleet.data`.

- [ ] **Step 2: Split user home by customer/driver**

In `UserHomeView.vue`, show:

```html
<template v-if="auth.currentUser?.role === 'driver'">
  <!-- driver carousel, task summary, assigned task cards -->
</template>
<template v-else>
  <!-- customer carousel, rentable vehicle summary, order summary, report summary -->
</template>
```

Reuse existing carousel/card components from the file. Keep changes scoped to conditional content and navigation target differences.

- [ ] **Step 3: Profile page role actions**

In `UserProfileView.vue`, conditionally show:

For customer:

```html
<router-link to="/user/rentals">租车服务</router-link>
<router-link to="/user/orders">我的订单</router-link>
<router-link to="/user/reports">检测报告</router-link>
```

For driver:

```html
<router-link to="/user/driver">我的任务</router-link>
```

Keep profile/logout actions common.

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Mobile visual check**

In browser responsive mode, check widths around:

- 390x844
- 768x1024
- 1440x900

Expected:

- Admin mobile bottom nav uses role-aware entries.
- Customer mobile bottom nav has no driver task entry.
- Driver mobile bottom nav has no rental/order/report customer entries.
- No table forces horizontal scrolling on primary mobile flows touched by this task.

---

### Task 8: Final Verification

**Files:**
- No planned source changes unless verification finds defects.

- [ ] **Step 1: Full build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 2: Role login matrix**

Manual test:

| Username | Expected route | Expected role label |
| --- | --- | --- |
| `admin` | `/admin/dashboard` | 超级管理员 |
| `inspector` | `/admin/inspection` | 检测管理员 |
| `rentaladmin` | `/admin/dashboard` | 租赁调度管理员 |
| `user` | `/user/home` | 租车客户 |
| `driver` | `/user/driver` | 司机 |

- [ ] **Step 3: Permission matrix**

Manual test:

- `inspector` can create an inspection report.
- `inspector` cannot open `/admin/rentals`.
- `inspector` can view data center rental/dispatch tabs but cannot edit/delete rows there.
- `rentaladmin` can create inventory, rental order, dispatch task, and driver.
- `rentaladmin` cannot open `/admin/inspection`.
- `rentaladmin` can view report preview but cannot edit/delete inspection reports.
- `user` cannot open `/admin/dashboard` or `/user/driver`.
- `driver` cannot open `/admin/dashboard`, `/user/rentals`, or `/user/orders`.

- [ ] **Step 4: Flow matrix**

Manual test:

- Reset demo data.
- Login `inspector`, create a qualifying inspection with auto-stock-in.
- Login `rentaladmin`, confirm the vehicle appears in inventory/preparation data.
- Login `user`, open rental vehicle report link and confirm 30-minute behavior.
- Login `driver`, accept then complete one assigned task.

- [ ] **Step 5: Commit if repository exists**

Current workspace is not a git repository. Check:

```bash
git rev-parse --is-inside-work-tree
```

Expected in current workspace: FAIL with `fatal: not a git repository`.

If the user later initializes git, commit with:

```bash
git add src docs/superpowers
git commit -m "feat: add role-based shared system permissions"
```

