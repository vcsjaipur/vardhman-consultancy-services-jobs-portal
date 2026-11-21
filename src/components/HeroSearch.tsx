import { FormEvent, RefObject } from 'react';
import { Briefcase, History, MapPin, Search, X } from 'lucide-react';
import { JobSearchFilters, SearchHistoryItem } from '../types/portal';

interface HeroSearchProps {
  filters: JobSearchFilters;
  onFiltersChange: (next: JobSearchFilters) => void;
  onSearchSubmit: () => void;
  keywordInputRef: RefObject<HTMLInputElement | null>;
  onNavigateBuildResume?: () => void;
  onNavigateSearchJobs?: () => void;
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

          <p className="mt-3 text-sm sm:text-base font-medium text-[#F6D574] tracking-wide">
            Verified Opportunities · Vardhman Consultancy Services
          </p>
        </div>

        {/* Clean LinkedIn / Naukri / Indeed Inspired Elevated Search Bar: Skills | Experience | Location */}
        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Job Search"
          className="mt-7 sm:mt-9 max-w-5xl mx-auto bg-white border border-[#D4AF37]/40 rounded-2xl shadow-2xl shadow-[#020B18]/40 p-2.5 sm:p-3.5"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-stretch">
            {/* Skills */}
            <div className="md:col-span-4 relative flex items-center">
              <label htmlFor="search-keyword" className="sr-only">
                Skills
              </label>
              <Search
                className="w-4 h-4 text-[#062856]/60 absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={keywordInputRef}
                id="search-keyword"
                type="text"
                value={filters.keyword}
                onChange={(e) =>
                  onFiltersChange({ ...filters, keyword: e.target.value })
                }
                placeholder="Skills (e.g. Pharma, MBBS, QA, Finance)"
                className="w-full min-h-[48px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-colors"
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

            {/* Location */}
            <div className="md:col-span-3 relative flex items-center">
              <label htmlFor="search-location" className="sr-only">
                Location
              </label>
              <MapPin
                className="w-4 h-4 text-[#062856]/60 absolute left-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="search-location"
                type="text"
                value={filters.location}
                onChange={(e) =>
                  onFiltersChange({ ...filters, location: e.target.value })
                }
                placeholder="Location (City, State or Pan India)"
                className="w-full min-h-[48px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition-colors"
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
