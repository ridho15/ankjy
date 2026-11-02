import "server-only";
import { anikaRequest } from "./anikaClient";
import { sendNeoCommand } from "./neo";
import type { ApiResponse } from "@/lib/types/api";
import { failure } from "@/lib/types/api";
import type { Product, ProductListItem, ProductStockSummary } from "@/lib/types/product";
import type { StockItem } from "@/lib/types/stock";
import type { BarangInput } from "@/lib/validation/barangSchema";
import { recordAudit } from "@/lib/audit/store";
import { toProduct, toProductListItem } from "@/lib/api/erpMappers";
import { listErpPaginated } from "@/lib/api/pagination";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type ProductPageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProductTablePage = {
  data: ProductListItem[];
  meta: ProductPageMeta;
};

export type ProductListOptions = {
  page?: number;
  pageSize?: number;
  keyword?: string;
};

export type OfficialProductInput = {
  sku: string;
  name: string;
  productCategoryId?: number;
  uomId?: number;
  brandCode?: string;
  sellPrice?: number;
  costPrice?: number;
  description?: string;
};

const DEFAULT_PRODUCT_PAGE = 1;
const DEFAULT_PRODUCT_PAGE_SIZE = 50;
const MAX_PRODUCT_PAGE_SIZE = 100;

function isLocalInventoryMode(): boolean {
  return process.env.INVENTORY_SOURCE !== "erp";
}

function clampPage(value?: number) {
  return Number.isFinite(value) && value && value > 0
    ? Math.floor(value)
    : DEFAULT_PRODUCT_PAGE;
}

function clampPageSize(value?: number) {
  if (!Number.isFinite(value) || !value || value <= 0)
    return DEFAULT_PRODUCT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(value), 1), MAX_PRODUCT_PAGE_SIZE);
}

function normalizeKeyword(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function filterProductItems(items: ProductListItem[], keyword?: string) {
  const value = normalizeKeyword(keyword);
  if (!value) return items;
  return items.filter((item) =>
    `${item.code} ${item.name} ${item.category ?? ""}`
      .toLowerCase()
      .includes(value),
  );
}

export function paginateProductItems(
  items: ProductListItem[],
  options: ProductListOptions = {},
): ProductTablePage {
  const page = clampPage(options.page);
  const pageSize = clampPageSize(options.pageSize);
  const filtered = filterProductItems(items, options.keyword);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    meta: { page: safePage, pageSize, total, totalPages },
  };
}

type DbProductWithStocks = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  sellingPrice: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  brand: string | null;
  minimumStock: Prisma.Decimal;
  defaultWarehouse: string;
  defaultRack: string | null;
  isActive: boolean;
  notes: string | null;
  updatedAt: Date;
  stocks?: {
    id: string;
    productId: string;
    warehouse: string;
    rack: string;
    quantity: Prisma.Decimal;
    updatedAt: Date;
  }[];
};

function toProductFromDb(row: DbProductWithStocks): Product {
  const stocks = row.stocks || [];
  const totalQty = stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
  const minStock = Number(row.minimumStock) || 0;

  const stockBreakdown: StockItem[] = stocks.map((s) => ({
    id: s.id,
    productId: row.id,
    productCode: row.code,
    productName: row.name,
    warehouse: s.warehouse,
    warehouseId: s.warehouse,
    warehouseCode: s.warehouse,
    quantity: Number(s.quantity),
    unit: row.unit,
    minimumStock: minStock,
    rack: s.rack || undefined,
    isLowStock: Number(s.quantity) <= minStock,
    ready: Number(s.quantity) > 0,
    updatedAt: s.updatedAt.toISOString(),
  }));

  const stockSummary: ProductStockSummary = {
    quantity: totalQty,
    reservedQuantity: 0,
    freeQuantity: totalQty,
    onHandQuantity: totalQty,
    minimumStock: minStock,
    warehouseCount: new Set(stocks.map((s) => s.warehouse)).size,
    rackCount: new Set(stocks.map((s) => s.rack).filter(Boolean)).size,
    isLowStock: totalQty <= minStock,
  };

  return {
    id: row.id,
    productId: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    sellingPrice: Number(row.sellingPrice),
    costPrice: Number(row.costPrice),
    brand: row.brand || undefined,
    minimumStock: minStock,
    warehouse: row.defaultWarehouse,
    rack: row.defaultRack || undefined,
    isActive: row.isActive,
    notes: row.notes || undefined,
    updatedAt: row.updatedAt.toISOString(),
    stockSummary,
    stockBreakdown,
  };
}

