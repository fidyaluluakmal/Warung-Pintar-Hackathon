import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { useWarung } from "../lib/store"
import { angka, rupiah } from "../lib/format"
import { jamWib, selisihHari, tanggalWib } from "../lib/calendar"
import type { BarisTransaksi, Transaksi } from "../lib/types"

type Filter = "semua" | "jual" | "beli" | "sesuaikan"

interface ItemRiwayat {
  nama: string
  jumlah: number
  satuan: string
}

interface BarisRiwayat {
  transaksi: Transaksi
  item: ItemRiwayat[]
}

/**
 * Riwayat — jejak setiap transaksi.
 *
 * Penting untuk pemilik warung: barang masuk dari nota tetap ada buktinya —
 * siapa yang mencatat, dari mana, dan isinya apa. Semua tanggal dihitung di
 * zona waktu warung (Asia/Jakarta), bukan zona waktu perangkat.
 */
export function Riwayat() {
  const { transaksi, baris, barang } = useWarung()
  const [filter, setFilter] = useState<Filter>("semua")
  const [cari, setCari] = useState("")
  const [tampil, setTampil] = useState(50)

  const namaBarang = useMemo(() => new Map(barang.map((b) => [b.id, b.nama])), [barang])

  const barisByTransaksi = useMemo(() => {
    const map = new Map<string, BarisTransaksi[]>()
    for (const row of baris) {
      const daftar = map.get(row.transaksi_id)
      if (daftar) daftar.push(row)
      else map.set(row.transaksi_id, [row])
    }
    return map
  }, [baris])

  const daftar = useMemo(() => {
    const kunci = cari.toLowerCase().trim()
    const hasil: BarisRiwayat[] = []

    for (const trx of transaksi) {
      if (filter !== "semua" && trx.tipe !== filter) continue

      const item = (barisByTransaksi.get(trx.id) ?? []).map((row) => ({
        nama: namaBarang.get(row.barang_id) ?? "Barang",
        jumlah: row.jumlah,
        satuan: row.satuan,
      }))

      if (kunci) {
        const teks = [trx.agen ?? "", ...item.map((i) => i.nama)].join(" ").toLowerCase()
        if (!teks.includes(kunci)) continue
      }

      hasil.push({ transaksi: trx, item })
    }

    // Waktu dihitung di zona waktu warung, jadi urutannya sama di HP mana pun.
    return hasil.sort((a, b) => {
      const beda = kunciWaktu(b.transaksi.tanggal).localeCompare(kunciWaktu(a.transaksi.tanggal))
      if (beda !== 0) return beda
      return b.transaksi.id.localeCompare(a.transaksi.id)
    })
  }, [barisByTransaksi, cari, filter, namaBarang, transaksi])

  const terlihat = daftar.slice(0, tampil)

  const penjualan = daftar.filter((row) => row.transaksi.tipe === "jual")
  const pembelian = daftar.filter((row) => row.transaksi.tipe === "beli")
  const totalJual = penjualan.reduce((sum, row) => sum + row.transaksi.total, 0)
  const totalBeli = pembelian.reduce((sum, row) => sum + row.transaksi.total, 0)

  return (
    <>
      <section className="page-title">
        <div>
          <span className="date-label">Jejak aktivitas</span>
          <h1>Riwayat transaksi</h1>
          <p>Semua penjualan, pembelian, dan penyesuaian stok yang tersimpan.</p>
        </div>
      </section>

      <section className="history-summary">
        <article>
          <span>Penjualan tampil</span>
          <strong>{rupiah(totalJual)}</strong>
          <small>{penjualan.length} transaksi</small>
        </article>
        <article>
          <span>Pembelian tampil</span>
          <strong>{rupiah(totalBeli)}</strong>
          <small>{pembelian.length} transaksi</small>
        </article>
        <article>
          <span>Hasil filter</span>
          <strong>{daftar.length}</strong>
          <small>{terlihat.length} transaksi ditampilkan</small>
        </article>
      </section>

      <section className="history-panel">
        <div className="history-toolbar">
          <label>
            <Icon name="search" size={18} />
            <input
              value={cari}
              onChange={(event) => {
                setCari(event.target.value)
                setTampil(50)
              }}
              placeholder="Cari nama barang..."
              aria-label="Cari nama barang"
            />
          </label>
          <div className="filter-pills">
            {(
              [
                ["semua", "Semua"],
                ["jual", "Penjualan"],
                ["beli", "Pembelian"],
                ["sesuaikan", "Penyesuaian"],
              ] as Array<[Filter, string]>
            ).map(([nilai, label]) => (
              <button
                key={nilai}
                type="button"
                className={filter === nilai ? "active" : ""}
                onClick={() => {
                  setFilter(nilai)
                  setTampil(50)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="history-list">
          {terlihat.map((row) => {
            const trx = row.transaksi
            const judul =
              trx.tipe === "jual"
                ? "Penjualan"
                : trx.tipe === "beli"
                  ? trx.agen
                    ? `Pembelian dari ${trx.agen}`
                    : "Pembelian"
                  : "Penyesuaian stok"
            const nada = trx.tipe === "jual" ? "green" : "orange"
            const ikon = trx.tipe === "jual" ? "up" : trx.tipe === "beli" ? "down" : "edit"
            const jumlah = trx.tipe === "jual" ? `+${rupiah(trx.total)}` : trx.tipe === "beli" ? `−${rupiah(trx.total)}` : rupiah(trx.total)

            return (
              <div className="history-item" key={trx.id}>
                <span className={`transaction-icon ${nada}`}>
                  <Icon name={ikon} size={18} />
                </span>
                <div className="history-copy">
                  <strong>{judul}</strong>
                  <small>{ringkasBarang(row.item)}</small>
                  <small>
                    {labelHari(trx.tanggal)} · {jamWib(trx.tanggal)} WIB · {labelSumber(trx)}
                  </small>
                </div>
                <b className={trx.tipe === "sesuaikan" ? undefined : nada}>{jumlah}</b>
              </div>
            )
          })}

          {daftar.length > terlihat.length && (
            <button
              type="button"
              className="history-more"
              onClick={() => setTampil((count) => count + 50)}
            >
              Tampilkan 50 transaksi lagi ({daftar.length - terlihat.length} tersisa)
            </button>
          )}

          {daftar.length === 0 && (
            <div className="empty-state">
              <Icon name="clock" size={26} />
              <strong>Belum ada transaksi</strong>
              <span>Transaksi yang Anda catat akan muncul di sini.</span>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

/** Ringkas isi transaksi: "Gula Pasir 2 pcs, Susu 1 kaleng". */
function ringkasBarang(item: ItemRiwayat[]): string {
  if (item.length === 0) return "Tanpa rincian barang"
  const tampil = item.slice(0, 3).map((baris) => {
    return `${baris.nama} ${angka(baris.jumlah, baris.jumlah % 1 === 0 ? 0 : 2)} ${baris.satuan}`
  })
  const sisanya = item.length - tampil.length
  return tampil.join(", ") + (sisanya > 0 ? `, +${sisanya} barang lain` : "")
}

/** "Hari ini", "Kemarin", atau tanggal lengkap di zona waktu warung. */
function labelHari(iso: string): string {
  const selisih = selisihHari(iso)
  if (selisih <= 0) return "Hari ini"
  if (selisih === 1) return "Kemarin"
  return tanggalIndo(iso)
}

/** Tanggal "14 November 2026" dari tanggal warung (bukan jam perangkat). */
function tanggalIndo(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${tanggalWib(iso)}T00:00:00Z`))
}

/** Kunci urut waktu di zona waktu warung: "2026-11-14 12:45". */
function kunciWaktu(iso: string): string {
  return `${tanggalWib(iso)} ${jamWib(iso).replace(".", ":")}`
}

function labelSumber(trx: Transaksi): string {
  if (trx.sumber === "suara") return "dicatat lewat suara"
  if (trx.sumber === "nota") return "dari nota belanja"
  return "dicatat manual"
}
