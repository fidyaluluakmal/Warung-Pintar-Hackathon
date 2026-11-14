import { useMemo } from "react"
import { useWarung } from "../lib/store"
import { hariIni, rupiah, rupiahRingkas, sapaan } from "../lib/format"
import { labaKotor, round2 } from "../lib/inventory"

/**
 * Beranda: ringkasan hari ini + tiga aksi besar.
 *
 * Semua angka dihitung dari data yang sudah dimuat, bukan dari AI.
 */
export function Beranda({ onPindah }: { onPindah: (halaman: "suara" | "nota" | "tanya" | "stok") => void }) {
  const { sesi, transaksi, baris, stok, saranBeli } = useWarung()

  const ringkasan = useMemo(() => {
    const hariIniIso = new Date().toISOString().slice(0, 10)
    const hariIniWib = hariIni()

    const penjualanHariIni = transaksi.filter((t) => t.tipe === "jual" && t.tanggal.slice(0, 10) === hariIniIso)
    const omzet = penjualanHariIni.reduce((sum, t) => sum + t.total, 0)

    // Modal barang terjual: harga modal x qty dari baris transaksi penjualan.
    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const modalTerjual = baris
      .filter((row) => penjualanHariIni.some((t) => t.id === row.transaksi_id))
      .reduce((sum, row) => sum + row.jumlah * (hargaModal.get(row.barang_id) ?? 0), 0)

    const stokTipis = stok.filter((s) => s.stok <= s.min_stok)

    return {
      omzet: round2(omzet),
      labaKotor: labaKotor(omzet, modalTerjual),
      jumlahTransaksi: penjualanHariIni.length,
      stokTipis,
      hariIniWib,
    }
  }, [transaksi, baris, stok])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          {sapaan()}, {sesi?.pemilik ?? "Pak Andi"}
        </h1>
        <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
          {ringkasan.hariIniWib}
        </p>
      </div>

      <section className="kartu p-4">
        <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
          Omzet hari ini
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{rupiah(ringkasan.omzet)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
              Laba kotor
            </p>
            <p className="text-base font-semibold">{rupiah(ringkasan.labaKotor)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
              Transaksi
            </p>
            <p className="text-base font-semibold">{ringkasan.jumlahTransaksi}</p>
          </div>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--teks-lembut)" }}>
          Laba kotor = penjualan − modal barang terjual. Belum laba bersih.
        </p>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="tombol-utama !min-h-20 flex-col !gap-1" onClick={() => onPindah("suara")}>
          <span className="text-2xl" aria-hidden="true">
            🎙️
          </span>
          <span className="text-sm">Catat suara</span>
        </button>
        <button type="button" className="tombol-utama !min-h-20 flex-col !gap-1" onClick={() => onPindah("nota")}>
          <span className="text-2xl" aria-hidden="true">
            📷
          </span>
          <span className="text-sm">Foto nota</span>
        </button>
        <button type="button" className="tombol-utama !min-h-20 flex-col !gap-1" onClick={() => onPindah("tanya")}>
          <span className="text-2xl" aria-hidden="true">
            💬
          </span>
          <span className="text-sm">Tanya AI</span>
        </button>
      </div>

      {ringkasan.stokTipis.length > 0 && (
        <section className="kartu p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Hampir habis</h2>
            <button
              type="button"
              className="text-xs font-medium"
              style={{ color: "var(--aksen)" }}
              onClick={() => onPindah("stok")}
            >
              Lihat semua
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {ringkasan.stokTipis.slice(0, 4).map((barang) => (
              <li key={barang.barang_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{barang.nama}</span>
                <span className="chip shrink-0" style={{ color: "var(--peringatan)" }}>
                  sisa {barang.stok} {barang.satuan}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saranBeli.length > 0 && (
        <section className="kartu p-4">
          <h2 className="text-sm font-semibold">Saran Belanja Besok</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--teks-lembut)" }}>
            Dihitung dari penjualan 30 hari terakhir. Ada alasan untuk tiap angka.
          </p>
          <ul className="mt-3 space-y-3">
            {saranBeli.slice(0, 3).map((saran) => (
              <li key={saran.barangId}>
                <p className="text-sm font-medium">
                  Beli {saran.qty} {saran.satuan} {saran.nama}
                </p>
                <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
                  {saran.alasan}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transaksi.length === 0 && (
        <section className="kartu p-4 text-center">
          <p className="text-sm" style={{ color: "var(--teks-lembut)" }}>
            Belum ada transaksi. Coba tekan <strong>Catat suara</strong> dan ucapkan barang yang
            terjual.
          </p>
        </section>
      )}

      <p className="pb-2 text-center text-xs" style={{ color: "var(--teks-lembut)" }}>
        Total omzet 30 hari: {rupiahRingkas(
          transaksi.filter((t) => t.tipe === "jual").reduce((sum, t) => sum + t.total, 0),
        )}
      </p>
    </div>
  )
}
