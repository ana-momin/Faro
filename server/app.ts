import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function createFaroApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, service: "faro-ai" }));
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
