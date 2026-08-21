/**
 * Shared route-level skeleton: the real AppSubBar geometry (full-bleed white
 * strip, exact negative margins and padding) plus generic content bands.
 * A loader that draws the wrong page makes hydration look like a bug — this
 * one draws the shell every route shares and stays vague below it.
 */
export function RouteLoading({ bands = [180, 320, 240] }: { bands?: number[] }) {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="-mx-4 -mt-4 mb-6 border-b border-line bg-white px-4 py-[22px] md:-mx-10 md:-mt-6 md:px-10">
        <div className="h-3 w-24 rounded bg-fill-hover" />
        <div className="mt-2.5 h-7 w-48 rounded bg-fill-hover" />
      </div>
      <div className="space-y-5">
        {bands.map((h, i) => (
          <div key={i} style={{ height: h }} className="rounded-xl border border-line bg-white" />
        ))}
      </div>
    </div>
  );
}
