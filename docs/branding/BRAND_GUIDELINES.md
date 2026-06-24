# PagaPRO — udhëzues brand

Platformë operative për pagat, punonjësit dhe dokumentacionin juridik në Kosovë. Pamja duhet të komunikojë **besueshmëri**, **strukturë** dhe **sofistikim korporativ** — jo SaaS argëtues, jo gradientë, jo estetikë „startup tech“.

---

## 1. Logo kryesor (wordmark)

**Struktura:** `Paga` + `PRO` (një fjalë e vetme lexuese).

| Element | Ngjyra | Përdorimi |
|---------|--------|-----------|
| **Paga** | `#0B1220` (navy i errët) | Pesha vizuale kryesore; besueshmëri |
| **PRO** | `#2563EB` (blu profesional) | Theksi „professional / operational“ |

**Tipografi:** Inter (ose ekuivalent: Source Sans 3, IBM Plex Sans). **Bold / Extrabold** për `PRO`.

**Tracking:** i ngushtë (`letter-spacing` negativ lehtë) — pamje **premium dhe operative**.

**Mos:** gradientë, ikona të mbivendosura, simbole të përthyera.

---

## 2. Variacion kompakt

I njëjti raport ngjyrash dhe pesha, por **madhësi më e vogël teksti** (header mobil, toolbar, tabela PDF të dendura).

Implementim: komponenti `PagaProLogoCompact` / prop `variant="compact"`.

---

## 3. Ikona / favicon

**Koncept:** katror i rrumbullakosur (`rx≈8`), sfond `#0B1220`, monogram **PP** — `P` e parë `#F4F7FB`, `P` e dytë `#2563EB`.

**Pse PP:** i lexueshëm në madhësi të vogël; lidhet me **PagaPRO** pa konkurrencë me marka të tjera „P“.

Skedari: [`src/app/icon.svg`](../../src/app/icon.svg).

---

## 4. Çift tipografik

| Roli | Familja | Pesha | Shënim |
|------|---------|-------|--------|
| UI & raporte | **Inter** | 400–700 | Kryesor; lexueshmëri në forma dhe tabella |
| Tituj raportesh / PDF | Inter | 600–700 | I njëjti familje — konsistencë |
| Numra / tabellar | Inter `tabular-nums` | — | Paga, orare |
| Opsionale (vetëm dokumente juridike të eksportuara) | **Source Serif 4** për paragrafe të gjata | 400 | Vetëm në shabllone DOCX/PDF ligjor nëse kërkohet më vonë |

---

## 5. Shembuj përdorimi në dashboard

- Header workspace: wordmark kompakt ose ikonë + fjalë në ekrane të ngushta.
- Zona kryesore e punës: sfond i lehtë `#F4F7FB`; karta të bardha për kontrast.
- Vija ndarëse dhe header tabele: përdor navy të markës për aksente të kufizuara.

---

## 6. Sidebar

Sfond i errët operacional (HSL slate në UI); wordmark **`variant="onDark"`**:

- `Paga`: `#E8EDF5` (i lexueshëm mbi sidebar të errët).
- `PRO`: `#2563EB`.

---

## 7. PDF / raporte

Përdorni [`ReportBrandHeader`](../../src/components/branding/report-brand-header.tsx):

- Vijë poshtë `#0B1220` (2px).
- Logo mark + wordmark në krye.
- Titull raporti në `#111827`; meta në `#6B7280`.

**Kontrata / dokumente juridike:** wordmark në krye të faqes së parë; tipografi e pastër dhe hapësirë e bardhë.

---

## Paleta

| Token | Hex |
|-------|-----|
| Navy kryesor | `#0B1220` |
| Blu profesional | `#2563EB` |
| Sfond kanavacë | `#F4F7FB` |
| Tekst | `#111827` |
| Tekst sekondar | `#6B7280` |

Kodet: [`src/components/branding/brand-tokens.ts`](../../src/components/branding/brand-tokens.ts).

---

## Çfarë të shmangni

- Gradientë, neon, ilustrime „friendly“, ikona playful.
- Logo me efekte 3D ose glow.
- Ngjyra jashtë paletës për komunikimin kryesor të markës.
