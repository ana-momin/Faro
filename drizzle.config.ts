import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/renderSchema.ts",
  out: "./drizzle/render",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
