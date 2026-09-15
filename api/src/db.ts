import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "../../data/health.db");

let _db: Database | null = null;

export function invalidateDb(): void { _db = null; }

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  const SQL  = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }
  return _db;
}

// sql.js returns results as [{columns, values}] — convert to array of objects
export function rows<T = Record<string, unknown>>(
  db: Database, sql: string, params: (string | number | null)[] = []
): T[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as T[];
}
