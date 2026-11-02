import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  salesRecord: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({})
  },
  deliveryOrder: {
    findUnique: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: typeof mocks) => Promise<unknown>) => cb(mocks)),
    salesRecord: mocks.salesRecord,
    deliveryOrder: mocks.deliveryOrder
  }
}));

import { syncDeliveryOrderForSale } from "@/lib/deliveryOrders/store";

describe("syncDeliveryOrderForSale walk-in auto-completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks DO and items as selesai/sudah when shippingMethod is 'di Tempat'", async () => {
    mocks.salesRecord.findUnique.mockResolvedValue({
      id: "sale-walkin-1",
      transactionNumber: "TRX-W-01",
      shippingMethod: "di Tempat",
      items: [
        {
          productRef: "BRG-01",
          manualProduct: null,
          quantity: 2,
          unitSnapshot: "Pcs"
        }
      ]
    });
    mocks.deliveryOrder.findUnique.mockResolvedValue(null);
    mocks.deliveryOrder.create.mockImplementation(({ data }) => Promise.resolve({ id: "do-1", ...data }));

    const result = await syncDeliveryOrderForSale("sale-walkin-1");

    expect(mocks.deliveryOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "selesai",
        packingStatus: "sudah",
        shippingStatus: "sudah",
        items: {
          create: [
            expect.objectContaining({
              isShipped: true,
              shippedQuantity: 2
            })
          ]
        }
      })
    }));
    expect(result?.status).toBe("selesai");
  });

  it("keeps DO as belum_selesai when shippingMethod is delivery/ekspedisi", async () => {
    mocks.salesRecord.findUnique.mockResolvedValue({
      id: "sale-delivery-1",
      transactionNumber: "TRX-D-01",
      shippingMethod: "Kurir Toko",
      items: [
        {
          productRef: "BRG-02",
          manualProduct: null,
          quantity: 5,
          unitSnapshot: "Dus"
        }
      ]
    });
    mocks.deliveryOrder.findUnique.mockResolvedValue(null);
    mocks.deliveryOrder.create.mockImplementation(({ data }) => Promise.resolve({ id: "do-2", ...data }));

    const result = await syncDeliveryOrderForSale("sale-delivery-1");

    expect(mocks.deliveryOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "belum_selesai",
        packingStatus: "belum",
        shippingStatus: "belum",
        items: {
          create: [
            expect.objectContaining({
              isShipped: false,
              shippedQuantity: 0
            })
          ]
        }
      })
    }));
    expect(result?.status).toBe("belum_selesai");
  });
});
