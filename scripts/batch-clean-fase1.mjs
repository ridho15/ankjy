import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Memulai Batch Clean Fase 1 ===");
  const now = new Date();
  const walkInMethods = [
    "di Tempat", "di tempat", "Ambil Sendiri", "ambil sendiri",
    "pickup", "Pickup", "di toko", "Di Toko"
  ];

  // 1. Batch close historical walk-in DOs
  const walkInDOs = await prisma.deliveryOrder.findMany({
    where: {
      status: "belum_selesai",
      salesRecord: {
        shippingMethod: { in: walkInMethods }
      }
    },
    select: { id: true }
  });

  const doIds = walkInDOs.map((d) => d.id);
  console.log(`Menemukan ${doIds.length} Delivery Order walk-in berstatus belum_selesai.`);

  if (doIds.length > 0) {
    const updatedDOs = await prisma.deliveryOrder.updateMany({
      where: { id: { in: doIds } },
      data: {
        status: "selesai",
        packingStatus: "sudah",
        shippingStatus: "sudah",
        packedAt: now,
        shippedAt: now
      }
    });

    // Update items to isShipped: true
    const updatedItems = await prisma.$executeRawUnsafe(`
      UPDATE "DeliveryOrderItem"
      SET "isShipped" = true,
          "shippedQuantity" = "quantity",
          "shippedAt" = $1
      WHERE "deliveryOrderId" = ANY($2::text[])
    `, now, doIds);

    console.log(`✓ Berhasil menutup ${updatedDOs.count} Delivery Order walk-in.`);
    console.log(`✓ Berhasil mengupdate ${updatedItems} item Delivery Order menjadi shipped.`);
  }

  // 2. Clean up false-alarm stock release errors on SalesRecord
  const updatedSales = await prisma.salesRecord.updateMany({
    where: {
      stockReleaseStatus: "failed"
    },
    data: {
      stockReleaseStatus: "not_required",
      stockReleaseError: null
    }
  });

  console.log(`✓ Berhasil membersihkan ${updatedSales.count} status failed stock release menjadi not_required.`);
  console.log("=== Batch Clean Fase 1 Selesai ===");
}

main()
  .catch((err) => {
    console.error("Gagal menjalankan batch clean:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
