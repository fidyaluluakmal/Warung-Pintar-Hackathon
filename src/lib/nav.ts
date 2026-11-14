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
  | "Modal Awal"
  | "Tutup Buku"
  | "Riwayat"
  | "Pengaturan"

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

/** Menu kelompok kedua: hal-hal yang dipakai sesekali. */
export const navLain: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Modal Awal", icon: "chart" },
  { label: "Tutup Buku", icon: "clock" },
  { label: "Riwayat", icon: "clock" },
  { label: "Pengaturan", icon: "settings" },
]

/** Menu bawah (mobile) — 4 menu utama. */
export const mobileNav: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Kasir", icon: "receipt" },
  { label: "Beranda", icon: "home" },
  { label: "Stok Barang", icon: "box" },
  { label: "Simpen Dulu", icon: "wallet" },
]