export async function listProducts(): Promise<ApiResponse<Product[]>> {
  if (isLocalInventoryMode()) {
    try {
      const rows = await prisma.product.findMany({
        include: { stocks: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      });
      return {
        success: true,
        data: rows.map(toProductFromDb),
      };
    } catch (err: any) {
      return failure(`Gagal memuat produk dari database lokal: ${err?.message}`, "DATABASE_ERROR");
    }
  }

  const response = await listErpPaginated("/products", {
    query: { include_stock: true },
  });
  if (!response.success)
    return response.code === "ERP_SCHEMA"
      ? failure("Format data produk dari ERP tidak dikenali.", "ERP_SCHEMA")
      : response;
  const rows = response.data;
  if (!Array.isArray(rows))
    return failure("Format data produk dari ERP tidak dikenali.", "ERP_SCHEMA");
  return {
    success: true,
    data: rows.map((row) => toProduct(row as Record<string, unknown>)),
  };
}

export async function listProductTableItems(): Promise<
  ApiResponse<ProductListItem[]>
> {
  const products = await listProducts();
  if (!products.success) return products;
  return { success: true, data: products.data.map(toProductListItem) };
}

export async function listProductTablePage(
  options: ProductListOptions = {},
): Promise<ApiResponse<ProductTablePage>> {
  const products = await listProductTableItems();
  if (!products.success) return products;
  return { success: true, data: paginateProductItems(products.data, options) };
}

export async function getProduct(id: string): Promise<ApiResponse<Product>> {
  if (isLocalInventoryMode()) {
    const row = await prisma.product.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { stocks: true },
    });
    if (!row) return failure("Barang tidak ditemukan.", "NOT_FOUND");
    return { success: true, data: toProductFromDb(row) };
  }

  const products = await listProducts();
  if (!products.success) return products;
  const product = products.data.find((item) => item.id === id);
  return product
    ? { success: true, data: product }
    : failure("Barang tidak ditemukan.", "NOT_FOUND");
}

function numberId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0)
    return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim()))
    return Number(value);
  return undefined;
}

