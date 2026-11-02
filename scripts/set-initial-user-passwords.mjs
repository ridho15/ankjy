import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

const prisma = new PrismaClient();
const KEY_LENGTH = 64;

function hashPassword(password) {
  const normalized = password.trim();
  if (normalized.length < 8) throw new Error("Password minimal 8 karakter.");
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(normalized, salt, KEY_LENGTH).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const defaultPassword = process.env.INITIAL_STAFF_PASSWORD || "SlmStaff2026!";
  const passwordHash = hashPassword(defaultPassword);

  const usersWithoutPassword = await prisma.user.findMany({
    where: {
      isActive: true,
      passwordHash: null
    }
  });

  console.log(`Menemukan ${usersWithoutPassword.length} user aktif tanpa password lokal.`);

  for (const user of usersWithoutPassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      }
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        entityType: "user",
        entityId: user.externalId || user.id,
        action: "update",
        userId: "system",
        userNameSnapshot: "System Decoupling",
        userRoleSnapshot: "OWNER",
        reason: "Set initial local password hash for decoupled standalone operation"
      }
    }).catch(() => null);

    console.log(`- Updated: [${user.role}] ${user.name} | Login: "${user.email || user.externalId}"`);
  }

  console.log(`\nPassword default yang disetel: "${defaultPassword}"`);
}

main()
  .catch((err) => {
    console.error("Gagal update password user:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
