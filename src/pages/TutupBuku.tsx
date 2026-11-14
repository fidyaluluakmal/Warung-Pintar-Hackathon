import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { useWarung } from "../lib/store"
import { hariIniWib, jamWib, selisihHari, tanggalWib } from "../lib/calendar"
import { useSekarang } from "../hooks/useSekarang"
import { angka, angkaRapi, rupiah, tanggalPanjang, tanggalShort } from "../lib/format"
import { labaKotor, perluRestok as perluRestokSet, round2 } from "../lib/inventory"
import type { NavLabel } from "../lib/nav"

/**
 * Tutup Buku — ritual harian pemilik warung.
 *
 * Satu ringkasan yang bisa langsung dikirim ke supplier (buat order) atau ke
 * pelanggan (buat tagih utang). Semua angka dihitung dari catatan sendiri:
 * penjualan hari ini, laba kotor, belanja stok, sisa setelah belanja, utang
 * yang masih jalan, dan barang yang perlu dibeli besok.
 *
 * Semua tanggal memakai zona waktu warung (WIB), bukan jam perangkat.
 */

/** Satu catatan tutup laci: uang yang dihitung fisik vs catatan penjualan. */
interface CatatanLaci {
  at: string
  dihitung: number
  catatan: number
}

const KUNCI_LACI = "warung-pintar-laci-v1"

/** Baca riwayat laci dari perangkat ini. Aman dipanggil sebelum DOM siap. */
function bacaLaci(): CatatanLaci[] {
  if (typeof window === "undefined") return []
  try {
    const mentah = window.localStorage.getItem(KUNCI_LACI)
    if (!mentah) return []
    const data = JSON.parse(mentah) as CatatanLaci[]
    if (!Array.isArray(data)) return []
    return data
      .filter((item) => item && typeof item.at === "string")
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  } catch {
    return []
  }
}

function simpanLaci(catatan: CatatanLaci[]): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(KUNCI_LACI, JSON.stringify(catatan.slice(0, 30)))
  } catch {
    // Penyimpanan penuh: riwayat dilewati, angka tetap tampil.
  }
}

/** Selisih uang di laci terhadap catatan: positif = lebih, negatif = kurang. */
function selisihLaci(item: CatatanLaci): number {
  return item.dihitung - item.catatan
}

/** Bahasa selisih laci: sesuai / kurang / lebih. */
function nilaiLaci(item: CatatanLaci): { label: string; nada: "sesuai" | "kurang" | "lebih" } {
  const selisih = selisihLaci(item)
  if (selisih === 0) return { label: "Laci sesuai catatan", nada: "sesuai" }
  if (selisih < 0) {
    return { label: `Laci kurang ${rupiah(Math.abs(selisih))} dari catatan`, nada: "kurang" }
  }
  return { label: `Laci lebih ${rupiah(selisih)} dari catatan`, nada: "lebih" }
}

