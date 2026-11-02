import { describe, it, expect, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildTempoWhatsAppUrl } from "@/lib/tempo/store";
import { prisma } from "@/lib/db/prisma";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("Fase 2: Finansial & Data Master", () => {
  describe("1. WhatsApp 1-Klik Penagihan Tempo", () => {
    it("formats a direct WhatsApp URL with country code 62 when phone starts with 0", () => {
      const url = buildTempoWhatsAppUrl({
        phone: "08123456789",
        customerName: "Budi Santoso",
        referenceNo: "INV-2026-001",
        remainingAmount: 1500000,
        dueDate: "15 Juli 2026"
      });

      expect(url).toContain("https://wa.me/628123456789?text=");
      expect(url).toContain(encodeURIComponent("Budi Santoso"));
      expect(url).toContain(encodeURIComponent("INV-2026-001"));
      expect(url).toContain(encodeURIComponent("15 Juli 2026"));
    });

    it("handles clean phone with country code already present", () => {
      const url = buildTempoWhatsAppUrl({
        phone: "+62 819-9988-7766",
        customerName: "Toko Sinar Jaya",
        referenceNo: "INV-2026-002",
        remainingAmount: 5000000,
        dueDate: "20 Juli 2026"
      });

      expect(url).toContain("https://wa.me/6281999887766?text=");
    });

    it("fallbacks to wa.me/?text= when phone number is missing so user can choose contact", () => {
      const url = buildTempoWhatsAppUrl({
        phone: null,
        customerName: "Pelanggan Anonim",
        referenceNo: "INV-2026-003",
        remainingAmount: 250000,
        dueDate: "10 Agustus 2026"
      });

      expect(url.startsWith("https://wa.me/?text=")).toBe(true);
      expect(url).toContain(encodeURIComponent("Pelanggan Anonim"));
    });
  });

  describe("2. Tautan Rekening Bank ke COA (1-1001)", () => {
    it("verifies all active bank accounts are linked to COA 1-1001", async () => {
      const kasBank = await prisma.account.findUnique({
        where: { code: "1-1001" }
      });
      expect(kasBank).not.toBeNull();

      const unlinked = await prisma.rekeningAccount.count({
        where: { accountId: null }
      });
      expect(unlinked).toBe(0);
    });
  });

  describe("3. Tool Import Saldo Awal Stok Opname", () => {
    const testSku = `TEST-OPNAME-${Date.now()}`;
    const testCsvPath = path.join(process.cwd(), "data", `test-opname-${Date.now()}.csv`);

    afterAll(async () => {
      if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);
      await prisma.product.deleteMany({
        where: { code: testSku }
      }).catch(() => null);
    });

    it("imports physical stock opname count and records StockMovement", async () => {
      // Create a test product with 0 stock
      const product = await prisma.product.create({
        data: {
          code: testSku,
          name: "Semen Uji Opname",
          category: "Material",
          unit: "SAK",
          sellingPrice: 65000,
          defaultWarehouse: "Toko",
          isActive: true
        }
      });

      // Write test CSV
      const csvContent = `kode_barang,nama_barang,kategori,satuan,gudang,rak,stok_sistem,stok_fisik_nyata,catatan\n"${testSku}","Semen Uji Opname","Material","SAK","Toko","",0,25,"Hasil hitung gudang"\n`;
      fs.writeFileSync(testCsvPath, csvContent, "utf8");

      // Run import script via child_process
      execSync(`node scripts/import-initial-stock-opname.mjs --import --file "${testCsvPath}"`, {
        cwd: process.cwd(),
        stdio: "pipe"
      });

      // Verify stock in database
      const stock = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: product.id,
            warehouse: "Toko",
            rack: ""
          }
        }
      });

      expect(stock).not.toBeNull();
      expect(Number(stock?.quantity)).toBe(25);

      // Verify StockMovement
      const movement = await prisma.stockMovement.findFirst({
        where: {
          productId: product.id,
          type: "OPNAME"
        }
      });

      expect(movement).not.toBeNull();
      expect(Number(movement?.quantity)).toBe(25);
      expect(Number(movement?.balanceBefore)).toBe(0);
      expect(Number(movement?.balanceAfter)).toBe(25);
      expect(movement?.notes).toBe("Hasil hitung gudang");
    });
  });
});
