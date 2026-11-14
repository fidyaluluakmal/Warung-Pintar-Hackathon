/**
 * Pesan error untuk pengguna.
 *
 * Pesan error dari database berbahasa Inggris dan menyebut nama tabel atau
 * kolom — misalnya "duplicate key value violates unique constraint". Itu
 * tidak ada artinya buat pemilik warung, dan di depan jurit terlihat seperti
 * aplikasi rusak.
 *
 * Jadi: pesan milik aplikasi sendiri ditampilkan apa adanya; pesan dari
 * database diganti kalimat biasa.
 */

/** Pola error yang jelas-jelas berasal dari database atau jaringan. */
const TEKNIS =
  /duplicate key|violates|not-null|not null|relation |column |table |constraint|select |insert |update |delete |PG[0-9]|pgrst|schema |stack|ECONN|fetch failed|network/i

/**
 * Ubah error jadi kalimat yang bisa dibaca pemilik warung.
 *
 * `cadangan` dipakai kalau pesannya kosong atau jelas pesan teknis.
 */
export function pesanUntukUser(kesalahan: unknown, cadangan: string): string {
  const pesan =
    kesalahan instanceof Error ? kesalahan.message : String(kesalahan ?? "").trim()
  if (!pesan) return cadangan
  if (TEKNIS.test(pesan)) return cadangan
  return pesan
}
