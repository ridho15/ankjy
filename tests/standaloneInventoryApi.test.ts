import { describe, it, expect, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createProduct,
  updateProduct,
  deactivateProduct,
  getProduct,
  listProducts,
  listProductTablePage,
  findProductIdBySku
} from "@/lib/api/products";
import {
  listStocks,
  listStocksPage,
  getStockDetail
} from "@/lib/api/stocks";
import {
  listProductCategories,
  listUnitOfMeasures
} from "@/lib/api/productReferences";
import { prisma } from "@/lib/db/prisma";

describe("Tahap 2: Local PostgreSQL Master Barang & Stok API", { timeout: 30000 }, () => {
  const testSku = `API-TEST-SKU-${Date.now()}`;
  let createdId = "";

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { code: { startsWith: "API-TEST-SKU-" } }
    }).catch(() => null);
  });

  describe("1. Master Barang (Products API)", () => {
    it("creates a product with initial stock and movement locally", async () => {
      const response = await createProduct({
        code: testSku,
        name: "Pipa PVC Rucika 3 Inch AW",
        category: "Sanitari & Pipa",
        unit: "BATANG",
        sellingPrice: 125000,
        costPrice: 95000,
        brand: "Rucika",
        initialStock: 50,
        minimumStock: 5,
        warehouse: "Gudang Utama",
        rack: "PIPA-01",
        isActive: true,
        notes: "Uji API Produk Lokal"
      });

      expect(response.success).toBe(true);
      if (!response.success) return;

      const data = response.data as any;
      expect(data.code).toBe(testSku);
      expect(data.name).toBe("Pipa PVC Rucika 3 Inch AW");
      expect(data.sellingPrice).toBe(125000);
      expect(data.stockSummary?.quantity).toBe(50);
      createdId = data.id;

      // Verify in DB directly
      const dbProd = await prisma.product.findUnique({
        where: { code: testSku },
        include: { stocks: true, movements: true }
      });
      expect(dbProd).not.toBeNull();
      expect(dbProd!.stocks.length).toBe(1);
      expect(Number(dbProd!.stocks[0].quantity)).toBe(50);
      expect(dbProd!.movements.length).toBe(1);
      expect(dbProd!.movements[0].type).toBe("INITIAL");
    });

    it("rejects duplicate product creation with DUPLICATE_CODE", async () => {
      const duplicateRes = await createProduct({
        code: testSku,
        name: "Pipa PVC Duplikat",
        category: "Sanitari",
        unit: "BATANG",
        sellingPrice: 125000,
        costPrice: 95000,
        initialStock: 0,
        minimumStock: 0,
        warehouse: "Toko",
        isActive: true
      });

      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.code).toBe("DUPLICATE_CODE");
    });

    it("fetches product by ID or SKU locally", async () => {
      const byId = await getProduct(createdId);
      expect(byId.success).toBe(true);
      if (byId.success) {
        expect(byId.data.code).toBe(testSku);
        expect(byId.data.stockSummary?.quantity).toBe(50);
      }

      const bySku = await getProduct(testSku);
      expect(bySku.success).toBe(true);
      if (bySku.success) {
        expect(bySku.data.id).toBe(createdId);
      }

      const notFound = await getProduct("NON-EXISTENT-ID-12345");
      expect(notFound.success).toBe(false);
      expect(notFound.code).toBe("NOT_FOUND");
    });

    it("finds product id by SKU", async () => {
      const found = await findProductIdBySku(testSku);
      expect(found.success).toBe(true);
      expect(found.data).toBe(createdId);

      const notFound = await findProductIdBySku("UNKNOWN-SKU-999");
      expect(notFound.success).toBe(true);
      expect(notFound.data).toBeUndefined();
    });

    it("lists products and paginates from PostgreSQL", async () => {
      const listRes = await listProducts();
      expect(listRes.success).toBe(true);
      expect(Array.isArray(listRes.data)).toBe(true);
      expect(listRes.data.length).toBeGreaterThan(0);

      const pageRes = await listProductTablePage({
        page: 1,
        pageSize: 10,
        keyword: "Rucika"
      });
      expect(pageRes.success).toBe(true);
      expect(pageRes.data.data.some((item) => item.code === testSku)).toBe(true);
    });

    it("updates product details in PostgreSQL", async () => {
      const updateRes = await updateProduct(createdId, {
        code: testSku,
        name: "Pipa PVC Rucika 3 Inch AW (Updated)",
        category: "Sanitari & Pipa",
        unit: "BATANG",
        sellingPrice: 130000,
        costPrice: 98000,
        brand: "Rucika Jaya",
        initialStock: 50,
        minimumStock: 8,
        warehouse: "Gudang Utama",
        rack: "PIPA-02",
        isActive: true,
        notes: "Catatan diperbarui"
      });

      expect(updateRes.success).toBe(true);
      if (updateRes.success) {
        const prod = updateRes.data as any;
        expect(prod.name).toBe("Pipa PVC Rucika 3 Inch AW (Updated)");
        expect(prod.sellingPrice).toBe(130000);
        expect(prod.costPrice).toBe(98000);
      }
    });

    it("deactivates product in PostgreSQL", async () => {
      const deactRes = await deactivateProduct(createdId);
      expect(deactRes.success).toBe(true);

      const fetched = await getProduct(createdId);
      expect(fetched.success).toBe(true);
      if (fetched.success) {
        expect(fetched.data.isActive).toBe(false);
      }
    });
  });

  describe("2. Stok Barang (Stocks API)", () => {
    it("reads stocks directly from WarehouseStock table", async () => {
      const stockList = await listStocks({ sku: testSku });
      expect(stockList.success).toBe(true);
      expect(stockList.data.length).toBeGreaterThan(0);
      expect(stockList.data[0].productCode).toBe(testSku);
      expect(stockList.data[0].quantity).toBe(50);
      expect(stockList.data[0].warehouse).toBe("Gudang Utama");
    });

    it("paginates and filters stocks correctly", async () => {
      const pageRes = await listStocksPage({
        keyword: testSku,
        page: 1,
        pageSize: 10
      });
      expect(pageRes.success).toBe(true);
      expect(pageRes.data.data.length).toBe(1);
      expect(pageRes.data.data[0].productCode).toBe(testSku);
    });

    it("retrieves stock detail with breakdown and summary", async () => {
      const detailRes = await getStockDetail(createdId);
      expect(detailRes.success).toBe(true);
      expect(detailRes.data.sku).toBe(testSku);
      expect(detailRes.data.summary.quantity).toBe(50);
      expect(detailRes.data.stocks.length).toBeGreaterThan(0);
    });
  });

  describe("3. Referensi Produk (Categories & UoMs)", () => {
    it("returns product categories locally without calling Aneka Jaya ERP", async () => {
      const catRes = await listProductCategories();
      expect(catRes.success).toBe(true);
      expect(catRes.data.length).toBeGreaterThan(0);
      expect(catRes.data.some((c) => c.name === "Sanitari & Pipa")).toBe(true);
    });

    it("returns unit of measures locally without calling Aneka Jaya ERP", async () => {
      const uomRes = await listUnitOfMeasures();
      expect(uomRes.success).toBe(true);
      expect(uomRes.data.length).toBeGreaterThan(0);
      expect(uomRes.data.some((u) => u.name === "BATANG" || u.name === "PCS")).toBe(true);
    });
  });
});
