import { describe, it, expect, vi } from "vitest";
import { createTestDb, seedTestUser } from "../../helpers/test-helper.js";
import { userService } from "../../../src/services/userService.js";
import { emitUsersChanged } from "../../../src/socket/index.js";

vi.mock("../../../src/socket/index.js", () => ({
  emitProductUpdated: vi.fn(),
  emitNotification: vi.fn(),
  emitDbRestored: vi.fn(),
  emitUsersChanged: vi.fn(),
}));

describe("userService active filtering (boolean params on SQLite)", () => {
  it("list filters by active status without binding errors", async () => {
    const { db } = createTestDb();
    await seedTestUser(db, { username: "admin", role: "admin" });
    await seedTestUser(db, { username: "inactive", role: "user", active: 0 });
    await seedTestUser(db, { username: "another", role: "user" });

    const svc = userService(db);

    const active = await svc.list({ page: 1, limit: 10, active: "active" });
    expect(active.total).toBe(2);

    const inactive = await svc.list({ page: 1, limit: 10, active: "inactive" });
    expect(inactive.total).toBe(1);
    expect(inactive.users[0].username).toBe("inactive");

    const all = await svc.list({ page: 1, limit: 10 });
    expect(all.total).toBe(3);
  });

  it("deactivate and activate update the flag", async () => {
    const { db } = createTestDb();
    const admin = await seedTestUser(db, { username: "admin", role: "admin" });
    const target = await seedTestUser(db, { username: "target", role: "user" });

    const svc = userService(db);

    const deactivated = await svc.deactivate(target.id, admin.id);
    expect(deactivated.active).toBe(0);

    const reactivated = await svc.activate(target.id);
    expect(reactivated.active).toBe(1);

    // Both operations push a realtime refresh to connected clients.
    expect(emitUsersChanged).toHaveBeenCalled();
  });
});

describe("userService list ordering and search", () => {
  it("orders by creation (newest first) instead of full_name", async () => {
    const { db } = createTestDb();
    // Seeded first and alphabetically first — only creation-order ranking puts it below.
    await seedTestUser(db, { username: "adam", full_name: "Adam Benítez", role: "user" });
    await seedTestUser(db, { username: "zoe", full_name: "Zoe Álvarez", role: "user" });

    const svc = userService(db);
    const result = await svc.list({ page: 1, limit: 10 });
    expect(result.users.map((u: any) => u.username)).toEqual(["zoe", "adam"]);
  });

  it("search matches username or full_name case-insensitively", async () => {
    const { db } = createTestDb();
    await seedTestUser(db, { username: "bdiaz", full_name: "Bruno Díaz", role: "user" });
    await seedTestUser(db, { username: "admin", full_name: "Admin User", role: "admin" });

    const svc = userService(db);

    const byUsername = await svc.list({ page: 1, limit: 10, search: "BDIAZ" });
    expect(byUsername.users.map((u: any) => u.username)).toEqual(["bdiaz"]);

    const byName = await svc.list({ page: 1, limit: 10, search: "bruno" });
    expect(byName.users.map((u: any) => u.username)).toEqual(["bdiaz"]);
  });
});
