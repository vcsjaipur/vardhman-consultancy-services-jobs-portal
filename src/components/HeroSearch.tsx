import { FormEvent, RefObject } from 'react';
import { Bell, Briefcase, History, MapPin, Search, Sparkles, X } from 'lucide-react';
import { JobListing, JobSearchFilters, SearchHistoryItem } from '../types/portal';
import { SearchSuggestionInput } from './SearchSuggestionInput';

interface HeroSearchProps {
  filters: JobSearchFilters;
  onFiltersChange: (next: JobSearchFilters) => void;
  onSearchSubmit: () => void;
  keywordInputRef: RefObject<HTMLInputElement | null>;
  jobs?: JobListing[];
  onNavigateBuildResume?: () => void;
  onNavigateSearchJobs?: () => void;
  onOpenAiCopilot?: () => void;
  onOpenJobAlerts?: () => void;
  searchHistory?: SearchHistoryItem[];
  onSelectHistoryItem?: (item: SearchHistoryItem) => void;
  onRemoveHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
}

const EXPERIENCE_OPTIONS = [
  'Any Experience',
  '0 – 1 Years (Fresher)',
  '1 – 3 Years',
  '3 – 5 Years',
  '5 – 10 Years',
  '10 – 15 Years',
  '15 – 20 Years',
  '20 – 25 Years',
  '25 – 30 Years',
  '30+ Years',
];

export function HeroSearch({
  filters,
  onFiltersChange,
  onSearchSubmit,
  keywordInputRef,
  jobs = [],
  onOpenAiCopilot,
  onOpenJobAlerts,
  searchHistory = [],
  onSelectHistoryItem,
  onRemoveHistoryItem,
  onClearHistory,
}: HeroSearchProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <section
      id="hero-search"
      className="relative bg-gradient-to-br from-[#041C3F] via-[#062856] to-[#083B7E] border-b-2 border-[#D4AF37]/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1
            className="font-display font-extrabold text-white tracking-tight text-balance leading-[1.1]"
            style={{ fontSize: 'clamp(2.2rem, 4.8vw, 3.6rem)' }}
          >
            Your Job Search Ends Here
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
            <span className="block font-semibold text-white">
              Welcome to JobsNia.com Job Portal
            </span>
            <span className="block text-slate-200/95">
              A Venture of Vardhman Consultancy Services - India&apos;s Leading Recruitment Agency
            </span>
          </p>
        </div>

        {/* Elevated Search Bar with Autocomplete Suggestions: Skills | Experience | Location */}
        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Job Search"
          className="mt-7 sm:mt-9 max-w-5xl mx-auto bg-white border border-[#D4AF37]/40 rounded-2xl shadow-2xl shadow-[#020B18]/40 p-2.5 sm:p-3.5"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-stretch">
            {/* Skills / Role Autocomplete */}
            <div className="md:col-span-4 relative flex items-center">
              <label htmlFor="search-keyword" className="sr-only">
                Skills or Role
              </label>
              <SearchSuggestionInput
                id="search-keyword"
                inputRef={keywordInputRef}
                value={filters.keyword}
                onChange={(val) => onFiltersChange({ ...filters, keyword: val })}
                field="keyword"
                jobs={jobs}
                searchHistory={searchHistory}
                ariaLabel="Skills, role, or designation"
                placeholder="Skills (e.g. Pharma, MBBS, QA, Finance)"
                icon={
                  <Search
                    className="w-4 h-4 text-[#062856]/60 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                }
                inputClassName="w-full min-h-[48px] pl-10 pr-8 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-colors"
              />
            </div>

            {/* Experience */}
            <div className="md:col-span-3 relative flex items-center">
              <label htmlFor="search-experience" className="sr-only">
                Experience
              </label>
              <Briefcase
                className="w-4 h-4 text-[#062856]/60 absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <select
                id="search-experience"
                value={filters.experience}
                onChange={(e) =>
                  onFiltersChange({ ...filters, experience: e.target.value })
                }
                className="w-full min-h-[48px] pl-10 pr-7 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-colors cursor-pointer"
              >
                {EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option} value={option === 'Any Experience' ? '' : option}>
                    {option === 'Any Experience' ? 'Experience' : option}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Autocomplete */}
            <div className="md:col-span-3 relative flex items-center">
              <label htmlFor="search-location" className="sr-only">
                Location
              </label>
              <SearchSuggestionInput
                id="search-location"
                value={filters.location}
                onChange={(val) => onFiltersChange({ ...filters, location: val })}
                field="location"
                jobs={jobs}
                searchHistory={searchHistory}
                ariaLabel="City, state, or Pan India"
                placeholder="Location (City, State or Pan India)"
                icon={
                  <MapPin
                    className="w-4 h-4 text-[#062856]/60 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                }
                inputClassName="w-full min-h-[48px] pl-10 pr-8 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-colors"
              />
            </div>

            {/* Gold Search Button */}
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                <span>Search Jobs</span>
              </button>
            </div>
          </div>
        </form>

        {/* Smart AI Finder & Job Alert Email Quick Strip */}
        {(onOpenAiCopilot || onOpenJobAlerts) && (
          <div className="mt-4 max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
            {onOpenAiCopilot && (
              <button
                type="button"
                onClick={onOpenAiCopilot}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white/12 hover:bg-white/20 border border-[#D4AF37]/60 text-white font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                <span>AI Job Finder Copilot</span>
              </button>
            )}

            {onOpenJobAlerts && (
              <button
                type="button"
                onClick={onOpenJobAlerts}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] border border-[#0A8E43] text-white font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span>Get Job Alert Emails</span>
              </button>
            )}
          </div>
        )}

        {/* Recent Search History Chips */}
        {searchHistory.length > 0 && onSelectHistoryItem && (
          <div className="mt-4 max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#F6D574] font-semibold">
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recent Searches:</span>
            </span>
            {searchHistory.slice(0, 6).map((item) => {
              const label = [item.keyword, item.location, item.experience]
                .filter(Boolean)
                .join(' · ');
              if (!label) return null;
              return (
                <span
                  key={item.id}
                  className="inline-flex items-center rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectHistoryItem(item)}
                    className="px-2.5 py-1 text-xs font-medium cursor-pointer"
                  >
                    {label}
                  </button>
                  {onRemoveHistoryItem && (
                    <button
                      type="button"
                      onClick={() => onRemoveHistoryItem(item.id)}
                      aria-label={`Remove ${label} from search history`}
                      className="pr-2 py-1 text-white/70 hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })}
            {onClearHistory && (
              <button
                type="button"
                onClick={onClearHistory}
                className="px-2 py-1 text-[11px] font-semibold text-white/75 hover:text-[#F6D574] underline cursor-pointer"
              >
                Clear History
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
