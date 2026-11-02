import { anikaRequest } from "@/lib/api/anikaClient";
import { recordAudit } from "@/lib/audit/store";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { ApiResponse } from "@/lib/types/api";
import type { StockAdjustmentInput } from "@/lib/validation/stockAdjustmentSchema";

function isLocalInventoryMode(): boolean {
  return process.env.INVENTORY_SOURCE !== "erp";
}

function toErpPayload(input: StockAdjustmentInput) {
  return {
    adjustment_number: input.adjustmentNumber || undefined,
    adjustment_date: input.adjustmentDate || undefined,
    warehouse_id: input.warehouseId,
    adjustment_type: input.adjustmentType,
    reason: input.reason,
    notes: input.notes || undefined,
    created_by: input.createdBy,
    approved_by: input.approvedBy,
    approve_now: input.approveNow,
    items: input.items.map((item) => ({
      product_id: item.productId,
      rak_id: item.rakId,
      current_qty: item.currentQty,
      adjusted_qty: item.adjustedQty,
      difference_qty: item.differenceQty,
      unit_cost: item.unitCost,
      difference_value: item.differenceValue,
      notes: item.notes || undefined
    }))
  };
}

export async function createStockAdjustment(input: StockAdjustmentInput): Promise<ApiResponse<unknown>> {
  const user = await getCurrentUser();

  if (isLocalInventoryMode()) {
    try {
      const warehouse = input.warehouseId === 1 ? "Toko" : input.warehouseId === 2 ? "Gudang Utama" : `Gudang ${input.warehouseId}`;
      const adjRef = input.adjustmentNumber || `ADJ-${Date.now()}`;

      await prisma.$transaction(async (tx) => {
        for (const item of input.items) {
          const diff = Number(item.differenceQty) || 0;
          if (diff === 0) continue;

          const productKey = String(item.productId).trim();
          let product = await tx.product.findFirst({
            where: {
              OR: [{ id: productKey }, { code: productKey }]
            }
          });

          if (!product) {
            product = await tx.product.create({
              data: {
                code: productKey,
                name: `Produk ${productKey}`,
                category: "Umum",
                unit: "PCS",
                sellingPrice: new Prisma.Decimal(item.unitCost || 0),
                defaultWarehouse: warehouse,
                isActive: true
              }
            });
          }

          const rack = item.rakId ? `Rak ${item.rakId}` : "";

          const stock = await tx.warehouseStock.upsert({
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
              quantity: new Prisma.Decimal(diff)
            },
            update: {
              quantity: { increment: new Prisma.Decimal(diff) }
            }
          });

          const balanceAfter = Number(stock.quantity);
          const balanceBefore = balanceAfter - diff;

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              warehouse,
              rack,
              type: "ADJUSTMENT",
              quantity: new Prisma.Decimal(Math.abs(diff)),
              balanceBefore: new Prisma.Decimal(balanceBefore),
              balanceAfter: new Prisma.Decimal(balanceAfter),
              referenceType: "ADJUSTMENT",
              referenceId: adjRef,
              notes: item.notes || input.reason || input.notes || "Penyesuaian stok opname",
              createdByUserId: user?.id,
              createdByNameSnapshot: user?.name
            }
          });
        }
      });

      await recordAudit({
        entityType: "stock",
        entityId: adjRef,
        action: "update",
        afterValue: {
          warehouseId: input.warehouseId,
          adjustmentType: input.adjustmentType,
          approveNow: input.approveNow,
          itemCount: input.items.length,
          success: true
        },
        reason: `Stock adjustment lokal oleh ${user?.name || "Sistem"}`
      });

      return {
        success: true,
        data: {
          adjustmentNumber: adjRef,
          warehouse,
          itemsCount: input.items.length
        }
      };
    } catch (err: any) {
      return {
        success: false,
        code: "LOCAL_STOCK_ADJUSTMENT_FAILED",
        message: `Gagal melakukan penyesuaian stok lokal: ${err?.message || "Kesalahan server"}`
      };
    }
  }

  const payload = toErpPayload(input);
  const response = await anikaRequest<unknown>("/stock-adjustments", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await recordAudit({
    entityType: "stock",
    entityId: input.adjustmentNumber || `ADJ-${Date.now()}`,
    action: response.success ? "update" : "retry_sync",
    afterValue: {
      warehouseId: input.warehouseId,
      adjustmentType: input.adjustmentType,
      approveNow: input.approveNow,
      itemCount: input.items.length,
      success: response.success,
      code: response.success ? undefined : response.code
    },
    reason: response.success
      ? `Stock adjustment terkirim ERP oleh ${user.name}`
      : `Stock adjustment gagal ERP • ${response.message}`
  });

  return response;
}
