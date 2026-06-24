# PagaPRO — dizajn sistem dhe përgjigje në rrjet

Ky dokument përmbledh bazën UI që është në kod (`tailwind.config.ts`, `src/app/globals.css`, `src/components/ui`, `src/components/layout`, `src/components/patterns`).

## Tema (Tailwind + CSS variables)

- **Workspace**: `background` i bardhë / gri shumë i çeltë në zonën kryesore (`bg-background`).
- **Sidebar**: hijë slate (`sidebar-*`), pa gradientë — sipërfaqje të sheshtë operacionale.
- **Tekst**: `foreground` i errët; përësëritje me `muted-foreground` për përshkrime.
- **Rahtësi**: `--radius` 6px — qoshe pak të rrumbullakëta, korporative jo „bubble SaaS”.
- **Hiqdhmjet**: `shadow-card` dhe `shadow-sm` në nivel të dobët rgb slate — pa efekt glow.

## Shell aplikacioni

| Brenda pamjes | Sjellja |
|---------------|---------|
| **Sidebar** `AppSidebar` | `md+`: fiks majtas `w-60`, tekst dhe ikona për çdo modul |
| **Header** `AppHeader` | Ngjitës kryesi — ndërprues kompanie (demo), njoftime, profil |
| **MobileNav** | Poshtë (`fixed`), scroll horizontal për 8 modulet + `safe-area-inset-bottom` |
| **Hapësira kryesore** | Padding horizontal gjërësish të përgjegjshëm + `max-w-[1400px]` |

### Rregulla përgjigje në rrjet

- **`< md`**: sidebar fshihet; header përmban markën dhe kontrollin e kompanisë; hapësira e bardhë mbështet **bottom nav**.
- **`≥ md`**: sidebar gjithmonë i dukshëm; `md:pl-60` për përmbajtjen kryesore.
- **Tabela në mobil**: mbështet `overflow-auto` në kontejnerin e `Table`; përdorni toolbar të vetër për “Filtra” / kërkim.
- **Forma të gjera**: `FormStack` kufizon në `max-w-xl`; hapësira më të gjera përmes rrjetës për një kolonë.

## Komponentët bazë (`src/components/ui`)

- **Button**: variantet `default`, `secondary`, `ghost`, `destructive`, `outlinePrimary`, `link`; madhësitë `default`, `sm`, `lg`, `icon`.
- **Badge**: `default`, `secondary`, `outline`, `success`, `warning`, `destructive`.
- **Card**: kokë me vijë ndarëse, përmbajtje dhe footer për veprime për një kartë.
- **Table**: koka në `bg-muted/60`; për dendësi shtoni klasën globale `table-dense` te `<table>`.

## Shembuj përdorimi (`src/components/patterns`)

| Komponent | Kur të përdoret |
|-----------|-----------------|
| `PageHeader` | Titull + përshkrim + veprime djathtas në çdo faqe |
| `DataTableShell` | Toolbar + tabelë e mbështjellë |
| `FormStack` / `FormField` | Forma të njëpasnjëshme me hapësirë vertikale konsistente |
| `EmptyState` | Lista bosh me ikonë dhe veprim opsional |
| `LoadingState` | Skeleton për `loading.tsx` ose Suspense |
| `ErrorState` | Gabime të lexueshme + „Riprovo” |

## Gjuhë UI

- Tekstet e navigimit dhe shembujt janë në **shqip** (sq në `<html lang="sq">`).
- Mesazhet e aksesueshmërisë (`aria-label`, `sr-only`) gjithashtu në shqip kur është e mundur.

## Shënim

Pa logjikë biznesi — vetëm bazë UI dhe navigim statik.
