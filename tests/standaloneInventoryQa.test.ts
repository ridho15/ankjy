import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

describe("QA Testing - Standalone Inventory Database Models (Tahap 1)", { timeout: 30000 }, () => {
  const testProductCode = `QA-TEST-PROD-${Date.now()}`;
  let createdProductId = "";

  afterAll(async () => {
    // Cleanup any test products
    await prisma.product.deleteMany({
      where: { code: { startsWith: "QA-TEST-PROD-" } }
    }).catch(() => null);
  });

  describe("A. Happy Path Testing", () => {
    it("1. Successfully creates a new Product with all fields and defaults", async () => {
      const product = await prisma.product.create({
        data: {
          code: testProductCode,
          name: "Semen Portland Tiga Roda 50kg",
          category: "Material Bangunan",
          unit: "SAK",
          sellingPrice: new Prisma.Decimal(65000),
          costPrice: new Prisma.Decimal(58000),
          minimumStock: new Prisma.Decimal(10),
          brand: "Tiga Roda",
          defaultWarehouse: "Gudang Utama",
          defaultRack: "A-01",
          notes: "Produk uji QA Happy Path"
        }
      });

      expect(product).toBeDefined();
      expect(product.id).toBeTruthy();
      expect(product.code).toBe(testProductCode);
      expect(product.name).toBe("Semen Portland Tiga Roda 50kg");
      expect(product.category).toBe("Material Bangunan");
      expect(product.unit).toBe("SAK");
      expect(Number(product.sellingPrice)).toBe(65000);
      expect(Number(product.costPrice)).toBe(58000);
      expect(Number(product.minimumStock)).toBe(10);
      expect(product.isActive).toBe(true);
      expect(product.defaultWarehouse).toBe("Gudang Utama");
      expect(product.defaultRack).toBe("A-01");

      createdProductId = product.id;
    });

    it("2. Successfully initializes and updates WarehouseStock per warehouse & rack", async () => {
      const stock = await prisma.warehouseStock.create({
        data: {
          productId: createdProductId,
          warehouse: "Gudang Utama",
          rack: "A-01",
          quantity: new Prisma.Decimal(150)
        }
      });

      expect(stock).toBeDefined();
      expect(stock.productId).toBe(createdProductId);
      expect(stock.warehouse).toBe("Gudang Utama");
      expect(stock.rack).toBe("A-01");
      expect(Number(stock.quantity)).toBe(150);

      // Multi-location stock for the same product
      const stockLocation2 = await prisma.warehouseStock.create({
        data: {
          productId: createdProductId,
          warehouse: "Toko Depan",
          rack: "DISPLAY-1",
          quantity: new Prisma.Decimal(25)
        }
      });

      expect(stockLocation2.warehouse).toBe("Toko Depan");
      expect(Number(stockLocation2.quantity)).toBe(25);
    });

    it("3. Successfully records StockMovement (Kartu Stok / Mutasi)", async () => {
      const movementIn = await prisma.stockMovement.create({
        data: {
          productId: createdProductId,
          warehouse: "Gudang Utama",
          rack: "A-01",
          type: "IN_PURCHASE",
          quantity: new Prisma.Decimal(150),
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: new Prisma.Decimal(150),
          referenceType: "PURCHASE_RECEIPT",
          referenceId: "GRN-202611-0001",
          notes: "Penerimaan PO dari Pabrik",
          createdByUserId: "user-test-01",
          createdByNameSnapshot: "Admin Gudang"
        }
      });

      expect(movementIn.id).toBeTruthy();
      expect(movementIn.type).toBe("IN_PURCHASE");
      expect(Number(movementIn.quantity)).toBe(150);
      expect(Number(movementIn.balanceBefore)).toBe(0);
      expect(Number(movementIn.balanceAfter)).toBe(150);
      expect(movementIn.referenceType).toBe("PURCHASE_RECEIPT");
      expect(movementIn.referenceId).toBe("GRN-202611-0001");

      // Sale reduction movement
      const movementOut = await prisma.stockMovement.create({
        data: {
          productId: createdProductId,
          warehouse: "Gudang Utama",
          rack: "A-01",
          type: "OUT_SALE",
          quantity: new Prisma.Decimal(20),
          balanceBefore: new Prisma.Decimal(150),
          balanceAfter: new Prisma.Decimal(130),
          referenceType: "SALE",
          referenceId: "S-202611-0001",
          notes: "Penjualan Toko",
          createdByUserId: "user-kasir-01",
          createdByNameSnapshot: "Kasir 1"
        }
      });

      expect(movementOut.type).toBe("OUT_SALE");
      expect(Number(movementOut.balanceAfter)).toBe(130);
    });

    it("4. Supports relational queries from Product including stocks and movements", async () => {
      const productWithRelations = await prisma.product.findUnique({
        where: { id: createdProductId },
        include: {
          stocks: true,
          movements: { orderBy: { createdAt: "asc" } }
        }
      });

      expect(productWithRelations).not.toBeNull();
      expect(productWithRelations!.stocks.length).toBe(2);
      expect(productWithRelations!.movements.length).toBe(2);
      expect(productWithRelations!.movements[0].type).toBe("IN_PURCHASE");
      expect(productWithRelations!.movements[1].type).toBe("OUT_SALE");
    });

    it("5. Verifies Cascade Delete cleans up WarehouseStock and StockMovement", async () => {
      // Create temporary product
      const tempProd = await prisma.product.create({
        data: {
          code: `${testProductCode}-TEMP`,
          name: "Produk Sementara Uji Cascade",
          category: "Umum",
          unit: "PCS"
        }
      });

      await prisma.warehouseStock.create({
        data: {
          productId: tempProd.id,
          warehouse: "Toko",
          rack: "",
          quantity: new Prisma.Decimal(10)
        }
      });

      await prisma.stockMovement.create({
        data: {
          productId: tempProd.id,
          warehouse: "Toko",
          type: "INITIAL",
          quantity: new Prisma.Decimal(10),
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: new Prisma.Decimal(10)
        }
      });

      // Delete Product
      await prisma.product.delete({ where: { id: tempProd.id } });

      // Associated stocks and movements must be automatically purged (no orphaned rows)
      const orphanStock = await prisma.warehouseStock.findMany({ where: { productId: tempProd.id } });
      const orphanMovements = await prisma.stockMovement.findMany({ where: { productId: tempProd.id } });

      expect(orphanStock.length).toBe(0);
      expect(orphanMovements.length).toBe(0);
    });
  });

  describe("B. No-Happy Path / Unhappy Path Testing (Constraints & Boundary Checks)", () => {
    it("1. Rejects duplicate product code (Unique Constraint P2002)", async () => {
      await expect(
        prisma.product.create({
          data: {
            code: testProductCode, // duplicate of created product
            name: "Duplicate Name",
            unit: "PCS"
          }
        })
      ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);

      try {
        await prisma.product.create({
          data: {
            code: testProductCode,
            name: "Duplicate Name",
            unit: "PCS"
          }
        });
      } catch (err: any) {
        expect(err.code).toBe("P2002");
        expect(err.meta?.target).toContain("code");
      }
    });

    it("2. Rejects duplicate compound key [productId, warehouse, rack] on WarehouseStock", async () => {
      await expect(
        prisma.warehouseStock.create({
          data: {
            productId: createdProductId,
            warehouse: "Gudang Utama",
            rack: "A-01", // already exists
            quantity: new Prisma.Decimal(50)
          }
        })
      ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);

      try {
        await prisma.warehouseStock.create({
          data: {
            productId: createdProductId,
            warehouse: "Gudang Utama",
            rack: "A-01",
            quantity: new Prisma.Decimal(50)
          }
        });
      } catch (err: any) {
        expect(err.code).toBe("P2002");
      }
    });

    it("3. Rejects WarehouseStock insertion with non-existent productId (Foreign Key Constraint P2003)", async () => {
      const nonExistentId = "cuid-invalid-nonexistent-99999";

      await expect(
        prisma.warehouseStock.create({
          data: {
            productId: nonExistentId,
            warehouse: "Gudang Utama",
            rack: "B-01",
            quantity: new Prisma.Decimal(10)
          }
        })
      ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);

      try {
        await prisma.warehouseStock.create({
          data: {
            productId: nonExistentId,
            warehouse: "Gudang Utama",
            rack: "B-01",
            quantity: new Prisma.Decimal(10)
          }
        });
      } catch (err: any) {
        expect(err.code).toBe("P2003");
      }
    });

    it("4. Rejects StockMovement insertion with non-existent productId (Foreign Key Constraint P2003)", async () => {
      const nonExistentId = "cuid-invalid-nonexistent-88888";

      await expect(
        prisma.stockMovement.create({
          data: {
            productId: nonExistentId,
            warehouse: "Gudang Utama",
            type: "OUT_SALE",
            quantity: new Prisma.Decimal(5),
            balanceBefore: new Prisma.Decimal(10),
            balanceAfter: new Prisma.Decimal(5)
          }
        })
      ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);

      try {
        await prisma.stockMovement.create({
          data: {
            productId: nonExistentId,
            warehouse: "Gudang Utama",
            type: "OUT_SALE",
            quantity: new Prisma.Decimal(5),
            balanceBefore: new Prisma.Decimal(10),
            balanceAfter: new Prisma.Decimal(5)
          }
        });
      } catch (err: any) {
        expect(err.code).toBe("P2003");
      }
    });

    it("5. Rejects insertion when non-nullable fields are missing", async () => {
      // @ts-expect-error intentionally missing required fields: code and name
      await expect(prisma.product.create({ data: { category: "Umum" } })).rejects.toThrow();
    });

    it("6. Accurately handles decimal fractional values without precision loss", async () => {
      const decimalProd = await prisma.product.create({
        data: {
          code: `${testProductCode}-DEC`,
          name: "Cat Tembok Tinting Kiloan",
          unit: "KG",
          sellingPrice: new Prisma.Decimal("123456.78"),
          costPrice: new Prisma.Decimal("98765.43")
        }
      });

      const fetched = await prisma.product.findUnique({ where: { id: decimalProd.id } });
      expect(fetched!.sellingPrice.toString()).toBe("123456.78");
      expect(fetched!.costPrice.toString()).toBe("98765.43");
    });
  });
});
