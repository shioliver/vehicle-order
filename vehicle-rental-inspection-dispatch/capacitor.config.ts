import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.codex.vehiclefleet',
  appName: '车检租赁调度系统',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false
      }
    }
  }
};

export default config;
