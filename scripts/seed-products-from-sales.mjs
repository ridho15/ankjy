import { PrismaClient } from "@prisma/client";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();
const prisma = new PrismaClient();

async function main() {
  console.log("Mengekstraksi data produk dari riwayat SalesRecordItem...");
  const items = await prisma.salesRecordItem.findMany({
    select: {
      productRef: true,
      manualProduct: true,
      warehouseNameSnapshot: true,
      rackNameSnapshot: true,
      unitSnapshot: true,
      unitPrice: true,
    },
    orderBy: { sortOrder: "asc" }
  });

  const productMap = new Map();
  for (const item of items) {
    const code = (item.productRef || "").trim();
    if (!code) continue;
    if (!productMap.has(code)) {
      let name = code;
      if (item.manualProduct && typeof item.manualProduct === "object") {
        const mp = item.manualProduct;
        name = mp.name || mp.title || code;
      }
      productMap.set(code, {
        code,
        name: String(name).trim() || code,
        category: "Umum",
        unit: (item.unitSnapshot || "PCS").trim() || "PCS",
        sellingPrice: Number(item.unitPrice) || 0,
        costPrice: 0,
        defaultWarehouse: (item.warehouseNameSnapshot || "Toko").trim() || "Toko",
        defaultRack: item.rackNameSnapshot ? item.rackNameSnapshot.trim() : null,
        isActive: true,
      });
    }
  }

  console.log(`Ditemukan ${productMap.size} produk unik. Menyimpan ke tabel Product...`);
  let createdCount = 0;
  for (const prod of productMap.values()) {
    try {
      const product = await prisma.product.upsert({
        where: { code: prod.code },
        create: {
          code: prod.code,
          name: prod.name,
          category: prod.category,
          unit: prod.unit,
          sellingPrice: prod.sellingPrice,
          costPrice: prod.costPrice,
          defaultWarehouse: prod.defaultWarehouse,
          defaultRack: prod.defaultRack,
          isActive: prod.isActive,
        },
        update: {},
      });

      // Pastikan ada record WarehouseStock default
      await prisma.warehouseStock.upsert({
        where: {
          productId_warehouse_rack: {
            productId: product.id,
            warehouse: prod.defaultWarehouse,
            rack: prod.defaultRack || "",
          }
        },
        create: {
          productId: product.id,
          warehouse: prod.defaultWarehouse,
          rack: prod.defaultRack || "",
          quantity: 0,
        },
        update: {},
      });

      createdCount++;
    } catch (err) {
      console.error(`Gagal menyimpan produk ${prod.code}:`, err.message);
    }
  }

  console.log(`Berhasil menyimpan ${createdCount} produk ke tabel Product & WarehouseStock.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
