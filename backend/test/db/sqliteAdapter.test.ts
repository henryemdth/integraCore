import { describe, it, expect } from "vitest";
import { createTestDb } from "../helpers/test-helper.js";

describe("SqliteAdapter", () => {
  describe("boolean parameter normalization", () => {
    it("binds true to 1 in get", async () => {
      const { db, raw } = createTestDb();
      raw.prepare(
        "INSERT INTO users (username, password_hash, full_name, role, active) VALUES ('a', 'x', 'A', 'admin', 1), ('b', 'x', 'B', 'user', 0)"
      ).run();

      const active = await db.get(
        "SELECT username FROM users WHERE active = ?",
        [true]
      );
      expect(active.username).toBe("a");

      const inactive = await db.get(
        "SELECT username FROM users WHERE active = ?",
        [false]
      );
      expect(inactive.username).toBe("b");
    });

    it("binds true/false to 1/0 in all", async () => {
      const { db, raw } = createTestDb();
      raw.prepare(
        "INSERT INTO users (username, password_hash, full_name, role, active) VALUES ('a', 'x', 'A', 'admin', 1), ('b', 'x', 'B', 'user', 0)"
      ).run();

      const active = await db.all(
        "SELECT username FROM users WHERE active = ?",
        [true]
      );
      expect(active.map((r) => r.username)).toEqual(["a"]);

      const inactive = await db.all(
        "SELECT username FROM users WHERE active = ?",
        [false]
      );
      expect(inactive.map((r) => r.username)).toEqual(["b"]);
    });

    it("binds false to 0 in run (UPDATE)", async () => {
      const { db, raw } = createTestDb();
      raw.prepare(
        "INSERT INTO users (username, password_hash, full_name, role, active) VALUES ('a', 'x', 'A', 'admin', 1)"
      ).run();

      await db.run("UPDATE users SET active = ? WHERE username = ?", [false, "a"]);

      const row = raw.prepare("SELECT active FROM users WHERE username = 'a'").get() as { active: number };
      expect(row.active).toBe(0);
    });

    it("leaves non-boolean params untouched", async () => {
      const { db } = createTestDb();
      const row = await db.get(
        "SELECT 1 AS one WHERE ? = ? AND ? IS NULL",
        ["a", "a", null]
      );
      expect(row.one).toBe(1);
    });
  });

  describe("transaction rollback", () => {
    it("reverts writes when the transaction fn throws", async () => {
      const { db, raw } = createTestDb();

      await expect(
        db.transaction(async (tx) => {
          await tx.run(
            "INSERT INTO users (username, password_hash, full_name) VALUES ('a', 'x', 'A')"
          );
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      const count = raw.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
      expect(count.c).toBe(0);
    });

    it("commits writes when the transaction fn succeeds", async () => {
      const { db, raw } = createTestDb();

      await db.transaction(async (tx) => {
        await tx.run(
          "INSERT INTO users (username, password_hash, full_name) VALUES ('a', 'x', 'A')"
        );
      });

      const count = raw.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
      expect(count.c).toBe(1);
    });
  });
});
