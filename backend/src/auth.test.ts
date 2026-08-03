import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedTestUser } from "./test-helper.js";
import type { SqliteAdapter } from "./db/sqlite.js";
import type { DatabaseAdapter } from "./db/adapter.js";
import { authService, AppError } from "./services/authService.js";

vi.mock("./socket/index.js", () => ({
  emitProductUpdated: vi.fn(),
  emitNotification: vi.fn(),
  emitDbRestored: vi.fn(),
}));

describe("authService", () => {
  let db: SqliteAdapter;
  let service: ReturnType<typeof authService>;

  beforeEach(() => {
    const test = createTestDb();
    db = test.db;
    service = authService(db);
  });

  describe("getSetupStatus", () => {
    it("returns true when users table is empty", async () => {
      expect(await service.getSetupStatus()).toBe(true);
    });

    it("returns false when at least one user exists", async () => {
      await seedTestUser(db);
      expect(await service.getSetupStatus()).toBe(false);
    });

    it("uses an existence check, not a COUNT comparison", async () => {
      const getSpy = vi.spyOn(db, "get");
      await service.getSetupStatus();
      const sql = getSpy.mock.calls[0][0] as string;
      expect(sql).toContain("SELECT 1 FROM users");
      expect(sql).toContain("LIMIT 1");
      expect(sql).not.toContain("COUNT");
      getSpy.mockRestore();
    });

    it("is true even when the adapter returns string counts (PostgreSQL bigint)", async () => {
      const pgLike: DatabaseAdapter = {
        async get<T = any>(sql: string, _params?: any[]): Promise<T | undefined> {
          if (sql.includes("SELECT 1 FROM users")) return undefined as T | undefined;
          return { count: "0" } as T | undefined;
        },
        async all() {
          return [];
        },
        async run() {
          return { insertId: 0, changes: 0 };
        },
        async exec() {},
        async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
          return fn(pgLike);
        },
        raw() {
          return null;
        },
        async close() {},
      };
      const svc = authService(pgLike);
      expect(await svc.getSetupStatus()).toBe(true);
    });
  });

  describe("setup", () => {
    it("creates the initial admin account with a token", async () => {
      const result = await service.setup("admin", "password123", "Admin User");
      expect(result.token).toBeDefined();
      expect(result.user).toMatchObject({
        username: "admin",
        full_name: "Admin User",
        role: "admin",
      });
      expect(result.user!.active).toBeTruthy();
      expect(await service.getSetupStatus()).toBe(false);
    });

    it("rejects when users already exist", async () => {
      await seedTestUser(db);
      await expect(service.setup("admin2", "password123", "Another Admin")).rejects.toThrow(AppError);
      await expect(service.setup("admin2", "password123", "Another Admin")).rejects.toThrow(
        "Setup already completed"
      );
    });
  });
});
