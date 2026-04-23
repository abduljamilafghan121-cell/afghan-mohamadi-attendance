export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-zinc-900/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        <div className="h-3 w-3 rounded-full bg-zinc-900" />
      </div>
      <p className="mt-6 text-sm font-medium tracking-wide text-zinc-500">
        Loading…
      </p>
    </div>
  );
}
