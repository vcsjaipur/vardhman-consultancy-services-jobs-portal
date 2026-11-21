export function JobCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 animate-pulse space-y-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="h-3.5 w-36 rounded-md bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-slate-200" />
          <div className="w-8 h-8 rounded-lg bg-slate-200" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-5 w-4/5 rounded-md bg-slate-200" />
        <div className="h-3.5 w-2/3 rounded-md bg-slate-100" />
      </div>
      <div className="space-y-2 pt-1">
        <div className="h-3.5 w-1/2 rounded-md bg-slate-100" />
        <div className="h-3.5 w-2/5 rounded-md bg-slate-200" />
        <div className="h-3.5 w-1/3 rounded-md bg-slate-100" />
      </div>
      <div className="pt-4 border-t border-slate-100 flex items-center gap-2.5">
        <div className="h-10 flex-1 rounded-xl bg-slate-200" />
        <div className="h-10 w-20 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export function JobListRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="w-11 h-11 rounded-lg bg-slate-200 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-36 rounded bg-slate-200" />
            <div className="h-5 w-3/5 rounded bg-slate-200" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-24 rounded-md bg-slate-200" />
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="flex gap-5">
        <div className="h-3.5 w-28 rounded bg-slate-100" />
        <div className="h-3.5 w-24 rounded bg-slate-100" />
      </div>
      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <div className="h-10 w-32 rounded-lg bg-slate-200" />
        <div className="h-5 w-28 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function DashboardCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 space-y-4" aria-label="Loading records">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 animate-pulse flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="space-y-3 flex-1">
            <div className="h-5 w-1/2 rounded-md bg-slate-200" />
            <div className="h-4 w-1/3 rounded-md bg-slate-100" />
            <div className="flex flex-wrap gap-4">
              <div className="h-3.5 w-24 rounded bg-slate-100" />
              <div className="h-3.5 w-24 rounded bg-slate-100" />
              <div className="h-3.5 w-24 rounded bg-slate-100" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-5 w-24 rounded bg-slate-200" />
            <div className="h-9 w-36 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsightsPostSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-5" aria-label="Loading official updates">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 animate-pulse space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-3 w-32 rounded bg-slate-100" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-5 w-3/4 rounded bg-slate-200" />
            <div className="h-3.5 w-full rounded bg-slate-100" />
            <div className="h-3.5 w-5/6 rounded bg-slate-100" />
          </div>
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
            <div className="h-9 rounded-xl bg-slate-100" />
            <div className="h-9 rounded-xl bg-slate-100" />
            <div className="h-9 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AiPanelSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 animate-pulse space-y-2.5" aria-hidden="true">
      <div className="h-4 w-44 rounded bg-slate-200" />
      <div className="h-3 w-full rounded bg-slate-200" />
      <div className="h-3 w-5/6 rounded bg-slate-100" />
      <div className="flex gap-2 pt-1">
        <div className="h-6 w-20 rounded-md bg-slate-200" />
        <div className="h-6 w-24 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
