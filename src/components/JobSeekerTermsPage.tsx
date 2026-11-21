import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Mail,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { VCS_TERMS_DOCUMENT } from '../constants/jobSeekerTerms';

interface JobSeekerTermsPageProps {
  onBackHome: () => void;
  onGoToSearchJobs: () => void;
  onGoToBuildResume: () => void;
}

export function JobSeekerTermsPage({
  onBackHome,
  onGoToSearchJobs,
  onGoToBuildResume,
}: JobSeekerTermsPageProps) {
  return (
    <div className="bg-gradient-to-br from-slate-100 via-[#F4F7FB] to-[#E6EEF8] min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="bg-gradient-to-br from-[#063B7A] via-[#053166] to-[#042147] text-white">
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <div className="mt-4">
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#F58220]">
              {VCS_TERMS_DOCUMENT.organization}
            </p>
            <h1 className="mt-1 font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight text-balance">
              {VCS_TERMS_DOCUMENT.title}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-200">
              <a
                href={`mailto:${VCS_TERMS_DOCUMENT.email}`}
                className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-[#F6D574] transition-colors"
              >
                <Mail className="w-4 h-4 text-[#F58220] shrink-0" aria-hidden="true" />
                <span>{VCS_TERMS_DOCUMENT.email}</span>
              </a>
              <span className="text-slate-300">·</span>
              <span>{VCS_TERMS_DOCUMENT.applicability}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Clean Single-Page Document Card */}
        <section
          aria-label={VCS_TERMS_DOCUMENT.title}
          className="bg-white border border-slate-200/90 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="px-5 sm:px-7 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2.5">
            <ShieldCheck
              className="w-5 h-5 text-[#0A8E43] shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm sm:text-base font-semibold text-[#063B7A]">
              {VCS_TERMS_DOCUMENT.intro}
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {VCS_TERMS_DOCUMENT.items.map((item) => (
              <div
                key={item.number}
                className="px-5 sm:px-7 py-3.5 sm:py-4 flex items-start gap-3 sm:gap-4"
              >
                <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#063B7A]/8 text-[#063B7A] font-display text-xs font-extrabold tabular-nums shrink-0">
                  {item.number}
                </span>
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                  <strong className="font-bold text-[#063B7A]">
                    {item.number}. {item.title}:
                  </strong>{' '}
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <div className="px-5 sm:px-7 py-4 sm:py-5 bg-[#0A8E43]/8 border-t border-[#0A8E43]/25">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="w-5 h-5 text-[#0A8E43] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-sm sm:text-[15px] text-slate-800 leading-relaxed font-medium">
                <strong className="font-bold text-[#063B7A]">
                  {VCS_TERMS_DOCUMENT.declarationLabel}
                </strong>{' '}
                {VCS_TERMS_DOCUMENT.declarationText}
              </p>
            </div>
          </div>
        </section>

        {/* Bottom Portal Navigation Buttons */}
        <div className="mt-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#063B7A]">
              {VCS_TERMS_DOCUMENT.organization}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
              Official Candidate Desk:{' '}
              <a
                href={`mailto:${VCS_TERMS_DOCUMENT.email}`}
                className="font-semibold text-[#063B7A] hover:text-[#D96B0C] underline"
              >
                {VCS_TERMS_DOCUMENT.email}
              </a>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onGoToSearchJobs}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] hover:from-[#e07214] hover:to-[#c25d09] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-md shadow-[#F58220]/25 transition-all whitespace-nowrap cursor-pointer"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              <span>Search Jobs</span>
            </button>

            <button
              type="button"
              onClick={onGoToBuildResume}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] hover:from-[#053166] hover:to-[#031F42] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Build Resume</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