function normalizeLookup(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function responseId(value: unknown) {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  const nested =
    row?.data && typeof row.data === "object"
      ? (row.data as Record<string, unknown>)
      : undefined;
  return (
    numberId(row?.id) ??
    numberId(row?.product_id) ??
    numberId(nested?.id) ??
    numberId(nested?.product_id)
  );
}

export async function findProductIdBySku(
  sku: string,
): Promise<ApiResponse<string | number | undefined>> {
  const cleanSku = sku.trim();
  if (!cleanSku) return { success: true, data: undefined };

  if (isLocalInventoryMode()) {
    const row = await prisma.product.findUnique({
      where: { code: cleanSku },
      select: { id: true },
    });
    return { success: true, data: row?.id };
  }

  const response = await listErpPaginated("/products", {
    maxPages: 2,
    query: { sku: cleanSku },
  });
  if (!response.success) return response;
  const normalized = normalizeLookup(cleanSku);
  const match = response.data
    .map((row) => toProduct(row as Record<string, unknown>))
    .find(
      (product) =>
        normalizeLookup(product.code) === normalized ||
        normalizeLookup(product.id) === normalized ||
        normalizeLookup(product.productId) === normalized,
    );
  return {
    success: true,
    data: numberId(match?.productId) ?? numberId(match?.id),
  };
}

export async function createOfficialProduct(
  input: OfficialProductInput,
): Promise<ApiResponse<string | number>> {
  if (isLocalInventoryMode()) {
    const cleanSku = input.sku.trim();
    const product = await prisma.product.upsert({
      where: { code: cleanSku },
      create: {
        code: cleanSku,
        name: input.name.trim(),
        sellingPrice: new Prisma.Decimal(input.sellPrice ?? 0),
        costPrice: new Prisma.Decimal(input.costPrice ?? 0),
        notes: input.description || null,
        isActive: true,
      },
      update: {},
    });

    await prisma.warehouseStock.upsert({
      where: {
        productId_warehouse_rack: {
          productId: product.id,
          warehouse: "Toko",
          rack: "",
        },
      },
      create: {
        productId: product.id,
        warehouse: "Toko",
        rack: "",
        quantity: new Prisma.Decimal(0),
      },
      update: {},
    });

    await recordAudit({
      entityType: "product",
      entityId: input.sku,
      action: "create",
      afterValue: {
        sku: input.sku,
        name: input.name,
        source: "sales_manual_product",
      },
      reason: "Produk dibuat otomatis di database lokal dari transaksi SLM",
    });

    return { success: true, data: product.id };
  }

  const response = await anikaRequest<unknown>("/products", {
    method: "POST",
    body: JSON.stringify({
      sku: input.sku,
      name: input.name,
      product_category_id: input.productCategoryId,
      kode_merk: input.brandCode,
      uom_id: input.uomId,
      cost_price: input.costPrice ?? 0,
      sell_price: input.sellPrice ?? 0,
      description: input.description || undefined,
      is_active: true,
    }),
  });
  if (!response.success) return response;
  const id = responseId(response.data);
  if (!id)
    return failure(
      "Produk ERP berhasil dibuat tetapi ID produk tidak terbaca.",
      "ERP_SCHEMA",
    );
  await recordAudit({
    entityType: "product",
    entityId: input.sku,
    action: "create",
    afterValue: {
      sku: input.sku,
      name: input.name,
      source: "sales_manual_product",
    },
    reason: "Produk ERP dibuat otomatis dari transaksi SLM",
  });
  return { success: true, data: id };
}

export async function createProduct(
  input: BarangInput,
): Promise<ApiResponse<unknown>> {
  if (isLocalInventoryMode()) {
    const existing = await prisma.product.findUnique({
      where: { code: input.code.trim() },
    });
    if (existing) {
      return failure("Kode barang sudah digunakan.", "DUPLICATE_CODE");
    }

    const initialStock = Number(input.initialStock) || 0;
    const warehouse = input.warehouse?.trim() || "Toko";
    const rack = input.rack?.trim() || "";

    const created = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          code: input.code.trim(),
          name: input.name.trim(),
          category: input.category?.trim() || "Umum",
          unit: input.unit?.trim() || "PCS",
          sellingPrice: new Prisma.Decimal(input.sellingPrice || 0),
          costPrice: new Prisma.Decimal(input.costPrice || 0),
          brand: input.brand?.trim() || null,
          minimumStock: new Prisma.Decimal(input.minimumStock || 0),
          defaultWarehouse: warehouse,
          defaultRack: rack || null,
          isActive: input.isActive ?? true,
          notes: input.notes?.trim() || null,
        },
      });

      await tx.warehouseStock.create({
        data: {
          productId: prod.id,
          warehouse,
          rack,
          quantity: new Prisma.Decimal(initialStock),
        },
      });

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: prod.id,
            warehouse,
            rack,
            type: "INITIAL",
            quantity: new Prisma.Decimal(initialStock),
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: new Prisma.Decimal(initialStock),
            referenceType: "INITIAL_STOCK",
            notes: "Stok awal master barang",
            createdByUserId: "system",
            createdByNameSnapshot: "System",
          },
        });
      }

      return tx.product.findUniqueOrThrow({
        where: { id: prod.id },
        include: { stocks: true },
      });
    });

    await recordAudit({
      entityType: "product",
      entityId: input.code,
      action: "create",
      afterValue: input,
      reason: "Master Barang & Stok • Database Lokal",
    });

    return { success: true, data: toProductFromDb(created) };
  }

  const response = await sendNeoCommand({
    text: `Tambahkan barang ${input.name} dengan kode ${input.code}.`,
    parsedIntent: {
      action: "import_products",
      products: [
        {
          sku: input.code,
          name: input.name,
          category: input.category,
          uom: input.unit,
          sell_price: input.sellingPrice,
          cost_price: input.costPrice,
          brand: input.brand || undefined,
          initial_stock: input.initialStock,
          minimum_stock: input.minimumStock,
          warehouse: input.warehouse || undefined,
          rak: input.rack || undefined,
          description: input.notes || undefined,
          is_active: input.isActive,
        },
      ],
    },
  });
  if (response.success)
    await recordAudit({
      entityType: "product",
      entityId: input.code,
      action: "create",
      afterValue: input,
      reason: "Master Barang & Stok • Terkirim",
    });
  return response;
}

