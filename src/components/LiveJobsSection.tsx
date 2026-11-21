import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Briefcase,
  Building2,
  IndianRupee,
  MapPin,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  CandidateProfile,
  JobListing,
  JobSearchFilters,
  PortalModalType,
} from '../types/portal';
import { buildJobShareUrl, maskCompanyName } from '../utils/jobHelpers';
import { computeSmartMatch } from '../utils/smartMatch';
import { JobTrendsSection } from './JobTrendsSection';
import { JobCardSkeleton } from './SkeletonLoaders';
import { SocialShareMenu } from './SocialShareMenu';

interface LiveJobsSectionProps {
  jobs: JobListing[];
  isLoading?: boolean;
  candidate?: CandidateProfile | null;
  appliedFilters: JobSearchFilters | null;
  savedJobIds?: string[];
  onToggleSaveJob?: (jobId: string) => void;
  onResetSearch: () => void;
  onSelectJob: (jobId: string) => void;
  onApplyJob: (job: JobListing) => void;
  onFilterByKeyword: (keyword: string) => void;
  onNavigateSearchJobs: () => void;
  onOpenModal: (modal: PortalModalType) => void;
}

const SPECIALTY_FILTERS = [
  'Medical Representative',
  'Hospital Jobs',
  'Pharma Sales',
  'Production / QA / QC',
  'Finance & Controller',
  'Product Management',
  'Oncology & Anesthesia',
  'Nutrition',
];

