/**
 * Band-for-band skeleton of the real page.
 *
 * The old fallback drew four stat tiles and a 340px right rail for a page that
 * has three tiles and full-width balance panels — it described a layout that no
 * longer existed, so every load flashed the wrong shape before settling.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 pb-24 md:pb-8" aria-hidden>
      {/* Sub-bar */}
      <div className="-mx-4 border-b border-[#e2e8f0] bg-white px-4 py-4 md:-mx-8 md:px-8">
        <div className="h-3 w-40 rounded bg-[#eef2f7]" />
        <div className="mt-2 h-6 w-44 rounded bg-[#e2e8f0]" />
      </div>

      {/* Three stat tiles — three, not four. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[78px] rounded-xl border border-[#e2e8f0] bg-white" />
        ))}
      </div>

      {/* Filter form */}
      <div className="h-[104px] rounded-xl border border-[#e2e8f0] bg-white" />

      {/* Queue + calendar on the left, "Sot në pushim" on the right */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="h-56 rounded-xl border border-[#e2e8f0] bg-white" />
          <div className="h-[380px] rounded-xl border border-[#e2e8f0] bg-white" />
        </div>
        <div className="h-64 rounded-xl border border-[#e2e8f0] bg-white" />
      </div>

      {/* Balance panels, full width under the calendar. Both were roughly twice
          this tall when each employee had a card; a skeleton that keeps drawing
          the old shape reintroduces the layout shift it exists to prevent. */}
      <div className="h-[260px] rounded-xl border border-[#e2e8f0] bg-white" />
      <div className="h-[150px] rounded-xl border border-[#e2e8f0] bg-white" />
    </div>
  );
}
