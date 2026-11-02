import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db/prisma";

describe("Standalone Inventory Schema", () => {
  it("has Product, WarehouseStock, and StockMovement models available in Prisma Client", () => {
    expect(typeof prisma.product.findMany).toBe("function");
    expect(typeof prisma.warehouseStock.findMany).toBe("function");
    expect(typeof prisma.stockMovement.findMany).toBe("function");
  });
});