export function LiveJobsSection({
  jobs,
  isLoading = false,
  candidate = null,
  appliedFilters,
  savedJobIds = [],
  onToggleSaveJob,
  onResetSearch,
  onSelectJob,
  onApplyJob,
  onFilterByKeyword,
  onNavigateSearchJobs,
  onOpenModal,
}: LiveJobsSectionProps) {
  const [viewTab, setViewTab] = useState<'all' | 'saved'>('all');
  const [showTrends, setShowTrends] = useState(false);

  const hasActiveFilter =
    appliedFilters !== null &&
    Boolean(
      appliedFilters.keyword.trim() ||
        appliedFilters.location.trim() ||
        appliedFilters.experience ||
        appliedFilters.salary
    );

  const activeFilterSummary = appliedFilters
    ? [
        appliedFilters.keyword.trim() ? `Skills: ${appliedFilters.keyword.trim()}` : '',
        appliedFilters.experience ? `Experience: ${appliedFilters.experience}` : '',
        appliedFilters.location.trim() ? `Location: ${appliedFilters.location.trim()}` : '',
        appliedFilters.salary ? `Salary: ${appliedFilters.salary}` : '',
      ].filter(Boolean)
    : [];

  const visibleJobs =
    viewTab === 'saved'
      ? jobs.filter((job) => savedJobIds.includes(job.id))
      : jobs;

  return (
    <section
      id="live-jobs"
      className="bg-white py-10 sm:py-14 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header — Strictly NO total count or number of posts */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-[#9A6F04]">
              Verified Jobs Only · Easy Apply
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#062856] tracking-tight">
              Latest Verified Jobs
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              role="tablist"
              aria-label="Job list filter"
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'all'}
                onClick={() => setViewTab('all')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewTab === 'all'
                    ? 'bg-[#062856] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#062856]'
                }`}
              >
                All Verified Jobs
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'saved'}
                onClick={() => setViewTab('saved')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewTab === 'saved'
                    ? 'bg-[#062856] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#062856]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Saved Jobs</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowTrends((prev) => !prev)}
              aria-expanded={showTrends}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                showTrends
                  ? 'bg-[#062856] border-[#062856] text-white'
                  : 'border-slate-200 bg-slate-50 hover:border-[#062856] text-[#062856]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Job Trends</span>
            </button>

            <button
              type="button"
              onClick={onNavigateSearchJobs}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-[#062856]/30 hover:border-[#062856] text-[#062856] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Advanced Search</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Interactive Job Market Trends Chart */}
        {showTrends && (
          <div className="mt-5">
            <JobTrendsSection
              jobs={jobs}
              onFilterByKeyword={(kw) => onFilterByKeyword(kw)}
            />
          </div>
        )}

        {/* Clean Quick Specialty Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {SPECIALTY_FILTERS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onFilterByKeyword(tag)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-[#FBF4DC] border border-slate-200 hover:border-[#D4AF37] text-xs font-semibold text-[#062856] transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        {hasActiveFilter && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 py-3 px-4 bg-[#FBF4DC]/60 border border-[#D4AF37]/50 rounded-xl text-sm text-[#062856]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold">Filters:</span>
              {activeFilterSummary.map((item, idx) => (
                <span key={item} className="inline-flex items-center gap-2">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                  )}
                  <span>{item}</span>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onResetSearch}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9A6F04] hover:text-[#062856] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Search</span>
            </button>
          </div>
        )}

        {isLoading && jobs.length === 0 ? (
          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <JobCardSkeleton key={idx} />
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#062856] text-[#F6D574] flex items-center justify-center">
              <Briefcase className="w-6 h-6" aria-hidden="true" />
            </div>

            <h3 className="mt-4 font-display text-lg sm:text-xl font-bold text-[#062856]">
              {viewTab === 'saved' ? 'No Saved Jobs Yet' : 'No Matching Jobs Found'}
            </h3>

            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              {viewTab === 'saved'
                ? 'Bookmark any verified mandate to shortlist and review it later.'
                : 'Try adjusting your skills or location search, or submit your resume directly.'}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {viewTab === 'saved' ? (
                <button
                  type="button"
                  onClick={() => setViewTab('all')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  View All Verified Jobs
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onResetSearch}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Show All Verified Jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenModal('upload-resume')}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] text-sm font-bold transition-colors cursor-pointer"
                  >
                    Submit Resume
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleJobs.map((job) => {
              const isSaved = savedJobIds.includes(job.id);
              const orgLabel = maskCompanyName(job.company, job.companyMasked);
              const smartMatch = computeSmartMatch(job, candidate);
              const shareUrl = buildJobShareUrl(job.id);
              const shareText = `${job.title} (${job.location} · ${job.salary}) via Vardhman Consultancy Services`;

              return (
                <article
                  key={job.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectJob(job.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectJob(job.id);
                    }
                  }}
                  aria-label={`View details for ${job.title} in ${job.location}`}
                  className="group bg-white border border-slate-200 hover:border-[#062856] rounded-2xl shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
                >
                  <div>
                    {/* Top Meta Row: Organization Label + Smart Match + Save / Share */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-[#9A6F04] flex items-center gap-1.5 min-w-0">
                          <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{orgLabel}</span>
                        </p>
                        {smartMatch && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                              smartMatch.score >= 80
                                ? 'bg-[#0A8E43]/15 text-[#0A8E43]'
                                : 'bg-[#062856]/10 text-[#062856]'
                            }`}
                          >
                            {smartMatch.score}% Smart Match
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onToggleSaveJob && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSaveJob(job.id);
                            }}
                            aria-label={isSaved ? `Unsave ${job.title}` : `Save ${job.title}`}
                            aria-pressed={isSaved}
                            title={isSaved ? 'Saved' : 'Save Job'}
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                              isSaved
                                ? 'bg-[#FBF4DC] border-[#D4AF37] text-[#9A6F04]'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[#062856] hover:border-[#062856]'
                            }`}
                          >
                            <Bookmark
                              className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        )}

                        <SocialShareMenu
                          title={job.title}
                          text={shareText}
                          url={shareUrl}
                          variant="icon"
                        />
                      </div>
                    </div>

                    {/* Job Title */}
                    <h3 className="mt-2.5 font-display text-lg sm:text-xl font-bold text-[#062856] group-hover:text-[#9A6F04] transition-colors leading-snug">
                      {job.title}
                    </h3>

                    {/* Concise Designation / Positions Line */}
                    {job.designation && job.designation !== job.title && (
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {job.designation}
                      </p>
                    )}

                    {/* Clean Core Metadata: Location, Salary, Experience */}
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <p className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#062856] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{job.location}</span>
                      </p>

                      <p className="flex items-center gap-2 font-bold text-[#062856] tabular-nums">
                        <IndianRupee className="w-4 h-4 text-[#9A6F04] shrink-0" aria-hidden="true" />
                        <span>{job.salary}</span>
                      </p>

                      <p className="flex items-center gap-2 text-slate-600 tabular-nums">
                        <Briefcase className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{job.experience}</span>
                      </p>
                    </div>
                  </div>

                  {/* Card Footer CTAs */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyJob(job);
                      }}
                      className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
                      <span>Apply Now</span>
                    </button>

                    <span className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D4AF37]/60 bg-[#FBF4DC]/60 group-hover:bg-[#D4AF37] text-[#062856] font-bold text-xs sm:text-sm inline-flex items-center justify-center transition-colors whitespace-nowrap">
                      Details
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

