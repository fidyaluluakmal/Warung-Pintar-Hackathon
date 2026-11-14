import type { IconName } from "../components/Icon"

export type NavLabel =
  | "Kasir"
  | "Beranda"
  | "Stok Barang"
  | "Simpen Dulu"
  | "Penjaga Margin"
  | "Catat Suara"
  | "Foto Nota"
  | "Tanya AI"

/**
 * Menu sidebar (desktop).
 *
 * Kasir jadi menu pertama: itu yang dipakai sehari-hari. "Catat suara",
 * "foto nota", dan "tanya AI" dibuka dari kartu aksi di Beranda — bukan
 * menu, supaya sidebar tidak berdesakan.
 */
export const nav: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Kasir", icon: "receipt" },
  { label: "Beranda", icon: "home" },
  { label: "Stok Barang", icon: "box" },
  { label: "Simpen Dulu", icon: "wallet" },
  { label: "Penjaga Margin", icon: "chart" },
]

/** Menu bawah (mobile) — 4 menu utama. */
export const mobileNav: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Kasir", icon: "receipt" },
  { label: "Beranda", icon: "home" },
  { label: "Stok Barang", icon: "box" },
  { label: "Simpen Dulu", icon: "wallet" },
]
