/**
 * Pembantu untuk membaca badan request tanpa memercayai bentuk datanya.
 * Semua nilai dari AI dan dari user dicek di sini sebelum dipakai.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function nonNegativeNumber(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return undefined
  return num
}

export function positiveNumber(value: unknown): number | undefined {
  const num = nonNegativeNumber(value)
  if (num === undefined || num <= 0) return undefined
  return num
}

export function asRupiah(value: unknown): number | undefined {
  const num = nonNegativeNumber(value)
  if (num === undefined) return undefined
  return Math.round(num)
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Bersihkan nama barang dari spasi berlebih dan huruf kapital yang berlebihan. */
export function cleanName(value: unknown): string {
  const text = asString(value)
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim()
}

/** Satuan yang dikenal. Kalau tidak dikenal, pakai "pcs". */
const KNOWN_UNITS = new Set([
  "kg",
  "gram",
  "gr",
  "liter",
  "l",
  "ml",
  "pcs",
  "bungkus",
  "sachet",
  "dus",
  "botol",
  "kaleng",
  "pouch",
  "pak",
  "papan",
  "renteng",
  "box",
  "karton",
  "biji",
  "tangkai",
])

export function cleanUnit(value: unknown): string {
  const text = asString(value)?.toLowerCase()
  if (!text) return "pcs"
  const normalized = text.replace(/\.$/, "")
  return KNOWN_UNITS.has(normalized) ? normalized : "pcs"
}
