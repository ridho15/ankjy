import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { releaseSaleStock, cancelStockRelease } from "@/lib/api/stockReleases";
import { createPurchaseOrder, createPurchaseReceipt } from "@/lib/purchasing/purchasingStore";
import { createSalesReturn, postSalesReturn } from "@/lib/sales/returnStore";
import { ensureStandardAccounts } from "@/lib/accounting/accountStore";

describe("Tahap 3: QA & Integration Testing - Decoupling Pemotongan Stok Penjualan & Penambahan Stok Pembelian", { timeout: 35000 }, () => {
  const timestamp = Date.now();
  const testProductCodeA = `QA3-PROD-A-${timestamp}`;
  const testProductCodeB = `QA3-PROD-B-${timestamp}`;
  let testProductIdA = "";
  let testProductIdB = "";

  const testActor = {
    id: `qa3-user-${timestamp}`,
    name: "QA Inspector Tahap 3",
    role: "FINANCE" as const
  };

  beforeAll(async () => {
    await ensureStandardAccounts();

    // Pastikan user ada untuk audit / createdBy
    await prisma.user.upsert({
      where: { id: testActor.id },
      create: {
        id: testActor.id,
        externalId: testActor.id,
        name: testActor.name,
        email: `${testActor.id}@slm.local`,
        role: "FINANCE"
      },
      update: {}
    }).catch(() => null);

    // Buat 2 produk awal di database lokal
    const prodA = await prisma.product.create({
      data: {
        code: testProductCodeA,
        name: "Cat Tembok Nippon Paint 5kg",
        category: "Cat & Pelapis",
        unit: "KALENG",
        sellingPrice: new Prisma.Decimal(125000),
        costPrice: new Prisma.Decimal(95000),
        defaultWarehouse: "Gudang Utama",
        defaultRack: "R-01",
        isActive: true
      }
    });
    testProductIdA = prodA.id;

    // Set stok awal 50 untuk produk A
    await prisma.warehouseStock.create({
      data: {
        productId: prodA.id,
        warehouse: "Gudang Utama",
        rack: "R-01",
        quantity: new Prisma.Decimal(50)
      }
    });

    const prodB = await prisma.product.create({
      data: {
        code: testProductCodeB,
        name: "Paku Seng 3 inch 1kg",
        category: "Hardware",
        unit: "KG",
        sellingPrice: new Prisma.Decimal(25000),
        costPrice: new Prisma.Decimal(18000),
        defaultWarehouse: "Gudang Utama",
        defaultRack: "R-02",
        isActive: true
      }
    });
    testProductIdB = prodB.id;

    // Set stok awal 100 untuk produk B
    await prisma.warehouseStock.create({
      data: {
        productId: prodB.id,
        warehouse: "Gudang Utama",
        rack: "R-02",
        quantity: new Prisma.Decimal(100)
      }
    });
  });

  afterAll(async () => {
    // Cleanup movements
    await prisma.stockMovement.deleteMany({
      where: {
        productId: { in: [testProductIdA, testProductIdB].filter(Boolean) }
      }
    }).catch(() => null);

    // Cleanup stocks
    await prisma.warehouseStock.deleteMany({
      where: {
        productId: { in: [testProductIdA, testProductIdB].filter(Boolean) }
      }
    }).catch(() => null);

    // Cleanup products
    await prisma.product.deleteMany({
      where: {
        code: { startsWith: "QA3-PROD-" }
      }
    }).catch(() => null);

    // Cleanup test user
    await prisma.user.deleteMany({
      where: { id: testActor.id }
    }).catch(() => null);
  });

  describe("1. Pelepasan Stok Penjualan (Local Decoupled Stock Deduction)", () => {
    it("memotong stok WarehouseStock lokal dan mencatat StockMovement OUT_SALE", async () => {
      const saleId = `SALE-QA3-${timestamp}-1`;
      const sourceNumber = `INV-SLM-${timestamp}-1`;
      const releaseRef = `SLM-STOCK-${saleId}`;

      const res = await releaseSaleStock({
        saleId,
        saleDate: "2026-11-02",
        erpReference: releaseRef,
        sourceNumber,
        items: [
          {
            productId: testProductIdA,
            productRef: testProductCodeA,
            quantity: 5,
            warehouseNameSnapshot: "Gudang Utama",
            rackNameSnapshot: "R-01",
            unitPrice: 125000
          }
        ]
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("released");

      // Cek stok berkurang dari 50 -> 45
      const stock = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: testProductIdA,
            warehouse: "Gudang Utama",
            rack: "R-01"
          }
        }
      });
      expect(Number(stock?.quantity)).toBe(45);

      // Cek pencatatan mutasi
      const movement = await prisma.stockMovement.findFirst({
        where: {
          productId: testProductIdA,
          referenceId: sourceNumber,
          type: "OUT_SALE"
        }
      });
      expect(movement).toBeDefined();
      expect(Number(movement?.quantity)).toBe(5);
      expect(Number(movement?.balanceBefore)).toBe(50);
      expect(Number(movement?.balanceAfter)).toBe(45);
      expect(movement?.warehouse).toBe("Gudang Utama");
    });

    it("mengurangi stok beberapa produk secara atomik dalam satu transaksi penjualan", async () => {
      const saleId = `SALE-QA3-${timestamp}-MULTI`;
      const sourceNumber = `INV-SLM-${timestamp}-MULTI`;

      const res = await releaseSaleStock({
        saleId,
        saleDate: "2026-11-02",
        sourceNumber,
        items: [
          {
            productId: testProductIdA,
            productRef: testProductCodeA,
            quantity: 10,
            warehouseNameSnapshot: "Gudang Utama",
            rackNameSnapshot: "R-01"
          },
          {
            productId: testProductIdB,
            productRef: testProductCodeB,
            quantity: 20,
            warehouseNameSnapshot: "Gudang Utama",
            rackNameSnapshot: "R-02"
          }
        ]
      });

      expect(res.success).toBe(true);

      const stockA = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: testProductIdA,
            warehouse: "Gudang Utama",
            rack: "R-01"
          }
        }
      });
      const stockB = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: testProductIdB,
            warehouse: "Gudang Utama",
            rack: "R-02"
          }
        }
      });

      // 45 - 10 = 35
      expect(Number(stockA?.quantity)).toBe(35);
      // 100 - 20 = 80
      expect(Number(stockB?.quantity)).toBe(80);
    });

    it("membuat produk baru on-the-fly jika ada item manual yang belum ada di katalog lokal", async () => {
      const unlistedSku = `QA3-UNLISTED-${timestamp}`;
      const saleId = `SALE-QA3-UNLISTED-${timestamp}`;

      const res = await releaseSaleStock({
        saleId,
        saleDate: "2026-11-02",
        sourceNumber: saleId,
        items: [
          {
            productRef: unlistedSku,
            quantity: 2,
            warehouseNameSnapshot: "Toko",
            unitPrice: 50000,
            manualProduct: {
              name: "Item Ad-Hoc Baru"
            }
          }
        ]
      });

      expect(res.success).toBe(true);

      const createdProd = await prisma.product.findUnique({
        where: { code: unlistedSku }
      });
      expect(createdProd).toBeDefined();
      expect(createdProd?.name).toBe("Item Ad-Hoc Baru");

      const stock = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: createdProd!.id,
            warehouse: "Toko",
            rack: ""
          }
        }
      });
      expect(Number(stock?.quantity)).toBe(-2);

      // Clean up newly created product
      await prisma.stockMovement.deleteMany({ where: { productId: createdProd!.id } });
      await prisma.warehouseStock.deleteMany({ where: { productId: createdProd!.id } });
      await prisma.product.delete({ where: { id: createdProd!.id } });
    });
  });

  describe("2. Pembatalan / Revisi Penjualan (Local Decoupled Stock Reversal)", () => {
    it("mengembalikan stok dan mencatat REVERSAL_IN ketika penjualan dibatalkan", async () => {
      const saleId = `SALE-QA3-CANCEL-${timestamp}`;
      const sourceNumber = `INV-QA3-CANCEL-${timestamp}`;

      // Buat pemotongan stok awal 8 unit dari Produk B (80 -> 72)
      const releaseRes = await releaseSaleStock({
        saleId,
        saleDate: "2026-11-02",
        sourceNumber,
        items: [
          {
            productId: testProductIdB,
            productRef: testProductCodeB,
            quantity: 8,
            warehouseNameSnapshot: "Gudang Utama",
            rackNameSnapshot: "R-02"
          }
        ]
      });
      expect(releaseRes.success).toBe(true);

      let stock = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: testProductIdB,
            warehouse: "Gudang Utama",
            rack: "R-02"
          }
        }
      });
      expect(Number(stock?.quantity)).toBe(72);

      // Batalkan transaksi
      const cancelRes = await cancelStockRelease({
        reference: sourceNumber,
        reason: "Customer membatalkan pembelian"
      });
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.data?.status).toBe("reversed");

      // Verifikasi stok kembali ke 80
      stock = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: testProductIdB,
            warehouse: "Gudang Utama",
            rack: "R-02"
          }
        }
      });
      expect(Number(stock?.quantity)).toBe(80);

      // Verifikasi pencatatan REVERSAL_IN
      const revMovement = await prisma.stockMovement.findFirst({
        where: {
          productId: testProductIdB,
          referenceId: sourceNumber,
          type: "REVERSAL_IN"
        }
      });
      expect(revMovement).toBeDefined();
      expect(Number(revMovement?.quantity)).toBe(8);
      expect(Number(revMovement?.balanceBefore)).toBe(72);
      expect(Number(revMovement?.balanceAfter)).toBe(80);
    });
  });

  describe("3. Penerimaan Pembelian / GRN (Local Decoupled Stock Inbound)", () => {
    it("menambah stok fisik lokal dan mencatat IN_PURCHASE saat Surat Penerimaan Barang (GRN) dibuat", async () => {
      // Buat supplier dummy
      const supp = await prisma.supplier.create({
        data: {
          code: `SUPP-QA3-${timestamp}`,
          name: "Supplier Cat & Hardware QA",
          currency: "IDR"
        }
      });

      // Buat PO
      const testPoNumber = `PO-QA3-${timestamp}-${Math.floor(Math.random() * 10000)}`;
      const po = await createPurchaseOrder(
        {
          poNumber: testPoNumber,
          supplierId: supp.id,
          orderDate: "2026-11-02",
          currency: "IDR",
          exchangeRate: 1,
          rateType: "BOOKING",
          items: [
            {
              itemCode: testProductCodeA,
              itemName: "Cat Tembok Nippon Paint 5kg",
              unit: "KALENG",
              unitPriceOriginal: 90000,
              quantity: 25
            }
          ]
        },
        testActor
      );

      expect(po).toBeDefined();
      const poItemId = po!.items[0].id;

      // Catat penerimaan barang (GRN)
      const grn = await createPurchaseReceipt(
        {
          grnNumber: `GRN-QA3-${timestamp}`,
          purchaseOrderId: po!.id,
          receiptDate: "2026-11-02",
          warehouseName: "Gudang Utama",
          items: [
            {
              purchaseOrderItemId: poItemId,
              itemCode: testProductCodeA,
              itemName: "Cat Tembok Nippon Paint 5kg",
              unit: "KALENG",
              quantityReceived: 25
            }
          ]
        },
        testActor
      );

      expect(grn).toBeDefined();

      // Stok A sebelumnya 35, ditambah 25 -> harus 60
      const stockA = await prisma.warehouseStock.findFirst({
        where: {
          productId: testProductIdA,
          warehouse: "Gudang Utama"
        }
      });
      expect(Number(stockA?.quantity)).toBe(60);

      // Cek mutasi IN_PURCHASE
      const movement = await prisma.stockMovement.findFirst({
        where: {
          productId: testProductIdA,
          referenceId: grn!.grnNumber,
          type: "IN_PURCHASE"
        }
      });
      expect(movement).toBeDefined();
      expect(Number(movement?.quantity)).toBe(25);
      expect(Number(movement?.balanceAfter)).toBe(60);

      // Cleanup PO & GRN
      await prisma.purchaseReceiptItem.deleteMany({ where: { purchaseReceiptId: grn!.id } });
      await prisma.purchaseReceipt.delete({ where: { id: grn!.id } });
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po!.id } });
      await prisma.purchaseOrder.delete({ where: { id: po!.id } });
      await prisma.supplier.delete({ where: { id: supp.id } });
    });
  });

  describe("4. Retur Penjualan (Local Decoupled Sales Return Inbound)", () => {
    it("mengembalikan stok fisik ke gudang lokal dan mencatat RETURN_IN saat retur penjualan di-post", async () => {
      // Buat transaksi penjualan dummy
      const sale = await prisma.salesRecord.create({
        data: {
          id: `SALE-RET-QA3-${timestamp}`,
          transactionNumber: `INV-RET-QA3-${timestamp}`,
          saleDate: new Date("2026-11-02T00:00:00.000Z"),
          createdAt: new Date(),
          transactionAt: new Date("2026-11-02T00:00:00.000Z"),
          tipeId: "test-tipe-retail",
          tipeCodeSnapshot: "RETAIL",
          tipeNameSnapshot: "Retail",
          customerName: "Budi Santoso",
          paymentMethod: "CASH",
          approvalStatus: "approved",
          total: new Prisma.Decimal(250000),
          createdByRoleSnapshot: "FINANCE",
          createdByUserId: testActor.id,
          createdByNameSnapshot: testActor.name,
          items: {
            create: [
              {
                id: `ITEM-RET-QA3-${timestamp}`,
                productRef: testProductCodeA,
                productId: testProductIdA,
                warehouseNameSnapshot: "Gudang Utama",
                rackNameSnapshot: "R-01",
                quantity: new Prisma.Decimal(2),
                unitPrice: new Prisma.Decimal(125000),
                sortOrder: 1
              }
            ]
          }
        }
      });

      // Buat draft retur penjualan
      const draftReturn = await createSalesReturn(
        {
          salesRecordId: sale.id,
          returnDate: "2026-11-02",
          refundMethod: "REFUND_CASH",
          items: [
            {
              salesRecordItemId: `ITEM-RET-QA3-${timestamp}`,
              productRef: testProductCodeA,
              productName: "Cat Tembok Nippon Paint 5kg",
              unit: "KALENG",
              quantity: 2,
              unitPrice: 125000,
              unitCostPrice: 95000,
              reason: "Kelebihan beli"
            }
          ]
        },
        testActor
      );

      expect(draftReturn).toBeDefined();
      expect(draftReturn?.status).toBe("DRAFT");

      // Stok A sebelum posting retur adalah 60
      const stockBefore = await prisma.warehouseStock.findFirst({
        where: {
          productId: testProductIdA,
          warehouse: "Gudang Utama",
          rack: "R-01"
        }
      });
      const qtyBefore = Number(stockBefore?.quantity);

      // Post retur
      const postedReturn = await postSalesReturn(draftReturn!.id, testActor);
      expect(postedReturn).toBeDefined();
      expect(postedReturn?.status).toBe("POSTED");

      // Stok A bertambah +2 (60 -> 62)
      const stockAfter = await prisma.warehouseStock.findFirst({
        where: {
          productId: testProductIdA,
          warehouse: "Gudang Utama",
          rack: "R-01"
        }
      });
      expect(Number(stockAfter?.quantity)).toBe(qtyBefore + 2);

      // Cek mutasi RETURN_IN
      const returnMov = await prisma.stockMovement.findFirst({
        where: {
          productId: testProductIdA,
          referenceId: postedReturn?.returnNumber,
          type: "RETURN_IN"
        }
      });
      expect(returnMov).toBeDefined();
      expect(Number(returnMov?.quantity)).toBe(2);
      expect(Number(returnMov?.balanceAfter)).toBe(qtyBefore + 2);

      // Cleanup Sales Return
      await prisma.salesReturnItem.deleteMany({ where: { salesReturnId: postedReturn!.id } });
      if (postedReturn?.journalEntryId) {
        await prisma.journalLine.deleteMany({ where: { journalEntryId: postedReturn.journalEntryId } });
        await prisma.journalEntry.delete({ where: { id: postedReturn.journalEntryId } });
      }
      await prisma.salesReturn.delete({ where: { id: postedReturn!.id } });
      await prisma.salesRecordItem.deleteMany({ where: { salesRecordId: sale.id } });
      await prisma.salesRecord.delete({ where: { id: sale.id } });
    });
  });

  describe("5. No-Happy Path & Edge Cases", () => {
    it("item dengan kuantitas 0 tidak memicu mutasi stok atau pengurangan palsu", async () => {
      const saleId = `SALE-QA3-ZERO-${timestamp}`;
      const res = await releaseSaleStock({
        saleId,
        saleDate: "2026-11-02",
        sourceNumber: saleId,
        items: [
          {
            productId: testProductIdA,
            productRef: testProductCodeA,
            quantity: 0,
            warehouseNameSnapshot: "Gudang Utama",
            rackNameSnapshot: "R-01"
          }
        ]
      });

      expect(res.success).toBe(true);

      const movements = await prisma.stockMovement.findMany({
        where: { referenceId: saleId }
      });
      expect(movements.length).toBe(0);
    });

    it("pembatalan referensi yang tidak pernah rilis stok mengembalikan status sukses aman tanpa error", async () => {
      const res = await cancelStockRelease({
        reference: `NON-EXISTENT-REF-${timestamp}`,
        reason: "Testing cancel missing ref"
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("reversed");
    });
  });
});
