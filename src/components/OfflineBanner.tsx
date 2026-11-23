import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, WifiOff } from 'lucide-react';
import {
  downloadOfflineDataCsv,
  downloadOfflineDataJson,
  getOfflinePendingCount,
  subscribeOfflineState,
} from '../utils/offlineSyncManager';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(() => getOfflinePendingCount());

  useEffect(() => {
    const refresh = () => {
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      setPendingCount(getOfflinePendingCount());
    };

    refresh();
    const unsub = subscribeOfflineState(refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('vcs-offline-change', refresh);

    return () => {
      unsub();
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('vcs-offline-change', refresh);
    };
  }, []);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Offline Support Controls"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-xl z-40 rounded-2xl bg-[#041C3F] text-white border border-[#D4AF37]/60 shadow-2xl px-4 py-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <WifiOff className="w-5 h-5 text-[#F6D574] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-[#F6D574]">
              {!isOnline
                ? 'Offline Mode Active'
                : `${pendingCount} Saved Offline ${pendingCount === 1 ? 'Submission' : 'Submissions'} Ready`}
            </p>
            <p className="text-slate-200 mt-0.5">
              All forms and submissions are safely preserved on this device and will complete automatically when connected.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadOfflineDataCsv}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={downloadOfflineDataJson}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
            <span>JSON</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
