import { describe, it, expect } from "vitest";
import { createTestDb, seedTestUser } from "../../helpers/test-helper.js";
import { userService } from "../../../src/services/userService.js";

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
  });
});
