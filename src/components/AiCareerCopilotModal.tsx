import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Filter,
  IndianRupee,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AiCareerCopilotResponse,
  CandidateProfile,
  JobListing,
} from '../types/portal';
import { queryAiCareerCopilot } from '../utils/candidateApi';
import { maskCompanyName } from '../utils/jobHelpers';
import { AiPanelSkeleton } from './SkeletonLoaders';

interface AiCareerCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobListing[];
  candidate: CandidateProfile | null;
  onSelectJob: (jobId: string) => void;
  onApplyFilters: (next: {
    keyword: string;
    location: string;
    experience: string;
  }) => void;
}

const STARTER_PROMPTS = [
  'Find Pharmaceutical QA / QC or Regulatory Affairs roles',
  'MBBS or Consultant Doctor opportunities across India',
  'Sales & Marketing or Area Manager jobs with competitive salary',
  'Fresher or 1-3 years Healthcare / IT openings',
];

export function AiCareerCopilotModal({
  isOpen,
  onClose,
  jobs,
  candidate,
  onSelectJob,
  onApplyFilters,
}: AiCareerCopilotModalProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiCareerCopilotResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (!query && candidate?.preferredRole) {
      setQuery(
        `Match me with ${candidate.preferredRole} roles${candidate.city ? ` near ${candidate.city}` : ''}`
      );
    }
  }, [isOpen, candidate]);

  if (!isOpen) return null;

  const runCopilotQuery = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean) {
      setError('Please describe the role, qualification, or city you want to find.');
      return;
    }
    setQuery(clean);
    setIsLoading(true);
    setError('');
    try {
      const response = await queryAiCareerCopilot({
        query: clean,
        jobs,
        candidate,
      });
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach AI Career Copilot right now.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runCopilotQuery(query);
  };

  const matchedJobsMap = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-copilot-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-[#062856] via-[#D4AF37] to-[#0A8E43]"
          aria-hidden="true"
        />

        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-gradient-to-br from-[#041C3F] to-[#062856] text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#F6D574] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>AI Career Copilot · JobsNia.com</span>
            </p>
            <h2
              id="ai-copilot-modal-title"
              className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-white"
            >
              Find Verified Jobs with AI
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-200">
              Describe your qualification, specialty, experience, or preferred city in plain language.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Career Copilot"
            className="w-10 h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="ai-copilot-query" className="sr-only">
              Describe the jobs you are looking for
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 flex items-center">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="ai-copilot-query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. B.Pharm QA roles in Baddi or Mumbai with 3+ yrs exp"
                  className="w-full min-h-[46px] pl-10 pr-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] disabled:opacity-60 text-[#041C3F] font-bold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{isLoading ? 'Matching...' : 'Ask AI'}</span>
              </button>
            </div>
          </form>

          {/* Starter Prompts */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">
              Quick Prompts:
            </p>
            <div className="flex flex-wrap gap-2">
              {candidate?.role === 'candidate' && (
                <button
                  type="button"
                  onClick={() =>
                    void runCopilotQuery(
                      `Recommend the top matching roles for my profile (${candidate.designation || candidate.preferredRole || candidate.qualification || 'Job Seeker'}, ${candidate.experience}, ${candidate.city})`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0A8E43]/10 hover:bg-[#0A8E43]/20 border border-[#0A8E43]/30 text-[#0A8E43] text-xs font-bold transition-colors cursor-pointer"
                >
                  Match My Saved Profile
                </button>
              )}
              {STARTER_PROMPTS.map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => void runCopilotQuery(promptText)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-[#FBF4DC] border border-slate-200 hover:border-[#D4AF37] text-[#062856] text-xs font-medium text-left transition-colors cursor-pointer"
                >
                  {promptText}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p
              className="text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              role="alert"
            >
              {error}
            </p>
          )}

          {isLoading && <AiPanelSkeleton />}

          {!isLoading && result && (
            <div className="space-y-4">
              {result.summary && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A6F04]">
                    AI Recommendation Summary
                  </p>
                  <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">
                    {result.summary}
                  </p>

                  {(result.suggestedFilters.keyword ||
                    result.suggestedFilters.location ||
                    result.suggestedFilters.experience) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-[#062856]">
                          Extracted Filters:
                        </span>{' '}
                        {[
                          result.suggestedFilters.keyword,
                          result.suggestedFilters.location,
                          result.suggestedFilters.experience,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyFilters(result.suggestedFilters);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#062856] hover:bg-[#041C3F] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Filter className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
                        <span>Apply Filters to Search</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-display text-sm font-bold text-[#062856]">
                    Top Matched Verified Openings ({result.recommendations.length})
                  </h3>
                  <div className="space-y-2.5">
                    {result.recommendations.map((rec) => {
                      const job = matchedJobsMap.get(rec.jobId);
                      if (!job) return null;
                      return (
                        <div
                          key={job.id}
                          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-[#062856] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded bg-[#0A8E43] text-white font-bold tabular-nums">
                                {rec.fitScore}% Fit
                              </span>
                              <span className="text-[#9A6F04] font-semibold">
                                {maskCompanyName(job.company, job.companyMasked)}
                              </span>
                            </div>
                            <p className="font-display text-base font-bold text-[#062856]">
                              {job.title}
                            </p>
                            <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#062856]" />
                                {job.location}
                              </span>
                              <span className="inline-flex items-center gap-1 tabular-nums font-semibold">
                                <IndianRupee className="w-3.5 h-3.5 text-[#9A6F04]" />
                                {job.salary}
                              </span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                {job.experience}
                              </span>
                            </p>
                            <p className="text-xs text-slate-700 pt-0.5">{rec.reason}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectJob(job.id);
                              onClose();
                            }}
                            className="min-h-[38px] px-4 py-2 rounded-lg bg-[#062856] hover:bg-[#041C3F] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>View Job</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#F6D574]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {result.suggestedQueries.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Refine with Follow-Up Queries:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.suggestedQueries.map((followUp) => (
                      <button
                        key={followUp}
                        type="button"
                        onClick={() => void runCopilotQuery(followUp)}
                        className="px-3 py-1.5 rounded-lg bg-[#FBF4DC]/70 hover:bg-[#FBF4DC] border border-[#D4AF37]/50 text-[#062856] text-xs font-semibold cursor-pointer"
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
