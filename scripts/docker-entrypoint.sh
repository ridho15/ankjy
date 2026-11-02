#!/bin/sh
set -e

echo "=========================================================="
echo "🚀 [SLM Entrypoint] Memulai container SLM Production..."
echo "=========================================================="

# Ekstrak host dan port dari DATABASE_URL jika ada
# Format umum: postgresql://user:password@host:port/database?params
if [ -n "$DATABASE_URL" ]; then
  echo "📡 [SLM Entrypoint] Menunggu koneksi database PostgreSQL..."
  
  # Loop tunggu database siap (timeout 60 detik)
  node -e '
    const url = new URL(process.env.DATABASE_URL.replace(/^postgresql:\/\//, "http://"));
    const host = url.hostname || "slm-postgres";
    const port = parseInt(url.port || "5432", 10);
    const net = require("net");

    let attempts = 0;
    const maxAttempts = 30;

    function check() {
      attempts++;
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on("connect", () => {
        console.log(`✓ Terhubung ke database PostgreSQL di ${host}:${port}`);
        socket.destroy();
        process.exit(0);
      });
      socket.on("timeout", () => {
        socket.destroy();
        retry();
      });
      socket.on("error", (err) => {
        socket.destroy();
        retry();
      });
      socket.connect(port, host);
    }

    function retry() {
      if (attempts >= maxAttempts) {
        console.error(`❌ Gagal terhubung ke database di ${host}:${port} setelah ${maxAttempts} percobaan.`);
        process.exit(1);
      }
      setTimeout(check, 1000);
    }

    check();
  '

  echo "📦 [SLM Entrypoint] Menjalankan migrasi Prisma (db:migrate:deploy)..."
  npx prisma migrate deploy || {
    echo "⚠️ Peringatan: prisma migrate deploy gagal atau ada error non-fatal, melanjutkan..."
  }

  echo "🛡️ [SLM Entrypoint] Memastikan skema kolom kompatibel..."
  node -e '
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    async function main() {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "SalesRecord" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;`);
      } catch (err) {
        console.warn("Notice: customerPhone check", err?.message);
      } finally {
        await prisma.$disconnect();
      }
    }
    main();
  ' || true

  echo "🌱 [SLM Entrypoint] Memastikan data awal Owner & Master Data (idempotent)..."
  node scripts/seed-initial-owner.mjs || true
  node scripts/seed-core-master-data.mjs || true
fi

echo "=========================================================="
echo "✅ [SLM Entrypoint] Database siap! Menjalankan Next.js..."
echo "=========================================================="

exec "$@"
