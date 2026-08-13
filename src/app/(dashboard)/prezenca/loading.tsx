/** Band-for-band skeleton matching the Prezenca layout. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="-mx-4 mb-6 border-b border-[#e2e8f0] bg-white px-4 py-5 md:-mx-10 md:px-10">
        <div className="h-3 w-24 rounded bg-[#eef2f7]" />
        <div className="mt-2 h-6 w-40 rounded bg-[#eef2f7]" />
      </div>
      <div className="space-y-6">
        <div className="h-[64px] rounded-xl border border-[#e2e8f0] bg-white" />
        <div className="h-[320px] rounded-xl border border-[#e2e8f0] bg-white" />
      </div>
    </div>
  );
}
