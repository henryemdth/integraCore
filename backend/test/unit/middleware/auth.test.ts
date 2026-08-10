import { describe, it, expect, beforeAll, vi } from "vitest";
import type { Request, Response } from "express";

vi.stubEnv("DB_DRIVER", "sqlite");
vi.stubEnv("DB_PATH", ":memory:");

const { initDatabase, getAdapter } = await import("../../../src/db/index.js");
const { seedTestUser } = await import("../../helpers/test-helper.js");
const { authenticate, requireRole, signToken } = await import("../../../src/middleware/auth.js");
const { userService } = await import("../../../src/services/userService.js");

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("authenticate", () => {
  let adminToken: string;

  beforeAll(async () => {
    await initDatabase();
    const adapter = getAdapter();
    await seedTestUser(adapter, { username: "admin", password: "password123" });
    await seedTestUser(adapter, { username: "seller", password: "password123" });
    adminToken = signToken({ id: 1, username: "admin", role: "admin" });
  });

  it("rejects requests without a token", async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization headers", async () => {
    const req = { headers: { authorization: "Basic abc" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const req = { headers: { authorization: "Bearer not-a-jwt" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a valid token for a deleted user", async () => {
    const ghostToken = signToken({ id: 999, username: "ghost", role: "admin" });
    const req = { headers: { authorization: `Bearer ${ghostToken}` } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
  });

  it("rejects a token once the account is deactivated", async () => {
    const seller = await getAdapter().get<{ id: number }>(
      "SELECT id FROM users WHERE username = 'seller'"
    );
    await userService(getAdapter()).deactivate(seller!.id, 1);

    const staleToken = signToken({ id: seller!.id, username: "seller", role: "user" });
    const req = { headers: { authorization: `Bearer ${staleToken}` } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Account is deactivated" });
    expect(next).not.toHaveBeenCalled();

    await userService(getAdapter()).activate(seller!.id);
  });

  it("passes a valid token for an active user through to next()", async () => {
    const req = { headers: { authorization: `Bearer ${adminToken}` } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect((req as any).user).toEqual({ id: 1, username: "admin", role: "admin" });
  });
});

describe("requireRole", () => {
  it("rejects requests without an authenticated user", () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user with the wrong role", () => {
    const req = { user: { id: 2, username: "seller", role: "user" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Insufficient permissions" });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes an authenticated user with a matching role to next()", () => {
    const req = { user: { id: 1, username: "admin", role: "admin" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
