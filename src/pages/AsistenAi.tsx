import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../components/Icon"
import { AsistenSidebar } from "../components/AsistenSidebar"
import { useWarung } from "../lib/store"
import { useSekarang } from "../hooks/useSekarang"
import { callAskWarung } from "../lib/api"
import { pesanUntukUser } from "../lib/pesan"
import {
  BATAS_PERTANYAAN,
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
 * Pesan error dari panggilan AI.
 *
 * Bedakan tiga hal: sesi masuk habis, pertanyaannya kepanjangan, dan
 * masalah jaringan. Kalau semuanya jadi satu kalimat, pemilik warung tidak
 * tahu harus-biaya apa.
 */
function pesanAI(kesalahan: unknown): string {
  const pesan = kesalahan instanceof Error ? kesalahan.message : String(kesalahan ?? "")
  const status = (kesalahan as { status?: number } | null)?.status

  if (/invalid login|session missing|auth session/i.test(pesan)) {
    return "Sesi masuk sudah habis. Masuk ulang, lalu coba lagi."
  }
  if (status === 400 || /pertanyaan terlalu panjang/i.test(pesan)) {
    return "Pertanyaannya terlalu panjang. Ringkas sedikit, lalu coba lagi."
  }
  if (/jaringan|network|fetch failed/i.test(pesan)) {
    return "Jaringan sedang bermasalah. Angka di panel lain tetap bisa dipakai."
  }
  return "AI sedang tidak bisa menjawab. Angka di panel lain tetap bisa dipakai."
}

/**
 * Asisten warung — halaman penuh, ala ChatGPT.
 *
 * Kolom kiri berisi sesi dan proyek, kolom kanan berisi percakapan. Semua
 * angka yang tampil berasal dari catatan warung sendiri: AI hanya menyusun
 * kalimatnya, tidak pernah menghitung ulang.
 */
export function AsistenAi() {
  const { sesi: akun, transaksi, baris, barang, stok, utang, saranBeli } = useWarung()
  const sekarang = useSekarang()
  const [sesi, setSesi] = useState<SesiLengkap[]>([])
  const [proyek, setProyek] = useState<Proyek[]>([])
  const [pesan, setPesan] = useState<PesanAsisten[]>([])
  const [sesiAktifId, setSesiAktifId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [koloTerbuka, setKoloTerbuka] = useState(false)
  const [tersalin, setTersalin] = useState(false)
  /** Proyek tujuan untuk percakapan yang sedang dibuat. */
  const [proyekSesiBaru, setProyekSesiBaru] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const kolomRef = useRef<HTMLDivElement>(null)
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

  // `sekarang` ikut jadi dependensi: kalau aplikasi dibiarkan semalaman,
  // "omzet hari ini" harus ikut berganti tanggalnya.
  const konteks = useMemo(
    () => bangunKonteks({ transaksi, baris, barang, stok, utang, saranBeli }, sekarang),
    [transaksi, baris, barang, stok, utang, saranBeli, sekarang],
  )

  const instruksi = useMemo(
    () => instruksiUntukSesi(sesiAktif, proyek),
    [sesiAktif, proyek],
  )

  /**
   * Instructions that were just typed.
   *
   * The textarea saves on blur, so the stored instruction is still the old
   * one when the question is sent right after typing. The question would
   * then go to the AI without the instruction — the main feature of a
   * project. So the freshest value is kept separately and sent right away.
   */
  const [instruksiSegar, setInstruksiSegar] = useState<Record<string, string>>({})

  const instruksiTerpakai = useMemo(() => {
    if (sesiAktif?.proyek_id) {
      const segar = instruksiSegar[sesiAktif.proyek_id]
      if (segar !== undefined) return segar.trim()
    }
    return instruksi
  }, [instruksi, instruksiSegar, sesiAktif])

  // The database write is delayed so it doesn't happen on every keystroke.
  const timerInstruksi = useRef<number | null>(null)
  function ubahInstruksi(proyekId: string, nilai: string) {
    setInstruksiSegar((prev) => ({ ...prev, [proyekId]: nilai }))
    if (timerInstruksi.current !== null) window.clearTimeout(timerInstruksi.current)
    timerInstruksi.current = window.setTimeout(() => {
      setProyek((prev) =>
        prev.map((p) => (p.id === proyekId ? { ...p, instruksi: nilai.trim() || null } : p)),
      )
      void simpanan.ubahProyek(proyekId, { instruksi: nilai.trim() || null })
    }, 600)
  }

  // Scroll ke pesan terakhir.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [pesanSesi.length, sibuk])

  // Kolom sesi di HP: Escape menutup, fokus masuk ke kolom, dan kembali
  // ke tombol pemicunya setelah ditutup.
  useEffect(() => {
    if (!koloTerbuka) return
    const kolom = kolomRef.current
    const sebelumnya = document.activeElement as HTMLElement | null
    const fokusPertama = kolom?.querySelector<HTMLElement>("button")
    fokusPertama?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setKoloTerbuka(false)
        return
      }
      // Fokus tidak boleh keluar dari kolom yang terbuka.
      if (event.key !== "Tab" || !kolom) return
      const bisaFokus = Array.from(
        kolom.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (bisaFokus.length === 0) return
      const pertama = bisaFokus[0]
      const terakhir = bisaFokus[bisaFokus.length - 1]
      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault()
        terakhir.focus()
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault()
        pertama.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      sebelumnya?.focus()
    }
  }, [koloTerbuka])

  // Area ketik ikut melebar mengikuti isinya, sampai batas maksimumnya.
  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = "auto"
    node.style.height = `${node.scrollHeight}px`
  }, [input])

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
        const baru = await simpanan.buatSesi(judulOtomatis(teks), proyekSesiBaru)
        idSesi = baru.id
        setSesi((prev) => [{ ...baru, jumlahPesan: 0 }, ...prev])
        setSesiAktifId(baru.id)
      }

      // Pesan user langsung masuk ke layar dulu, baru disimpan. Kalau
      // disimpan dulu dan gagal, pertanyaannya hilang tanpa jejak.
      const pesanUser = {
        id: `lokal-${Date.now()}`,
        owner_id: akun?.userId ?? "lokal",
        sesi_id: idSesi,
        role: "user" as const,
        teks,
        dibuat_pada: new Date().toISOString(),
      }
      setPesan((prev) => [...prev, pesanUser])
      try {
        await simpanan.simpanPesan({ sesi_id: idSesi, role: "user", teks })
      } catch {
        // Pesan tetap tampil di layar; hanya riwayat serverside yang belum
        // lengkap.
      }

      const hasil = await callAskWarung(teks, {
        ...konteks,
        ...(instruksiTerpakai ? { instruksiProyek: instruksiTerpakai } : {}),
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
      setGalat(pesanAI(kesalahan))
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
    try {
      const baru = await simpanan.simpanProyek({ nama, instruksi: instruksiProyek || null })
      setProyek((prev) => [baru, ...prev])
      setGalat("")
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Proyeknya belum bisa disimpan. Coba lagi."))
    }
  }

  async function ubahProyek(
    id: string,
    ubah: { nama?: string; instruksi?: string | null },
  ) {
    try {
      await simpanan.ubahProyek(id, ubah)
      setProyek((prev) => prev.map((p) => (p.id === id ? { ...p, ...ubah } : p)))
      setGalat("")
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Instruksi proyeknya belum bisa disimpan. Coba lagi."))
    }
  }

  async function hapusProyek(id: string) {
    try {
      await simpanan.hapusProyek(id)
      setProyek((prev) => prev.filter((p) => p.id !== id))
      setSesi((prev) => prev.map((s) => (s.proyek_id === id ? { ...s, proyek_id: null } : s)))
      setGalat("")
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Proyeknya belum bisa dihapus. Coba lagi."))
    }
  }

  async function pindahkanSesi(sesiId: string, proyekId: string | null) {
    try {
      await simpanan.ubahSesi(sesiId, { proyek_id: proyekId })
      setSesi((prev) =>
        prev.map((s) =>
          s.id === sesiId
            ? { ...s, proyek_id: proyekId, diperbarui_pada: new Date().toISOString() }
            : s,
        ),
      )
      setGalat("")
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Sesi itu belum bisa dipindahkan. Coba lagi."))
    }
  }

  async function hapusSesi(sesiId: string) {
    try {
      await simpanan.hapusSesi(sesiId)
      setSesi((prev) => prev.filter((s) => s.id !== sesiId))
      setPesan((prev) => prev.filter((p) => p.sesi_id !== sesiId))
      setSesiAktifId((sekarang) => (sekarang === sesiId ? null : sekarang))
      setGalat("")
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Sesi itu belum bisa dihapus. Coba lagi."))
    }
  }

  /**
   * Salin teks ke papan klip.
   *
   * `navigator.clipboard` tidak ada di konteks yang tidak aman — persis seperti
   * saat demo di HP lewat alamat jaringan lokal. Jadi ada cara cadangan.
   */
  async function salin(teks: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(teks)
      } else {
        const sementara = document.createElement("textarea")
        sementara.value = teks
        sementara.setAttribute("readonly", "")
        sementara.style.position = "fixed"
        sementara.style.opacity = "0"
        document.body.appendChild(sementara)
        sementara.select()
        document.execCommand("copy")
        document.body.removeChild(sementara)
      }
      setTersalin(true)
      window.setTimeout(() => setTersalin(false), 2000)
    } catch {
      setGalat("Teksnya belum bisa disalin. Pilih dan salin manual ya.")
    }
  }

  return (
    <div className={koloTerbuka ? "asisten-halaman kolom-terbuka" : "asisten-halaman"}>
      <aside className="asisten-sisi" aria-label="Sesi dan proyek" ref={kolomRef}>
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
          onHapusSesi={hapusSesi}
          onUbahInstruksi={ubahInstruksi}
          onPilihProyekSesiBaru={setProyekSesiBaru}
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
            {instruksiTerpakai && (
              <small className="asisten-instruksi">
                <Icon name="box" size={12} /> {instruksiTerpakai}
              </small>
            )}
          </div>
        </header>

        <div className="asisten-putar" ref={scrollRef}>
          {/*
            Wadah transkripnya selalu ada, walau kosong. Kalau baru dibuat
            waktu jawaban pertama masuk, pembaca layar tidak akan
           mengumumkan apa-apa: live region harus sudah ada sebelum
            isinya berubah.
          */}
          <div className="asisten-pesan" role="log" aria-live="polite" aria-busy={sibuk}>
          {pesanSesi.length === 0 && !sibuk ? (
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
            <>
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
                        onClick={() => void salin(item.teks)}
                        aria-label="Salin jawaban"
                      >
                        <Icon name="receipt" size={13} /> {tersalin ? "Tersalin" : "Salin"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          </div>
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
            maxLength={BATAS_PERTANYAAN}
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
