import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../components/Icon"
import { AsistenSidebar } from "../components/AsistenSidebar"
import { useWarung } from "../lib/store"
import { callAskWarung } from "../lib/api"
import {
  bangunKonteks,
  instruksiUntukSesi,
  judulOtomatis,
  PERTANYAAN_CEPAT,
  sapaan,
  type SesiLengkap,
} from "../lib/asisten"
import { penyimpananAsisten } from "../lib/asistenData"
import type { PesanAsisten, Proyek } from "../lib/types"

/**
 * Asisten warung — halaman penuh, ala ChatGPT.
 *
 * Kolom kiri berisi sesi dan proyek, kolom kanan berisi percakapan. Semua
 * angka yang tampil berasal dari catatan warung sendiri: AI hanya menyusun
 * kalimatnya, tidak pernah menghitung ulang.
 */
export function AsistenAi() {
  const { sesi: akun, transaksi, baris, barang, stok, utang, saranBeli } = useWarung()
  const [sesi, setSesi] = useState<SesiLengkap[]>([])
  const [proyek, setProyek] = useState<Proyek[]>([])
  const [pesan, setPesan] = useState<PesanAsisten[]>([])
  const [sesiAktifId, setSesiAktifId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [koloTerbuka, setKoloTerbuka] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const simpanan = useMemo(() => penyimpananAsisten(), [])

  const muat = useCallback(async () => {
    try {
      const data = await simpanan.muat()
      setProyek(data.proyek)
      setSesi(data.sesi.map((s) => ({ ...s, jumlahPesan: 0 })))
      setPesan(data.pesan)
      // Tidak langsung membuka percakapan terakhir. Yang dibuka adalah layar
      // kosong yang menyapa — daftar sesi di kolom kiri untuk melanjutkan
      // yang lama.
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof Error
          ? "Riwayat asisten belum bisa dimuat. Coba lagi nanti."
          : "Riwayat asisten belum bisa dimuat.",
      )
    }
  }, [simpanan])

  useEffect(() => {
    void muat()
  }, [muat])

  // Jumlah pesan per sesi, buat sidebar.
  const sesiLengkap = useMemo(() => {
    const hitung = new Map<string, number>()
    for (const p of pesan) hitung.set(p.sesi_id, (hitung.get(p.sesi_id) ?? 0) + 1)
    return sesi.map((s) => ({ ...s, jumlahPesan: hitung.get(s.id) ?? 0 }))
  }, [sesi, pesan])

  const sesiAktif = useMemo(
    () => sesiLengkap.find((s) => s.id === sesiAktifId) ?? null,
    [sesiLengkap, sesiAktifId],
  )

  const pesanSesi = useMemo(
    () => (sesiAktifId ? pesan.filter((p) => p.sesi_id === sesiAktifId) : []),
    [pesan, sesiAktifId],
  )

  const konteks = useMemo(
    () => bangunKonteks({ transaksi, baris, barang, stok, utang, saranBeli }),
    [transaksi, baris, barang, stok, utang, saranBeli],
  )

  const instruksi = useMemo(
    () => instruksiUntukSesi(sesiAktif, proyek),
    [sesiAktif, proyek],
  )

  // Scroll ke pesan terakhir.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [pesanSesi.length, sibuk])

  async function kirim(pertanyaan: string) {
    const teks = pertanyaan.trim()
    if (!teks || sibuk) return

    setSibuk(true)
    setGalat("")
    setInput("")
    setKoloTerbuka(false)

    try {
      // Sesi pertama: dibuat otomatis dari pertanyaan yang pertama.
      let idSesi = sesiAktifId
      if (!idSesi) {
        const baru = await simpanan.buatSesi(judulOtomatis(teks), null)
        idSesi = baru.id
        setSesi((prev) => [{ ...baru, jumlahPesan: 0 }, ...prev])
        setSesiAktifId(baru.id)
      }

      await simpanan.simpanPesan({ sesi_id: idSesi, role: "user", teks })
      const pesanUser = {
        id: `lokal-${Date.now()}`,
        owner_id: akun?.userId ?? "lokal",
        sesi_id: idSesi,
        role: "user" as const,
        teks,
        dibuat_pada: new Date().toISOString(),
      }
      setPesan((prev) => [...prev, pesanUser])

      const hasil = await callAskWarung(teks, {
        ...konteks,
        ...(instruksi ? { instruksiProyek: instruksi } : {}),
      })

      const jawaban = hasil?.answer ?? "AI belum menjawab. Angka di panel lain tetap bisa dipakai."
      await simpanan.simpanPesan({ sesi_id: idSesi, role: "assistant", teks: jawaban })
      setPesan((prev) => [
        ...prev,
        {
          id: `lokal-${Date.now()}-a`,
          owner_id: akun?.userId ?? "lokal",
          sesi_id: idSesi,
          role: "assistant",
          teks: jawaban,
          dibuat_pada: new Date().toISOString(),
        },
      ])
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof Error && /Invalid login/i.test(kesalahan.message)
          ? "Sesi masuk sudah habis. Masuk ulang, lalu coba lagi."
          : "AI sedang tidak bisa menjawab. Angka di panel lain tetap bisa dipakai.",
      )
    } finally {
      setSibuk(false)
      inputRef.current?.focus()
    }
  }

  /**
   * Mulai percakapan baru.
   *
   * Baris sesinya belum dibuat di database — baru dibuat waktu pesan
   * pertama dikirim, dengan judul otomatis dari pertanyaannya. Kalau tidak,
   * sidebar penuh baris "Sesi baru" yang isinya kosong.
   */
  function sesiBaru() {
    setGalat("")
    setSesiAktifId(null)
    setKoloTerbuka(false)
    inputRef.current?.focus()
  }

  async function buatProyek(nama: string, instruksiProyek: string) {
    const baru = await simpanan.simpanProyek({ nama, instruksi: instruksiProyek || null })
    setProyek((prev) => [baru, ...prev])
  }

  async function ubahProyek(
    id: string,
    ubah: { nama?: string; instruksi?: string | null },
  ) {
    await simpanan.ubahProyek(id, ubah)
    setProyek((prev) => prev.map((p) => (p.id === id ? { ...p, ...ubah } : p)))
  }

  async function hapusProyek(id: string) {
    await simpanan.hapusProyek(id)
    setProyek((prev) => prev.filter((p) => p.id !== id))
    setSesi((prev) => prev.map((s) => (s.proyek_id === id ? { ...s, proyek_id: null } : s)))
  }

  async function pindahkanSesi(sesiId: string, proyekId: string | null) {
    await simpanan.ubahSesi(sesiId, { proyek_id: proyekId })
    setSesi((prev) =>
      prev.map((s) =>
        s.id === sesiId ? { ...s, proyek_id: proyekId, diperbarui_pada: new Date().toISOString() } : s,
      ),
    )
  }

  return (
    <div className={koloTerbuka ? "asisten-halaman kolom-terbuka" : "asisten-halaman"}>
      <aside className="asisten-sisi" aria-label="Sesi dan proyek">
        <AsistenSidebar
          sesi={sesiLengkap}
          proyek={proyek}
          sesiAktifId={sesiAktifId}
          onPilihSesi={(id) => {
            setSesiAktifId(id)
            setKoloTerbuka(false)
          }}
          onSesiBaru={sesiBaru}
          onBuatProyek={buatProyek}
          onUbahProyek={ubahProyek}
          onHapusProyek={hapusProyek}
          onPindahkanSesi={pindahkanSesi}
          onTutup={() => setKoloTerbuka(false)}
          bisaTutup
          namaPemilik={akun?.pemilik}
        />
      </aside>

      {koloTerbuka && (
        <button
          type="button"
          className="asisten-tirai"
          onClick={() => setKoloTerbuka(false)}
          aria-label="Tutup daftar sesi"
        />
      )}

      <section className="asisten-utama">
        <header className="asisten-utama-head">
          <button
            type="button"
            className="asisten-menu-hp"
            onClick={() => setKoloTerbuka(true)}
            aria-label="Buka daftar sesi"
          >
            <Icon name="menu" size={18} />
          </button>
          <div>
            <strong>{sesiAktif?.judul ?? "Percakapan baru"}</strong>
            {instruksi && (
              <small className="asisten-instruksi">
                <Icon name="box" size={12} /> {instruksi}
              </small>
            )}
          </div>
        </header>

        <div className="asisten-putar" ref={scrollRef}>
          {pesanSesi.length === 0 ? (
            <div className="asisten-kosong-layar">
              <span className="asisten-orb">
                <Icon name="spark" size={26} />
              </span>
              <h2>{sapaan(akun?.pemilik)}</h2>
              <p>
                Tanya apa saja: penjualan, stok, utang, atau kapan sebaiknya kulakan. Semua angka
                diambil dari catatan warung Anda sendiri.
              </p>
              <div className="asisten-saran">
                {PERTANYAAN_CEPAT.map((pertanyaan) => (
                  <button key={pertanyaan} type="button" onClick={() => void kirim(pertanyaan)}>
                    {pertanyaan}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="asisten-pesan">
              {pesanSesi.map((item) => (
                <div key={item.id} className={`asisten-pesan-baris ${item.role}`}>
                  {item.role === "assistant" && (
                    <span className="asisten-pesan-avatar">
                      <Icon name="spark" size={13} />
                    </span>
                  )}
                  <div className="asisten-pesan-isi">
                    <p>{item.teks}</p>
                    {item.role === "assistant" && (
                      <button
                        type="button"
                        className="asisten-salin"
                        onClick={() => void navigator.clipboard.writeText(item.teks)}
                        aria-label="Salin jawaban"
                      >
                        <Icon name="receipt" size={13} /> Salin
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sibuk && (
                <div className="asisten-pesan-baris assistant">
                  <span className="asisten-pesan-avatar">
                    <Icon name="spark" size={13} />
                  </span>
                  <div className="asisten-pesan-isi">
                    <p className="asisten-menghitung">Menghitung dari data warung…</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {galat && <div className="asisten-galat">{galat}</div>}

        <form
          className="asisten-kotak"
          onSubmit={(event) => {
            event.preventDefault()
            void kirim(input)
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            placeholder="Tanya apa saja soal warung ini…"
            aria-label="Tulis pertanyaan untuk asisten"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void kirim(input)
              }
            }}
          />
          <button type="submit" disabled={sibuk || input.trim() === ""} aria-label="Kirim pertanyaan">
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <p className="asisten-catatan">
          Asisten hanya menjelaskan angka dari catatan warung Anda. Semua angka adalah estimasi.
        </p>
      </section>
    </div>
  )
}