export async function updateProduct(
  id: string,
  input: BarangInput,
): Promise<ApiResponse<unknown>> {
  if (isLocalInventoryMode()) {
    const current = await prisma.product.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });
    if (!current) return failure("Barang tidak ditemukan.", "NOT_FOUND");

    const updated = await prisma.product.update({
      where: { id: current.id },
      data: {
        code: input.code.trim(),
        name: input.name.trim(),
        category: input.category?.trim() || "Umum",
        unit: input.unit?.trim() || "PCS",
        sellingPrice: new Prisma.Decimal(input.sellingPrice || 0),
        costPrice: new Prisma.Decimal(input.costPrice || 0),
        brand: input.brand?.trim() || null,
        minimumStock: new Prisma.Decimal(input.minimumStock || 0),
        defaultWarehouse: input.warehouse?.trim() || "Toko",
        defaultRack: input.rack?.trim() || null,
        isActive: input.isActive ?? true,
        notes: input.notes?.trim() || null,
      },
      include: { stocks: true },
    });

    await recordAudit({
      entityType: "product",
      entityId: id,
      action: "update",
      beforeValue: current,
      afterValue: input,
      reason: "Master Barang • Database Lokal",
    });

    return { success: true, data: toProductFromDb(updated) };
  }

  const current = await getProduct(id);
  if (!current.success) return current;
  if (
    !current.data.productCategoryId ||
    !current.data.uomId ||
    !(input.brand || current.data.brandCode)
  ) {
    return failure(
      "Data ERP untuk kategori, satuan, atau merk belum lengkap. Barang tidak diperbarui.",
      "ERP_REFERENCE_MISSING",
    );
  }
  const response = await anikaRequest(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({
      sku: input.code,
      name: input.name,
      product_category_id: current.data.productCategoryId,
      kode_merk: input.brand || current.data.brandCode,
      uom_id: current.data.uomId,
      cost_price: input.costPrice,
      sell_price: input.sellingPrice,
      description: input.notes || undefined,
      is_active: input.isActive,
    }),
  });
  if (response.success)
    await recordAudit({
      entityType: "product",
      entityId: id,
      action: "update",
      beforeValue: current.data,
      afterValue: input,
      reason: "Master Barang • Terkirim",
    });
  return response;
}

export async function deactivateProduct(
  id: string,
): Promise<ApiResponse<unknown>> {
  if (isLocalInventoryMode()) {
    const current = await prisma.product.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });
    if (!current) return failure("Barang tidak ditemukan.", "NOT_FOUND");

    await prisma.product.update({
      where: { id: current.id },
      data: { isActive: false },
    });

    await recordAudit({
      entityType: "product",
      entityId: id,
      action: "update",
      beforeValue: current,
      afterValue: { ...current, isActive: false },
      reason: "Master Barang • Nonaktifkan barang lokal",
    });

    return { success: true, data: { id: current.id, isActive: false } };
  }

  const current = await getProduct(id);
  if (!current.success) return current;
  const input: BarangInput = {
    code: current.data.code,
    name: current.data.name,
    category: current.data.category || "Lain - Lain",
    unit: current.data.unit || "PCS",
    sellingPrice: current.data.sellingPrice ?? 0,
    costPrice: current.data.costPrice ?? 0,
    brand: current.data.brand || current.data.brandCode || "UMUM",
    initialStock: current.data.initialStock ?? 0,
    minimumStock: current.data.minimumStock ?? 0,
    warehouse: current.data.warehouse || "Toko",
    rack: current.data.rack || "",
    isActive: false,
    notes: current.data.notes || "",
  };
  const response = await updateProduct(id, input);
  if (response.success) {
    await recordAudit({
      entityType: "product",
      entityId: id,
      action: "update",
      beforeValue: current.data,
      afterValue: { ...current.data, isActive: false },
      reason: "Master Barang • Nonaktifkan barang di ERP",
    });
  }
  return response;
}
