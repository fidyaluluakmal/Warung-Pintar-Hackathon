# Credits & Lisensi

Semua pustaka, model, dan dataset yang dipakai aplikasi ini dicatat di sini
bersama lisensinya, sesuai aturan hackathon: sumber open-source boleh dipakai
wajib mencantumkan kredit dan lisensinya.

## Pustaka (npm)

Semua pustaka di bawah bersifat permissive — MIT atau Apache-2.0 — boleh dipakai
untuk proyek ini.

| Pustaka | Versi | Lisensi | Dipakai untuk |
| --- | --- | --- | --- |
| [react](https://github.com/facebook/react) | 19.3.1 | MIT | Antarmuka |
| [react-dom](https://github.com/facebook/react) | 19.3.1 | MIT | Render DOM |
| [@supabase/supabase-js](https://github.com/supabase/supabase-js) | 2.119.0 | MIT | Klien database + pemanggilan Edge Function |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 4.3.5 | MIT | Styling |
| [@tailwindcss/vite](https://github.com/tailwindlabs/tailwindcss) | 4.3.5 | MIT | Plugin Vite untuk Tailwind |
| [vite](https://github.com/vitejs/vite) | 8.3.8 | MIT | Bundler + server pengembangan |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | 6.3.0 | MIT | Plugin React untuk Vite |
| [typescript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 | Tipe statis |
| [vitest](https://github.com/vitest-dev/vitest) | 5.1.0 | MIT | Pengujian |
| [oxfmt](https://github.com/oxc-project/oxfmt) | 0.76.0 | MIT | Format kode |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | 19.3.0 | MIT | Tipe React |
| [@types/react-dom](https://github.com/DefinitelyTyped/DefinitelyTyped) | 19.3.0 | MIT | Tipe React DOM |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | 22.20.5 | MIT | Tipe Node.js |

## Model AI

| Model | Lisensi / Ketentuan | Dipakai untuk |
| --- | --- | --- |
| Gemini (`gemini-3.5-flash-lite`) via endpoint kompatibel OpenAI | [Google AI Studio Terms of Service](https://ai.google.dev/terms) — penggunaan gratis untuk prototipe non-komersial | Ekstraksi kalimat suara, pembacaan foto nota, penyusunan saran |

Kunci API **tidak pernah** ada di kode frontend atau repositori ini. Kunci
disimpan di Supabase Secrets dan hanya dibaca di dalam Edge Function.

## Data

| Dataset | Sumber | Lisensi / Catatan |
| --- | --- | --- |
| Data transaksi contoh | Dibuat sendiri oleh `supabase/seed.sql` | Simulasi. Bukan data warung sungguhan. |
| Katalog 12 barang + alias | Dibuat sendiri | Simulasi. |

## Lisensi kode proyek ini

MIT — lihat [LICENSE](LICENSE).
