import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  anikaRequest: vi.fn(),
  recordAudit: vi.fn(),
  user: { id: "owner-1", name: "Owner", role: "OWNER" },
  tx: {
    product: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    warehouseStock: {
      upsert: vi.fn()
    },
    stockMovement: {
      create: vi.fn()
    }
  }
}));

vi.mock("@/lib/api/anikaClient", () => ({ anikaRequest: mocks.anikaRequest }));
vi.mock("@/lib/audit/store", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => mocks.user) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx))
  }
}));

import { createStockAdjustment } from "@/lib/api/stockAdjustments";

describe("stock adjustment ERP adapter", () => {
  const originalSource = process.env.INVENTORY_SOURCE;

  beforeAll(() => {
    process.env.INVENTORY_SOURCE = "erp";
  });

  afterAll(() => {
    if (originalSource !== undefined) {
      process.env.INVENTORY_SOURCE = originalSource;
    } else {
      delete process.env.INVENTORY_SOURCE;
    }
  });

  beforeEach(() => {
    mocks.anikaRequest.mockReset();
    mocks.recordAudit.mockReset();
  });

  it("posts the verified ERP /stock-adjustments payload shape", async () => {
    mocks.anikaRequest.mockResolvedValue({ success: true, data: { id: 9 } });

    await expect(createStockAdjustment({
      adjustmentNumber: "ADJ-1",
      adjustmentDate: "2026-06-30",
      warehouseId: 1,
      adjustmentType: "increase",
      reason: "Stock opname",
      approveNow: true,
      items: [{ productId: 10, rakId: 2, currentQty: 5, adjustedQty: 8, differenceQty: 3, unitCost: 1000 }]
    })).resolves.toMatchObject({ success: true });

    expect(mocks.anikaRequest).toHaveBeenCalledWith("/stock-adjustments", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        adjustment_number: "ADJ-1",
        adjustment_date: "2026-06-30",
        warehouse_id: 1,
        adjustment_type: "increase",
        reason: "Stock opname",
        notes: undefined,
        created_by: undefined,
        approved_by: undefined,
        approve_now: true,
        items: [{
          product_id: 10,
          rak_id: 2,
          current_qty: 5,
          adjusted_qty: 8,
          difference_qty: 3,
          unit_cost: 1000,
          difference_value: undefined,
          notes: undefined
        }]
      })
    }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "stock",
      action: "update",
      afterValue: expect.objectContaining({ warehouseId: 1, itemCount: 1, success: true })
    }));
  });

  it("records a safe audit summary when ERP rejects the adjustment", async () => {
    mocks.anikaRequest.mockResolvedValue({ success: false, code: "ERP_AUTH", message: "Akses ditolak" });

    await expect(createStockAdjustment({
      warehouseId: 1,
      adjustmentType: "decrease",
      reason: "Rusak",
      approveNow: true,
      items: [{ productId: 10, rakId: 2, differenceQty: -1 }]
    })).resolves.toMatchObject({ success: false });

    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "stock",
      action: "retry_sync",
      afterValue: expect.objectContaining({ success: false, code: "ERP_AUTH" }),
      reason: expect.stringContaining("Stock adjustment gagal ERP")
    }));
  });
});

describe("stock adjustment local standalone mode", () => {
  const originalSource = process.env.INVENTORY_SOURCE;

  beforeAll(() => {
    process.env.INVENTORY_SOURCE = "local";
  });

  afterAll(() => {
    if (originalSource !== undefined) {
      process.env.INVENTORY_SOURCE = originalSource;
    } else {
      delete process.env.INVENTORY_SOURCE;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates local warehouseStock and logs StockMovement without calling ERP", async () => {
    mocks.tx.product.findFirst.mockResolvedValue({
      id: "prod-1",
      code: "10",
      name: "Semen Gresik"
    });
    mocks.tx.warehouseStock.upsert.mockResolvedValue({
      id: "ws-1",
      productId: "prod-1",
      warehouse: "Toko",
      rack: "Rak 2",
      quantity: 15
    });
    mocks.tx.stockMovement.create.mockResolvedValue({ id: "sm-1" });

    const result = await createStockAdjustment({
      adjustmentNumber: "ADJ-LOCAL-1",
      warehouseId: 1,
      adjustmentType: "increase",
      reason: "Hasil Stock Opname Bulanan",
      approveNow: true,
      items: [{
        productId: 10,
        rakId: 2,
        currentQty: 10,
        adjustedQty: 15,
        differenceQty: 5,
        unitCost: 50000
      }]
    });

    expect(result.success).toBe(true);
    expect(mocks.anikaRequest).not.toHaveBeenCalled();
    expect(mocks.tx.warehouseStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        productId_warehouse_rack: {
          productId: "prod-1",
          warehouse: "Toko",
          rack: "Rak 2"
        }
      }
    }));
    expect(mocks.tx.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        productId: "prod-1",
        warehouse: "Toko",
        type: "ADJUSTMENT",
        referenceType: "ADJUSTMENT",
        referenceId: "ADJ-LOCAL-1"
      })
    }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "stock",
      entityId: "ADJ-LOCAL-1",
      action: "update"
    }));
  });
});
