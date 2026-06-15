import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { schemaSql } from '@/db/schema';

export class SQLiteClient {
  private sqlite?: SQLiteConnection;
  private db?: SQLiteDBConnection;
  private readonly dbName = 'vehicle_fleet_system';

  async init() {
    if (!Capacitor.isNativePlatform()) return false;

    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
    await this.db.open();

    for (const sql of schemaSql) {
      await this.db.execute(sql);
    }

    return true;
  }

  async run(sql: string, values: unknown[] = []) {
    if (!this.db) throw new Error('SQLite 数据库尚未初始化');
    return this.db.run(sql, values);
  }

  async query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    if (!this.db) throw new Error('SQLite 数据库尚未初始化');
    const res = await this.db.query(sql, values);
    return (res.values ?? []) as T[];
  }

  async close() {
    if (!this.sqlite || !this.db) return;
    await this.sqlite.closeConnection(this.dbName, false);
    this.db = undefined;
  }
}

export const sqliteClient = new SQLiteClient();
