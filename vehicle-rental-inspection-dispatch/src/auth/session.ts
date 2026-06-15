import type { AppUser, UserRole, UserStatus } from '@/types/domain';

export const AUTH_KEY = 'vehicle-fleet-auth-v1';

export type SessionUser = Omit<AppUser, 'password'>;

const validRoles: readonly UserRole[] = ['super_admin', 'inspection_admin', 'rental_admin', 'customer', 'driver'];
const validStatuses: readonly UserStatus[] = ['启用', '停用'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isUserRole(value: unknown): value is UserRole {
  return isString(value) && validRoles.includes(value as UserRole);
}

function isUserStatus(value: unknown): value is UserStatus {
  return isString(value) && validStatuses.includes(value as UserStatus);
}

function toSessionUser(value: unknown): SessionUser | null {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || !isString(value.username) || !isString(value.name) || !isUserRole(value.role) || !isString(value.phone)) return null;
  if (value.status !== undefined && !isUserStatus(value.status)) return null;

  return {
    id: value.id,
    username: value.username,
    name: value.name,
    role: value.role,
    phone: value.phone,
    ...(value.status ? { status: value.status } : {})
  };
}

function readStorageValue(): string | null {
  try {
    return localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}

function writeStorageValue(user: SessionUser) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch {
    clearCurrentUser();
  }
}

export function readCurrentUser(): SessionUser | null {
  const raw = readStorageValue();
  if (!raw) return null;

  try {
    const user = toSessionUser(JSON.parse(raw));
    if (!user) {
      clearCurrentUser();
      return null;
    }
    writeStorageValue(user);
    return user;
  } catch {
    clearCurrentUser();
    return null;
  }
}

export function writeCurrentUser(user: AppUser | SessionUser) {
  const sessionUser = toSessionUser(user);
  if (!sessionUser) {
    clearCurrentUser();
    return;
  }
  writeStorageValue(sessionUser);
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}
