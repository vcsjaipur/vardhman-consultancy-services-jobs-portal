import { Check, Home, LayoutDashboard, Search } from 'lucide-react';
import { CongratulationsContext } from '../types/portal';

interface CongratulationsPageProps {
  context: CongratulationsContext;
  onBackHome: () => void;
  onSearchJobs: () => void;
  onGoToDashboard?: () => void;
}

export function CongratulationsPage({
  context,
  onBackHome,
  onSearchJobs,
  onGoToDashboard,
}: CongratulationsPageProps) {
  const isApply = context.type === 'apply';

  return (
    <div className="bg-gradient-to-br from-slate-100 via-[#F4F7FB] to-[#E6EEF8] min-h-[calc(100vh-5rem)] border-b border-slate-200 flex items-center">
      <div className="w-full">
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden text-center">
            <div className="h-2 bg-gradient-to-r from-[#063B7A] via-[#F58220] to-[#0A8E43]" />

            <div className="p-6 sm:p-10">
              {/* Big Green Tick */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-gradient-to-br from-[#0A8E43] to-[#077235] text-white flex items-center justify-center shadow-lg shadow-[#0A8E43]/30 ring-4 ring-[#0A8E43]/15">
                <Check className="w-11 h-11 sm:w-12 sm:h-12 stroke-[3]" aria-hidden="true" />
              </div>

              <p className="mt-6 text-xs sm:text-sm font-semibold text-[#0A8E43]">
                Vardhman Consultancy Services
              </p>

              <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-[#063B7A] tracking-tight">
                Congratulations!
              </h1>

              <p className="mt-4 text-base sm:text-lg font-bold text-[#063B7A]">
                {isApply
                  ? 'Your Application Submitted & Profile Active Successfully'
                  : 'Your Profile Created Successfully'}
              </p>

              {isApply && context.jobTitle && (
                <p className="mt-2 text-sm text-slate-600">
                  Applied for{' '}
                  <span className="font-semibold text-slate-900">
                    {context.jobTitle}
                  </span>
                  {context.companyMasked ? ` (${context.companyMasked})` : ''}.
                </p>
              )}

              <div className="mt-5 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#0A8E43]/10 to-[#0A8E43]/5 border border-[#0A8E43]/25">
                <p className="text-sm sm:text-base font-semibold text-[#0A8E43]">
                  {isApply
                    ? 'Application Submitted Successfully ✅ — Saved securely in our Candidate Repository'
                    : 'Profile Active — Apply directly through our Job Portal'}
                </p>
              </div>

              {/* Required Primary Buttons: Back To Home & Search Jobs */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onBackHome}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] hover:from-[#053166] hover:to-[#031F42] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#063B7A] focus-visible:ring-offset-2"
                >
                  <Home className="w-4 h-4" aria-hidden="true" />
                  <span>Back To Home</span>
                </button>

                <button
                  type="button"
                  onClick={onSearchJobs}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] hover:from-[#e07214] hover:to-[#c25d09] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-md shadow-[#F58220]/25 transition-all whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#063B7A] focus-visible:ring-offset-2"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>Search Jobs</span>
                </button>
              </div>

              {onGoToDashboard && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={onGoToDashboard}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 text-sm font-semibold text-[#063B7A] hover:text-[#D96B0C] underline transition-colors cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                    <span>Go to My Dashboard</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
