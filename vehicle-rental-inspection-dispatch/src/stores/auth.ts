import { defineStore } from 'pinia';
import { fleetRepository } from '@/db/fleetRepository';
import { clearCurrentUser, readCurrentUser, writeCurrentUser, type SessionUser } from '@/auth/session';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: readCurrentUser() as SessionUser | null
  }),
  actions: {
    login(username: string, password: string) {
      const user = fleetRepository.login(username, password);
      if (!user) return false;
      writeCurrentUser(user);
      this.currentUser = readCurrentUser();
      return true;
    },
    syncSession() {
      if (!this.currentUser) return;
      writeCurrentUser(this.currentUser);
      this.currentUser = readCurrentUser();
    },
    logout() {
      this.currentUser = null;
      clearCurrentUser();
    }
  }
});
