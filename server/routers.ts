import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { localAuthRouter } from "./routers/localAuth";
import { monitoringRouter } from "./routers/monitoring";
import { profileRouter } from "./routers/profile";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: localAuthRouter,
  monitoring: monitoringRouter,
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
