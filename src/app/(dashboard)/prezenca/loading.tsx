/** Band-for-band skeleton matching the Prezenca layout. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="-mx-4 -mt-4 mb-6 border-b border-line bg-white px-4 py-[22px] md:-mx-10 md:-mt-6 md:px-10">
        <div className="h-3 w-24 rounded bg-fill-hover" />
        <div className="mt-2 h-6 w-40 rounded bg-fill-hover" />
      </div>
      <div className="space-y-6">
        <div className="h-[64px] rounded-xl border border-line bg-white" />
        <div className="h-[320px] rounded-xl border border-line bg-white" />
      </div>
    </div>
  );
}