export function TutupBuku({ onPindah }: { onPindah?: (nav: NavLabel) => void }) {
  const { transaksi, baris, stok, saranBeli, utang } = useWarung()
  const sekarang = useSekarang()
  const [tersalin, setTersalin] = useState(false)
  const [uangLaci, setUangLaci] = useState("")
  const [riwayatLaci, setRiwayatLaci] = useState<CatatanLaci[]>(() => bacaLaci())

  const ringkasan = useMemo(() => {
    const perluRestok = perluRestokSet(saranBeli)
    const hariIni = hariIniWib()
    const penjualanHariIni = transaksi.filter(
      (t) => t.tipe === "jual" && tanggalWib(t.tanggal) === hariIni,
    )
    const belanjaHariIni = transaksi.filter(
      (t) => t.tipe === "beli" && tanggalWib(t.tanggal) === hariIni,
    )
    const idsHariIni = new Set(penjualanHariIni.map((t) => t.id))

    const omzet = penjualanHariIni.reduce((sum, t) => sum + t.total, 0)
    const biayaBelanja = belanjaHariIni.reduce((sum, t) => sum + t.total, 0)

    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const namaBarang = new Map(stok.map((s) => [s.barang_id, s.nama]))

    const barisHariIni = baris.filter((row) => idsHariIni.has(row.transaksi_id))
    const modalTerjual = barisHariIni.reduce(
      (sum, row) => sum + row.jumlah * (hargaModal.get(row.barang_id) ?? 0),
      0,
    )
    const laba = labaKotor(omzet, modalTerjual)
    const barangTerjual = barisHariIni.reduce((sum, row) => sum + row.jumlah, 0)

    // Terlaris hari ini, dihitung dari baris penjualan hari ini.
    const perBarang = new Map<string, { nama: string; qty: number; pendapatan: number }>()
    for (const row of barisHariIni) {
      const nama = namaBarang.get(row.barang_id)
      if (!nama) continue
      const sekarang = perBarang.get(row.barang_id) ?? { nama, qty: 0, pendapatan: 0 }
      sekarang.qty += row.jumlah
      sekarang.pendapatan += row.jumlah * row.harga_satuan
      perBarang.set(row.barang_id, sekarang)
    }
    const terlaris = [...perBarang.values()]
      .sort((a, b) => b.pendapatan - a.pendapatan)
      .slice(0, 3)

    // Utang yang masih jalan, dihitung dari tanggal catatannya (WIB).
    const utangJalan = utang
      .map((u) => ({
        ...u,
        sisa: Math.max(u.total - u.dibayar, 0),
        umur: selisihHari(u.tanggal),
      }))
      .filter((u) => u.sisa > 0)
      .sort((a, b) => b.umur - a.umur || b.sisa - a.sisa)
    const totalUtang = utangJalan.reduce((sum, u) => sum + u.sisa, 0)
    const utangLewatTujuh = utangJalan.filter((u) => u.umur > 7)

    // Kredit yang dibuat hari ini: bagian penjualan yang tidak dibayar.
    // Uang ini TIDAK masuk laci, jadi harus dikurangi dari perkiraan kas.
    const kreditHariIni = utang
      .filter((u) => tanggalWib(u.tanggal) === hariIni)
      .reduce((sum, u) => sum + Math.max(u.total - u.dibayar, 0), 0)

    // Stok menipis dan saran beli besok — dari mesin restok yang sama.
    const stokTipis = stok.filter((s) => perluRestok.has(s.barang_id))
    const saran = saranBeli.map((s) => ({
      ...s,
      biaya: s.qty * (hargaModal.get(s.barangId) ?? 0),
    }))
    const totalSaran = saran.reduce((sum, s) => sum + s.biaya, 0)

    const sisaSetelahBelanja = round2(omzet - biayaBelanja)

    // Perkiraan uang yang benar-benar masuk laci hari ini.
    // Penjualan tunai, dikurangi bagian yang disimpan dulu (jadi utang), dan
    // dikurangi belanja yang dibayar hari ini. Kalau ini disamakan dengan
    // omzet saja, laci selalu terbaca kurang.
    const kasMasuk = round2(omzet - kreditHariIni - biayaBelanja)
    const marginKotor = omzet > 0 ? round2((laba / omzet) * 100) : 0

    const label = tanggalPanjang(new Date().toISOString())

    const headline = susunHeadline({
      omzet,
      jumlahTransaksi: penjualanHariIni.length,
      totalUtang,
      jumlahUtangLewatTujuh: utangLewatTujuh.length,
      jumlahStokTipis: stokTipis.length,
      jumlahSaran: saran.length,
    })

    const teks = [
      `Tutup buku ${label}`,
      `Penjualan ${rupiah(omzet)} dari ${penjualanHariIni.length} transaksi · laba kotor ${rupiah(laba)}`,
      `Belanja stok ${rupiah(biayaBelanja)} · sisa setelah belanja ${rupiah(sisaSetelahBelanja)}`,
      terlaris.length > 0
        ? `Terlaris: ${terlaris.map((t) => `${t.nama} ${angka(t.qty)}`).join(", ")}`
        : null,
      utangJalan.length > 0
        ? `Utang berjalan ${rupiah(totalUtang)} (${utangJalan.length} catatan${
            utangLewatTujuh.length > 0 ? `, ${utangLewatTujuh.length} lewat 7 hari` : ""
          })`
        : null,
      saran.length > 0
        ? `Perlu dibeli besok: ${saran.map((s) => `${s.nama} ${angka(s.qty)} ${s.satuan}`).join(", ")}`
        : "Stok aman, tidak ada yang perlu dibeli besok.",
    ]
      .filter((barisTeks): barisTeks is string => barisTeks !== null)
      .join("\n")

    return {
      label,
      headline,
      kasMasuk,
      kreditHariIni: round2(kreditHariIni),
      omzet: round2(omzet),
      laba,
      biayaBelanja: round2(biayaBelanja),
      sisaSetelahBelanja,
      marginKotor,
      jumlahTransaksi: penjualanHariIni.length,
      barangTerjual: round2(barangTerjual),
      belanjaHariIni,
      terlaris,
      utangJalan,
      totalUtang: round2(totalUtang),
      utangLewatTujuh,
      stokTipis,
      saran,
      totalSaran: round2(totalSaran),
      teks,
    }
  }, [transaksi, baris, stok, saranBeli, utang, sekarang])

  // Uang yang seharusnya ada di laci: penjualan hari ini dikurangi bagian
  // yang disimpan dulu dan belanja yang dibayar hari ini.
  const harapanLaci = ringkasan.kasMasuk

  async function salin() {
    try {
      await navigator.clipboard.writeText(ringkasan.teks)
      setTersalin(true)
      window.setTimeout(() => setTersalin(false), 2500)
    } catch {
      setTersalin(false)
    }
  }

  function hitungLaci() {
    const dihitung = Number(uangLaci.replace(/[^\d]/g, "")) || 0
    const catatan: CatatanLaci = {
      at: new Date().toISOString(),
      dihitung,
      catatan: harapanLaci,
    }
    const berikut = [catatan, ...riwayatLaci].slice(0, 30)
    setRiwayatLaci(berikut)
    simpanLaci(berikut)
    setUangLaci("")
  }

  const hasilLaci = riwayatLaci[0] ?? null

  return (
    <div className="closing-page">
      <section className="page-title">
        <div>
          <span className="date-label">Ritual harian</span>
          <h1>Tutup buku</h1>
          <p>Ringkasan hari ini: uang masuk, utang yang jalan, dan yang harus dibeli besok.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-action" onClick={() => onPindah?.("Stok Barang")}>
            <Icon name="box" size={16} /> Cek stok
          </button>
          <button type="button" className="secondary-action" onClick={() => void salin()}>
            <Icon name={tersalin ? "check" : "receipt"} size={18} />
            {tersalin ? "Tersalin" : "Salin ringkasan"}
          </button>
        </div>
      </section>

      <section className="closing-hero">
        <span className="closing-date">{ringkasan.label}</span>
        <h2>{ringkasan.headline}</h2>
        <div className="closing-metrics">
          <div>
            <small>Penjualan</small>
            <strong>{rupiah(ringkasan.omzet)}</strong>
          </div>
          <div>
            <small>Laba kotor</small>
            <strong>{rupiah(ringkasan.laba)}</strong>
          </div>
          <div>
            <small>Transaksi</small>
            <strong>{ringkasan.jumlahTransaksi}</strong>
          </div>
          <div>
            <small>Barang terjual</small>
            <strong>{angkaRapi(ringkasan.barangTerjual)}</strong>
          </div>
        </div>
      </section>

      <div className="closing-grid">
        <section className="closing-block">
          <div className="closing-block-head">
            <h2>Cek laci uang</h2>
            <span>{rupiah(harapanLaci)}</span>
          </div>
          <p className="cash-expected">
            Seharusnya ada di laci <strong>{rupiah(harapanLaci)}</strong> — penjualan{" "}
            {rupiah(ringkasan.omzet)}
            {ringkasan.kreditHariIni > 0 && ` dikurangi utang ${rupiah(ringkasan.kreditHariIni)}`}
            {ringkasan.biayaBelanja > 0 && ` dikurangi belanja ${rupiah(ringkasan.biayaBelanja)}`}.
          </p>
          <div className="cash-input">
            <input
              inputMode="numeric"
              value={uangLaci}
              onChange={(event) => setUangLaci(event.target.value)}
              placeholder="Uang yang dihitung di laci"
              aria-label="Uang fisik di laci"
            />
            <button
              type="button"
              className="primary-action"
              onClick={hitungLaci}
              disabled={uangLaci.trim() === ""}
            >
              <Icon name="check" size={16} /> Hitung
            </button>
          </div>

          {hasilLaci && (
            <div className={`cash-result ${nilaiLaci(hasilLaci).nada}`}>
              <strong>{nilaiLaci(hasilLaci).label}</strong>
              <small>
                Dihitung {rupiah(hasilLaci.dihitung)} · catatan {rupiah(hasilLaci.catatan)}
              </small>
            </div>
          )}

          {riwayatLaci.length > 0 && (
            <ul className="cash-history">
              {riwayatLaci.slice(0, 5).map((item) => {
                const selisih = selisihLaci(item)
                return (
                  <li key={item.at}>
                    <span>{tanggalShort(item.at)}</span>
                    <span className={nilaiLaci(item).nada}>
                      {selisih === 0
                        ? "sesuai"
                        : `${selisih > 0 ? "+" : "−"}${rupiah(Math.abs(selisih))}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <small className="ask-note">
            Riwayat laci tersimpan di perangkat ini. Selisih belum tentu salah — bisa saja salah
            hitung.
          </small>
        </section>

        <section className="closing-block">
          <div className="closing-block-head">
            <h2>Utang berjalan</h2>
            <span>{rupiah(ringkasan.totalUtang)}</span>
          </div>
          {ringkasan.utangJalan.length === 0 ? (
            <p className="cashier-empty">Tidak ada utang tersimpan. Aman.</p>
          ) : (
            <ul className="closing-debts">
              {ringkasan.utangJalan.slice(0, 6).map((utang) => (
                <li key={utang.id}>
                  <div>
                    <strong>{utang.pelanggan}</strong>
                    <small>
                      {angkaRapi(utang.qty)} {utang.satuan} {utang.nama_barang} · {utang.umur} hari
                    </small>
                  </div>
                  {utang.umur > 7 && <span className="closing-flag">Lewat 7 hari</span>}
                  <span className="closing-amount">{rupiah(utang.sisa)}</span>
                </li>
              ))}
            </ul>
          )}
          {ringkasan.utangLewatTujuh.length > 0 && (
            <small className="ask-note">
              {ringkasan.utangLewatTujuh.length} catatan sudah lewat 7 hari — bagusnya ditagih besok
              pagi.
            </small>
          )}
        </section>

        <section className="closing-block">
          <div className="closing-block-head">
            <h2>Belanja stok</h2>
            <span>{rupiah(ringkasan.biayaBelanja)}</span>
          </div>
          <div className="closing-inline">
            <div>
              <small>Belanja stok</small>
              <strong>{rupiah(ringkasan.biayaBelanja)}</strong>
            </div>
            <div>
              <small>Penjualan hari ini</small>
              <strong>{rupiah(ringkasan.omzet)}</strong>
            </div>
            <div>
              <small>Sisa setelah belanja</small>
              <strong>{rupiah(ringkasan.sisaSetelahBelanja)}</strong>
            </div>
            <div>
              <small>Margin kotor</small>
              <strong>{angka(ringkasan.marginKotor, 1)}%</strong>
            </div>
          </div>
          {ringkasan.belanjaHariIni.length === 0 ? (
            <p className="cashier-empty">Belum ada belanja stok hari ini.</p>
          ) : (
            <div className="transaction-list">
              {ringkasan.belanjaHariIni.slice(0, 5).map((trx) => (
                <div className="transaction-item" key={trx.id}>
                  <span className="transaction-icon orange">
                    <Icon name="down" size={19} />
                  </span>
                  <div>
                    <strong>{trx.agen ?? "Pembelian"} · stok masuk</strong>
                    <small>{jamWib(trx.tanggal)} WIB</small>
                  </div>
                  <b className="orange">−{rupiah(trx.total)}</b>
                </div>
              ))}
            </div>
          )}
          <small className="ask-note">
            Sisa setelah belanja = penjualan hari ini {rupiah(ringkasan.omzet)} − belanja stok{" "}
            {rupiah(ringkasan.biayaBelanja)}.
          </small>
        </section>

        <section className="closing-block">
          <div className="closing-block-head">
            <h2>Besok: yang perlu dibeli</h2>
            <span>{rupiah(ringkasan.totalSaran)}</span>
          </div>
          {ringkasan.saran.length === 0 ? (
            <p className="cashier-empty">Stok masih aman untuk beberapa hari ke depan.</p>
          ) : (
            <ul className="closing-buy">
              {ringkasan.saran.slice(0, 6).map((saran) => (
                <li key={saran.barangId}>
                  <div>
                    <strong>
                      {saran.nama} · {angkaRapi(saran.qty)} {saran.satuan}
                    </strong>
                    <small>{saran.alasan}</small>
                  </div>
                  <span className="closing-amount">{rupiah(saran.biaya)}</span>
                </li>
              ))}
            </ul>
          )}

          {ringkasan.stokTipis.length > 0 && (
            <div className="closing-stock">
              <strong>Stok menipis</strong>
              <p>
                {ringkasan.stokTipis
                  .map((item) => `${item.nama} ${angkaRapi(item.stok)} ${item.satuan}`)
                  .join(" · ")}
              </p>
            </div>
          )}
        </section>
      </div>

      {ringkasan.terlaris.length > 0 && (
        <section className="closing-block">
          <div className="closing-block-head">
            <h2>Terlaris hari ini</h2>
            <span>{ringkasan.terlaris.length} barang</span>
          </div>
          <div className="closing-top">
            {ringkasan.terlaris.map((item) => (
              <div key={item.nama}>
                <strong>{item.nama}</strong>
                <span>
                  {angkaRapi(item.qty)} · {rupiah(item.pendapatan)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Ringkasan siap kirim</h2>
            <p>Bisa langsung dikirim ke supplier atau ke pelanggan yang menagih utang.</p>
          </div>
          <button type="button" onClick={() => void salin()}>
            {tersalin ? "Tersalin" : "Salin ringkasan"} <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="tagih-box">
          <strong>Ringkasan untuk dikirim</strong>
          <p>{ringkasan.teks}</p>
        </div>
      </section>
    </div>
  )
}

/** Satu kalimat ringkas untuk dibaca pemilik warung. */
function susunHeadline(input: {
  omzet: number
  jumlahTransaksi: number
  totalUtang: number
  jumlahUtangLewatTujuh: number
  jumlahStokTipis: number
  jumlahSaran: number
}): string {
  if (input.jumlahTransaksi === 0) {
    if (input.jumlahStokTipis > 0) {
      return `Belum ada penjualan hari ini. ${input.jumlahStokTipis} barang tinggal sedikit — siapkan dulu sebelum buka.`
    }
    return "Belum ada penjualan hari ini. Catatan tetap aman, ya."
  }
  const bagian = [
    `Penjualan hari ini ${rupiah(input.omzet)} dari ${input.jumlahTransaksi} transaksi`,
  ]
  if (input.jumlahUtangLewatTujuh > 0) {
    bagian.push(`${input.jumlahUtangLewatTujuh} utang sudah lewat 7 hari — tagih besok pagi`)
  } else if (input.totalUtang > 0) {
    bagian.push(`Utang berjalan ${rupiah(input.totalUtang)}`)
  }
  if (input.jumlahStokTipis > 0) {
    bagian.push(`${input.jumlahStokTipis} barang perlu beli ulang`)
  }
  if (input.jumlahSaran > 0) {
    bagian.push(`${input.jumlahSaran} barang siap dipesan besok`)
  }
  return `${bagian.join(". ")}.`
}
