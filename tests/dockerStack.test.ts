import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Docker Stack & Portainer.io Configuration", () => {
  const root = process.cwd();

  it("has optimized multi-stage Dockerfile with standalone support and caching", () => {
    const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("FROM base AS deps");
    expect(dockerfile).toContain("FROM base AS builder");
    expect(dockerfile).toContain("FROM base AS runner");
    expect(dockerfile).toContain("--mount=type=cache,target=/root/.npm");
    expect(dockerfile).toContain("--mount=type=cache,target=/app/.next/cache");
    expect(dockerfile).toContain("ENTRYPOINT [\"/usr/local/bin/docker-entrypoint.sh\"]");
    expect(dockerfile).toContain("HEALTHCHECK");
  });

  it("has docker-compose.yml ready for Portainer.io with ankjy naming and zero-touch migrations", () => {
    const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");
    expect(compose).toContain("name: ankjy");
    expect(compose).toContain("ankjy-postgres:");
    expect(compose).toContain("ankjy-app:");
    expect(compose).toContain("restart: unless-stopped");
    expect(compose).toContain("ankjy_postgres:/var/lib/postgresql/data");
    expect(compose).toContain("ankjy_data:/app/data");
    expect(compose).toContain("${APP_PORT:-3005}:3000");
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain("ghcr.io/ridho15/ankjy:latest");
  });

  it("has executable docker-entrypoint.sh that auto-migrates and seeds database", () => {
    const entrypointPath = path.join(root, "scripts", "docker-entrypoint.sh");
    expect(fs.existsSync(entrypointPath)).toBe(true);
    const content = fs.readFileSync(entrypointPath, "utf8");
    expect(content).toContain("prisma migrate deploy");
    expect(content).toContain("seed-initial-owner.mjs");
    expect(content).toContain("seed-core-master-data.mjs");
  });

  it("has next.config.mjs configured for standalone output", () => {
    const nextConfig = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8");
    expect(nextConfig).toContain("standalone");
  });

  it("has GitHub Actions workflow configured for testing, GHCR build & push, and Portainer auto-deploy", () => {
    const workflowPath = path.join(root, ".github", "workflows", "deploy.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflow = fs.readFileSync(workflowPath, "utf8");
    expect(workflow).toContain("branches:\n      - main");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("ghcr.io");
    expect(workflow).toContain("build-and-push-ghcr");
    expect(workflow).toContain("PORTAINER_WEBHOOK_URL");
    expect(workflow).toContain("deploy-to-portainer");
  });
});
