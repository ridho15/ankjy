import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Menautkan Rekening Bank Nyata ke COA Kas & Bank (1-1001) ===");

  const kasBank = await prisma.account.findUnique({
    where: { code: "1-1001" }
  });

  if (!kasBank) {
    throw new Error("Akun COA 1-1001 (Kas & Bank) tidak ditemukan!");
  }

  console.log(`Akun COA target: ${kasBank.code} - ${kasBank.name} (ID: ${kasBank.id})`);

  const unlinked = await prisma.rekeningAccount.findMany({
    where: { accountId: null }
  });

  console.log(`Ditemukan ${unlinked.length} rekening belum tertaut ke COA.`);

  if (unlinked.length > 0) {
    const updated = await prisma.rekeningAccount.updateMany({
      where: { accountId: null },
      data: {
        accountId: kasBank.id
      }
    });

    console.log(`✓ Berhasil menautkan ${updated.count} rekening bank ke COA ${kasBank.code} (${kasBank.name}).`);
  }

  const allRekenings = await prisma.rekeningAccount.findMany({
    include: { account: true }
  });

  console.log(`Total rekening aktif sekarang: ${allRekenings.length}. Semuanya telah terhubung ke COA.`);
  for (const r of allRekenings) {
    console.log(`- [${r.id}] ${r.name} (${r.bankName}) -> COA: ${r.account?.code} ${r.account?.name}`);
  }

  console.log("=== Selesai Menautkan Rekening ===");
}

main()
  .catch((err) => {
    console.error("Gagal menautkan rekening ke COA:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
