import { Router, Request, Response } from "express";
import { config } from "../config.js";

const router = Router();

router.get("/info", (_req: Request, res: Response) => {
  res.json({ dbDriver: config.dbDriver });
});

export default router;
