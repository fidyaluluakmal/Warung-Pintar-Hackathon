import type { IconName } from "../components/Icon"

export type NavLabel =
  | "Kasir"
  | "Beranda"
  | "Stok Barang"
  | "Simpen Dulu"
  | "Penjaga Margin"
  | "Cek Stok"
  | "Pelanggan"
  | "Harga Pasar"
  | "Titip Jual"
  | "Catat Suara"
  | "Foto Nota"
  | "Tanya AI"
  | "Modal Awal"
  | "Tutup Buku"
  | "Riwayat"
  | "Laporan"
  | "Asisten AI"
  | "Pengaturan"

/**
 * Menu sidebar (desktop).
 *
 * Kasir jadi menu pertama: itu yang dipakai sehari-hari. "Catat suara",
 * "foto nota", dan "tanya AI" dibuka dari kartu aksi di Beranda — bukan
 * menu, supaya sidebar tidak berdesakan.
 *
 * Tiap menu pakai ikon sendiri. Ikon yang sama buat dua menu di grup yang
 * sama bikin orang salah klik.
 */
export const nav: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Kasir", icon: "receipt" },
  { label: "Beranda", icon: "home" },
  { label: "Stok Barang", icon: "box" },
  { label: "Simpen Dulu", icon: "wallet" },
  { label: "Penjaga Margin", icon: "warning" },
  { label: "Cek Stok", icon: "scan" },
  { label: "Pelanggan", icon: "user" },
  { label: "Titip Jual", icon: "tag" },
  { label: "Harga Pasar", icon: "search" },
]

/** Menu kelompok kedua: hal-hal yang dipakai sesekali. */
export const navLain: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Modal Awal", icon: "edit" },
  { label: "Tutup Buku", icon: "clock" },
  { label: "Laporan", icon: "chart" },
  { label: "Asisten AI", icon: "spark" },
  { label: "Riwayat", icon: "arrow" },
  { label: "Pengaturan", icon: "settings" },
]

/** Menu bawah (mobile) — 4 menu utama. */
export const mobileNav: Array<{ label: NavLabel; icon: IconName }> = [
  { label: "Kasir", icon: "receipt" },
  { label: "Beranda", icon: "home" },
  { label: "Stok Barang", icon: "box" },
  { label: "Simpen Dulu", icon: "wallet" },
]
