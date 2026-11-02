import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const DEFAULT_CSV_PATH = path.join(process.cwd(), "data", "stock-opname-template.csv");

async function generateTemplate(outputPath = DEFAULT_CSV_PATH) {
  console.log("=== Men-generate Template CSV Stok Opname dari Master Barang ===");
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      stocks: true
    },
    orderBy: [
      { category: "asc" },
      { name: "asc" }
    ]
  });

  console.log(`Ditemukan ${products.length} barang aktif.`);

  const header = "kode_barang,nama_barang,kategori,satuan,gudang,rak,stok_sistem,stok_fisik_nyata,catatan\n";
  const rows = products.map((p) => {
    const totalStock = p.stocks.reduce((acc, s) => acc + Number(s.quantity || 0), 0);
    const cleanCode = `"${(p.code || "").replace(/"/g, '""')}"`;
    const cleanName = `"${(p.name || "").replace(/"/g, '""')}"`;
    const cleanCat = `"${(p.category || "").replace(/"/g, '""')}"`;
    const cleanUnit = `"${(p.unit || "PCS").replace(/"/g, '""')}"`;
    const warehouse = `"${(p.defaultWarehouse || "Toko").replace(/"/g, '""')}"`;
    const rack = `"${(p.defaultRack || "").replace(/"/g, '""')}"`;
    return `${cleanCode},${cleanName},${cleanCat},${cleanUnit},${warehouse},${rack},${totalStock},,`;
  });

  fs.writeFileSync(outputPath, header + rows.join("\n"), "utf8");
  console.log(`✓ Template berhasil disimpan ke: ${outputPath}`);
  console.log(`Petunjuk: Buka file tersebut di Excel/Spreadsheet, isi kolom 'stok_fisik_nyata', lalu jalankan:`);
  console.log(`node scripts/import-initial-stock-opname.mjs --import`);
}

async function importStockOpname(csvPath = DEFAULT_CSV_PATH) {
  console.log(`=== Memulai Import Saldo Awal Stok Opname dari: ${csvPath} ===`);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`File CSV tidak ditemukan di: ${csvPath}. Jalankan dengan --export terlebih dahulu untuk membuat template.`);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    console.log("File CSV kosong atau hanya berisi header.");
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Simple CSV row parser handling quotes
  function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  const dataLines = lines.slice(1);
  console.log(`Memproses ${dataLines.length} baris data...`);

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    const code = cols[0];
    const warehouse = cols[4] || "Toko";
    const rack = cols[5] || "";
    const physicalQtyStr = cols[7];
    const notes = cols[8] || "Saldo awal stok opname fisik";

    if (!code) continue;

    // If physicalQty is empty, skip
    if (physicalQtyStr === undefined || physicalQtyStr === null || physicalQtyStr.trim() === "") {
      skippedCount++;
      continue;
    }

    const physicalQty = Number(physicalQtyStr);
    if (Number.isNaN(physicalQty)) {
      console.warn(`[Skip] Nilai stok fisik tidak valid untuk kode '${code}': '${physicalQtyStr}'`);
      skippedCount++;
      continue;
    }

    try {
      const product = await prisma.product.findUnique({
        where: { code }
      });

      if (!product) {
        console.warn(`[Not Found] Produk dengan kode '${code}' tidak ditemukan di database.`);
        errorCount++;
        continue;
      }

      const existingStock = await prisma.warehouseStock.findUnique({
        where: {
          productId_warehouse_rack: {
            productId: product.id,
            warehouse,
            rack
          }
        }
      });

      const balanceBefore = existingStock ? Number(existingStock.quantity) : 0;
      const balanceAfter = physicalQty;
      const difference = balanceAfter - balanceBefore;

      if (difference === 0 && existingStock) {
        // Already matching
        skippedCount++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.warehouseStock.upsert({
          where: {
            productId_warehouse_rack: {
              productId: product.id,
              warehouse,
              rack
            }
          },
          create: {
            productId: product.id,
            warehouse,
            rack,
            quantity: new Prisma.Decimal(balanceAfter)
          },
          update: {
            quantity: new Prisma.Decimal(balanceAfter)
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            warehouse,
            rack,
            type: "OPNAME",
            quantity: new Prisma.Decimal(Math.abs(difference)),
            balanceBefore: new Prisma.Decimal(balanceBefore),
            balanceAfter: new Prisma.Decimal(balanceAfter),
            referenceType: "STOCK_OPNAME",
            referenceId: `OPNAME-${Date.now()}`,
            notes: notes.trim() || "Input saldo awal stok opname fisik"
          }
        });
      });

      updatedCount++;
    } catch (err) {
      console.error(`[Error] Gagal mengupdate stok produk '${code}':`, err.message);
      errorCount++;
    }
  }

  console.log("=== Ringkasan Hasil Import Stok Opname ===");
  console.log(`✓ Berhasil diperbarui : ${updatedCount} barang`);
  console.log(`- Dilewati (kosong/sama): ${skippedCount} barang`);
  console.log(`! Error / Gagal      : ${errorCount} barang`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--import")) {
    const fileArgIdx = args.indexOf("--file");
    const filePath = fileArgIdx !== -1 && args[fileArgIdx + 1] ? args[fileArgIdx + 1] : DEFAULT_CSV_PATH;
    await importStockOpname(filePath);
  } else {
    // Default or --export generates template
    const fileArgIdx = args.indexOf("--file");
    const filePath = fileArgIdx !== -1 && args[fileArgIdx + 1] ? args[fileArgIdx + 1] : DEFAULT_CSV_PATH;
    await generateTemplate(filePath);
  }
}

main()
  .catch((err) => {
    console.error("Gagal menjalankan script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
