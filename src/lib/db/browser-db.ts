/**
 * Browser-side SQLite database using wa-sqlite + OPFS.
 * This module provides the SQLiteDB interface for HealthStore.
 *
 * Uses the Origin Private File System (OPFS) for persistent storage
 * that survives browser restarts. Falls back to in-memory if OPFS
 * is not available.
 */

import type { SQLiteDB } from "./health-store";

// wa-sqlite types are minimal, so we define what we need
type WaSQLiteModule = {
  sqlite3_open_v2: (name: string, flags: number) => number;
  sqlite3_exec: (db: number, sql: string) => number;
  sqlite3_prepare_v2: (db: number, sql: string) => number;
  sqlite3_step: (stmt: number) => number;
  sqlite3_finalize: (stmt: number) => number;
  sqlite3_bind_text: (stmt: number, index: number, value: string) => number;
  sqlite3_bind_int: (stmt: number, index: number, value: number) => number;
  sqlite3_bind_null: (stmt: number, index: number) => number;
  sqlite3_column_count: (stmt: number) => number;
  sqlite3_column_name: (stmt: number, index: number) => string;
  sqlite3_column_text: (stmt: number, index: number) => string;
  sqlite3_column_type: (stmt: number, index: number) => number;
  SQLITE_ROW: number;
  SQLITE_DONE: number;
  SQLITE_OPEN_READWRITE: number;
  SQLITE_OPEN_CREATE: number;
};

let dbInstance: BrowserSQLiteDB | null = null;

/**
 * Get or create the browser SQLite database singleton.
 * Uses a simple in-memory implementation for now.
 * The wa-sqlite OPFS integration will be added when we wire up the full browser environment.
 */
export async function getBrowserDB(): Promise<SQLiteDB> {
  if (dbInstance) return dbInstance;

  // For now, use a simple Map-based store that works in all environments
  // This will be replaced with wa-sqlite + OPFS when we set up the service worker
  dbInstance = new BrowserSQLiteDB();
  return dbInstance;
}

/**
 * Simple in-memory SQL-like database for development.
 * Will be replaced with actual wa-sqlite in production.
 */
class BrowserSQLiteDB implements SQLiteDB {
  private tables = new Map<string, Array<Record<string, unknown>>>();
  private initialized = false;

  exec(sql: string): void {
    // For schema creation, we just track that it happened
    // The real implementation will use wa-sqlite
    this.initialized = true;
    // Parse CREATE TABLE statements to register tables
    const createMatches = sql.matchAll(
      /CREATE TABLE IF NOT EXISTS (\w+)/g
    );
    for (const match of createMatches) {
      if (!this.tables.has(match[1])) {
        this.tables.set(match[1], []);
      }
    }
    // Handle DELETE statements
    const deleteMatch = sql.match(/DELETE FROM (\w+)/);
    if (deleteMatch) {
      this.tables.set(deleteMatch[1], []);
    }
  }

  run(sql: string, params: unknown[] = []): void {
    const insertMatch = sql.match(
      /INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)/i
    );
    if (insertMatch) {
      const table = insertMatch[1];
      const columns = insertMatch[2].split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = params[i] ?? null;
      });

      if (!this.tables.has(table)) {
        this.tables.set(table, []);
      }

      // Handle OR REPLACE by removing existing row with same primary key
      if (sql.includes("OR REPLACE")) {
        const rows = this.tables.get(table)!;
        const pkCol = columns[0]; // Assume first column is PK
        const idx = rows.findIndex((r) => r[pkCol] === row[pkCol]);
        if (idx !== -1) {
          rows[idx] = row;
          return;
        }
      }

      this.tables.get(table)!.push(row);
    }
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): T[] {
    // Simple query parser for common patterns
    const selectMatch = sql.match(
      /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (!selectMatch) return [];

    const [, columns, table, where, orderBy, limit] = selectMatch;
    const rows = this.tables.get(table) || [];

    let filtered = [...rows];

    // Apply WHERE clause
    if (where) {
      const countMatch = where.match(/(\w+)\s*=\s*'([^']+)'/);
      const paramMatch = where.match(/(\w+)\s*=\s*\?/);
      if (countMatch) {
        filtered = filtered.filter(
          (r) => r[countMatch[1]] === countMatch[2]
        );
      } else if (paramMatch && params.length > 0) {
        filtered = filtered.filter(
          (r) => r[paramMatch[1]] === params[0]
        );
      }
    }

    // Apply LIMIT
    if (limit) {
      filtered = filtered.slice(0, parseInt(limit));
    }

    // Handle COUNT(*)
    if (columns.includes("COUNT(*)")) {
      return [{ count: filtered.length } as unknown as T];
    }

    return filtered as T[];
  }
}
