import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  GraduationCap,
  History,
  IndianRupee,
  Layers,
  Mail,
  MapPin,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Stethoscope,
  Upload,
  X,
} from 'lucide-react';
import {
  CandidateProfile,
  JobListing,
  PortalModalType,
  SearchHistoryItem,
  SearchPageFilters,
} from '../types/portal';
import { JOBS_PER_PAGE } from '../utils/firestorePortal';
import { buildJobShareUrl, maskCompanyName } from '../utils/jobHelpers';
import { computeSmartMatch } from '../utils/smartMatch';
import { JobTrendsSection } from './JobTrendsSection';
import { JobListRowSkeleton } from './SkeletonLoaders';
import { SocialShareMenu } from './SocialShareMenu';

interface SearchJobsPageProps {
  filters: SearchPageFilters;
  appliedFilters: SearchPageFilters;
  jobs: JobListing[];
  isLoading?: boolean;
  candidate?: CandidateProfile | null;
  searchHistory?: SearchHistoryItem[];
  onSelectHistoryItem?: (item: SearchHistoryItem) => void;
  onRemoveHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
  savedJobIds?: string[];
  onToggleSaveJob?: (jobId: string) => void;
  totalJobsCount?: number;
  hasMoreJobs?: boolean;
  isLoadingMore?: boolean;
  onLoadMoreJobs?: () => void;
  onFiltersChange: (next: SearchPageFilters) => void;
  onSearchSubmit: () => void;
  onResetFilters: () => void;
  onSelectJob: (jobId: string) => void;
  onApplyJob: (job: JobListing) => void;
  onBackHome: () => void;
  onOpenModal: (modal: PortalModalType) => void;
  onOpenJobAlerts: () => void;
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

const SALARY_OPTIONS = [
  'Any Salary',
  'Up to ₹5 LPA',
  '₹5 – 10 LPA',
  '₹10 – 20 LPA',
  '₹20 – 35 LPA',
  '₹35+ LPA',
];

const DEPARTMENT_OPTIONS = [
  'All Departments',
  'Medical & Clinical',
  'Pharmaceutical Sales & Marketing',
  'Software Engineering / IT / AI',
  'Production / QA / QC / R&D',
  'Regulatory Affairs',
  'Accounts & Finance',
  'HR & Administration',
  'Product Management & Purchase',
];

const QUALIFICATION_OPTIONS = [
  'Any Qualification',
  'MBBS',
  'MD',
  'MS',
  'DNB',
  'Super PG',
  'B.Pharm',
  'M.Pharm',
  'Pharmacist',
  'BAMS',
  'BHMS',
  'BA',
  'B.Com',
  'B.Sc',
  'MBA',
  'Engineering',
  'IIT',
  'NIT',
];

const LEVEL_OPTIONS = [
  'Any Level',
  'AGM',
  'DGM',
  'GM',
  'Vice President',
  'National Sales Manager',
  'Sales Manager',
  'Head Hunting',
];

const WORK_TYPE_OPTIONS = ['All', 'Full-time', 'On-site', 'Hybrid', 'Remote'] as const;

const PRIME_HIRINGS = [
  'Doctors',
  'Medical Consultants',
  'Medical Representatives',
  'Pharmaceutical Sales & Marketing Professionals',
  'Product Manager',
  'Plant Head',
  'Accounts & Finance Head',
];

const FUNCTION_CATEGORIES = [
  'Software Engineering',
  'IT',
  'AI',
  'Accounts & Finance',
  'HR',
  'Administration',
  'Sales',
  'Marketing',
  'Production',
  'R&D',
  'Purchase',
  'Regulatory Affairs',
  'International Marketing',
  'Product Management',
  'QA',
  'QC',
];

const LEVEL_CATEGORIES = [
  'AGM',
  'DGM',
  'GM',
  'Vice President',
  'National Sales Manager',
  'Sales Manager',
  'Head Hunting',
];

const MEDICAL_SPECIALITIES = [
  'Cardiologist',
  'Nephrologist',
  'Physician',
  'Radiologist',
  'Pathologist',
  'Gynaecologist',
  'Paediatrician',
  'All Super Specialities',
];

const QUALIFICATION_CHIPS = [
  'MBBS',
  'MD',
  'MS',
  'DNB',
  'Super PG',
  'B.Pharm',
  'M.Pharm',
  'Pharmacist',
  'BAMS',
  'BHMS',
  'BA',
  'B.Com',
  'B.Sc',
  'MBA',
  'Engineering',
  'IIT',
  'NIT',
];

const SECTOR_CATEGORIES = [
  'Medical',
  'Healthcare',
  'Pharmaceutical',
  'Life Sciences',
  'Biotechnology',
  'Nutraceuticals',
];

type SortOption = 'recent' | 'title-asc' | 'smart-match';

export function SearchJobsPage({
  filters,
  appliedFilters,
  jobs,
  isLoading = false,
  candidate = null,
  searchHistory = [],
  onSelectHistoryItem,
  onRemoveHistoryItem,
  onClearHistory,
  savedJobIds = [],
  onToggleSaveJob,
  totalJobsCount,
  hasMoreJobs = false,
  isLoadingMore = false,
  onLoadMoreJobs,
  onFiltersChange,
  onSearchSubmit,
  onResetFilters,
  onSelectJob,
  onApplyJob,
  onBackHome,
  onOpenModal,
  onOpenJobAlerts,
}: SearchJobsPageProps) {
  const [department, setDepartment] = useState('');
  const [qualification, setQualification] = useState('');
  const [level, setLevel] = useState('');
  const [workType, setWorkType] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    if (pendingSubmitRef.current) {
      pendingSubmitRef.current = false;
      onSearchSubmit();
    }
  }, [filters, onSearchSubmit]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  const updateAndApplyFilter = (patch: Partial<SearchPageFilters>) => {
    pendingSubmitRef.current = true;
    onFiltersChange({ ...filters, ...patch });
  };

  const handleClearAllFilters = () => {
    setDepartment('');
    setQualification('');
    setLevel('');
    setWorkType('All');
    setSortBy('recent');
    onResetFilters();
  };

  const displayedJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      const searchableText = [
        job.title,
        job.jobTitle || '',
        job.designation,
        job.description,
        job.jobDescription || '',
        job.location,
        job.qualification,
        ...job.skills,
      ]
        .join(' ')
        .toLowerCase();

      if (department) {
        const deptTokens = department
          .toLowerCase()
          .split(/[/,&]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 1 && t !== 'all departments');
        const matchesDept = deptTokens.some((token) =>
          searchableText.includes(token)
        );
        if (!matchesDept) return false;
      }

      if (qualification) {
        const qualLower = qualification.toLowerCase();
        if (
          !job.qualification.toLowerCase().includes(qualLower) &&
          !searchableText.includes(qualLower)
        ) {
          return false;
        }
      }

      if (level) {
        const levelLower = level.toLowerCase();
        if (
          !job.designation.toLowerCase().includes(levelLower) &&
          !job.title.toLowerCase().includes(levelLower) &&
          !searchableText.includes(levelLower)
        ) {
          return false;
        }
      }

      if (workType !== 'All') {
        const jobTypeLower = (job.jobType || 'Full-time').toLowerCase();
        if (!jobTypeLower.includes(workType.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    if (sortBy === 'smart-match' && candidate?.role === 'candidate') {
      return [...filtered].sort((a, b) => {
        const sA = computeSmartMatch(a, candidate)?.score || 0;
        const sB = computeSmartMatch(b, candidate)?.score || 0;
        return sB - sA;
      });
    }

    if (sortBy === 'title-asc') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [jobs, department, qualification, level, workType, sortBy, candidate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, department, qualification, level, workType, sortBy]);

  const totalPages = Math.max(1, Math.ceil(displayedJobs.length / JOBS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = useMemo(() => {
    const start = (safePage - 1) * JOBS_PER_PAGE;
    return displayedJobs.slice(start, start + JOBS_PER_PAGE);
  }, [displayedJobs, safePage]);

  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    let start = Math.max(1, safePage - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const list: number[] = [];
    for (let i = start; i <= end; i += 1) list.push(i);
    return list;
  }, [safePage, totalPages]);

  const activeChips: Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }> = [];

  if (appliedFilters.keyword.trim()) {
    activeChips.push({
      key: 'keyword',
      label: `Keyword: ${appliedFilters.keyword.trim()}`,
      onRemove: () => updateAndApplyFilter({ keyword: '' }),
    });
  }
  if (appliedFilters.location.trim()) {
    activeChips.push({
      key: 'location',
      label: `Location: ${appliedFilters.location.trim()}`,
      onRemove: () => updateAndApplyFilter({ location: '' }),
    });
  }
  if (department) {
    activeChips.push({
      key: 'department',
      label: `Department: ${department}`,
      onRemove: () => setDepartment(''),
    });
  }
  if (appliedFilters.experience) {
    activeChips.push({
      key: 'experience',
      label: `Experience: ${appliedFilters.experience}`,
      onRemove: () => updateAndApplyFilter({ experience: '' }),
    });
  }
  if (qualification) {
    activeChips.push({
      key: 'qualification',
      label: `Qualification: ${qualification}`,
      onRemove: () => setQualification(''),
    });
  }
  if (level) {
    activeChips.push({
      key: 'level',
      label: `Level: ${level}`,
      onRemove: () => setLevel(''),
    });
  }
  if (workType !== 'All') {
    activeChips.push({
      key: 'workType',
      label: `Work Type: ${workType}`,
      onRemove: () => setWorkType('All'),
    });
  }
  if (appliedFilters.designation.trim()) {
    activeChips.push({
      key: 'designation',
      label: `Designation: ${appliedFilters.designation.trim()}`,
      onRemove: () => updateAndApplyFilter({ designation: '' }),
    });
  }
  if (appliedFilters.salary) {
    activeChips.push({
      key: 'salary',
      label: `Salary: ${appliedFilters.salary}`,
      onRemove: () => updateAndApplyFilter({ salary: '' }),
    });
  }

  const hasAnyActiveFilter = activeChips.length > 0;

  const renderSidebarFilterControls = (idPrefix: string) => (
    <div className="space-y-4">
      {/* 1. Location */}
      <div>
        <label
          htmlFor={`${idPrefix}-location`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Location
        </label>
        <div className="relative flex items-center">
          <MapPin
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id={`${idPrefix}-location`}
            type="text"
            value={filters.location}
            onChange={(e) => updateAndApplyFilter({ location: e.target.value })}
            placeholder="City or state"
            className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
          />
        </div>
      </div>

      {/* 2. Department */}
      <div>
        <label
          htmlFor={`${idPrefix}-department`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Department
        </label>
        <div className="relative flex items-center">
          <Layers
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <select
            id={`${idPrefix}-department`}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full min-h-[42px] pl-9 pr-7 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
          >
            {DEPARTMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt === 'All Departments' ? '' : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Experience */}
      <div>
        <label
          htmlFor={`${idPrefix}-experience`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Experience
        </label>
        <div className="relative flex items-center">
          <Briefcase
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <select
            id={`${idPrefix}-experience`}
            value={filters.experience}
            onChange={(e) => updateAndApplyFilter({ experience: e.target.value })}
            className="w-full min-h-[42px] pl-9 pr-7 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
          >
            {EXPERIENCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt === 'Any Experience' ? '' : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Qualification */}
      <div>
        <label
          htmlFor={`${idPrefix}-qualification`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Qualification
        </label>
        <div className="relative flex items-center">
          <GraduationCap
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <select
            id={`${idPrefix}-qualification`}
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            className="w-full min-h-[42px] pl-9 pr-7 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
          >
            {QUALIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt === 'Any Qualification' ? '' : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Level */}
      <div>
        <label
          htmlFor={`${idPrefix}-level`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Level
        </label>
        <div className="relative flex items-center">
          <Award
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <select
            id={`${idPrefix}-level`}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full min-h-[42px] pl-9 pr-7 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt} value={opt === 'Any Level' ? '' : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6. Work Type: Full-time / On-site / Hybrid / Remote */}
      <div>
        <span className="block text-xs font-semibold text-[#063B7A] mb-2">
          Work Type
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {WORK_TYPE_OPTIONS.map((option) => {
            const selected = workType === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setWorkType(option)}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#063B7A] border-[#063B7A] text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-[#063B7A]/50 hover:text-[#063B7A]'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Designation */}
      <div>
        <label
          htmlFor={`${idPrefix}-designation`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Designation
        </label>
        <input
          id={`${idPrefix}-designation`}
          type="text"
          value={filters.designation}
          onChange={(e) => updateAndApplyFilter({ designation: e.target.value })}
          placeholder="e.g. Consultant, AGM, MR"
          className="w-full min-h-[42px] px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
        />
      </div>

      {/* 8. Salary */}
      <div>
        <label
          htmlFor={`${idPrefix}-salary`}
          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
        >
          Salary
        </label>
        <div className="relative flex items-center">
          <IndianRupee
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <select
            id={`${idPrefix}-salary`}
            value={filters.salary}
            onChange={(e) => updateAndApplyFilter({ salary: e.target.value })}
            className="w-full min-h-[42px] pl-9 pr-7 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
          >
            {SALARY_OPTIONS.map((opt) => (
              <option key={opt} value={opt === 'Any Salary' ? '' : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white min-h-[calc(100vh-5rem)] border-b border-slate-200 flex flex-col">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#062856] via-[#D4AF37] to-[#062856]" aria-hidden="true" />

      {/* Clean Top Search Bar Header (LinkedIn / Indeed / Google Careers Style) */}
      <section className="bg-slate-50/70 border-b border-slate-200 py-5 sm:py-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-[#063B7A] hover:border-[#063B7A] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Home</span>
              </button>
              <p className="text-xs sm:text-sm font-semibold text-[#0A8E43] flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Our Core Expertise: Doctors &amp; Pharmaceutical Professionals</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenModal('upload-resume')}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#063B7A] hover:bg-[#042A58] text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload Resume</span>
              </button>
            </div>
          </div>

          {/* Primary Clean Search Bar: Keyword + Location + Search Button */}
          <form
            onSubmit={handleSubmit}
            role="search"
            aria-label="Search Jobs"
            className="mt-4 bg-white border border-slate-200 rounded-xl shadow-xs p-2 sm:p-2.5"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="md:col-span-5 relative flex items-center">
                <label htmlFor="top-search-keyword" className="sr-only">
                  Keyword: Role, Skill
                </label>
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="top-search-keyword"
                  type="text"
                  value={filters.keyword}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, keyword: e.target.value })
                  }
                  placeholder="Keyword: Role, Skill"
                  className="w-full min-h-[46px] pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent border border-slate-200 md:border-transparent rounded-lg focus:bg-slate-50/70 focus:border-[#063B7A] focus:outline-none"
                />
              </div>

              <div className="hidden md:block md:col-span-1 h-7 w-px bg-slate-200 mx-auto" aria-hidden="true" />

              <div className="md:col-span-4 relative flex items-center">
                <label htmlFor="top-search-location" className="sr-only">
                  Location
                </label>
                <MapPin
                  className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="top-search-location"
                  type="text"
                  value={filters.location}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, location: e.target.value })
                  }
                  placeholder="Location"
                  className="w-full min-h-[46px] pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent border border-slate-200 md:border-transparent rounded-lg focus:bg-slate-50/70 focus:border-[#063B7A] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#F58220] hover:bg-[#D96B0C] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>Search</span>
                </button>
              </div>
            </div>
          </form>

          {/* Utility Row Below Search Bar */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-[#063B7A] tabular-nums">
                {displayedJobs.length === 0
                  ? 'Showing 0 Results'
                  : `Showing ${(safePage - 1) * JOBS_PER_PAGE + 1}–${Math.min(
                      safePage * JOBS_PER_PAGE,
                      displayedJobs.length
                    )} of ${displayedJobs.length} Jobs${
                      totalJobsCount && totalJobsCount > jobs.length
                        ? ` (${totalJobsCount} total)`
                        : ''
                    }`}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                |
              </span>
              <label htmlFor="sort-jobs-select" className="inline-flex items-center gap-1.5">
                <span className="text-slate-500">Sort:</span>
                <select
                  id="sort-jobs-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent font-semibold text-[#063B7A] focus:outline-none cursor-pointer"
                >
                  <option value="recent">Most Recent</option>
                  {candidate?.role === 'candidate' && (
                    <option value="smart-match">Best Smart Match</option>
                  )}
                  <option value="title-asc">Title (A–Z)</option>
                </select>
              </label>
              <span aria-hidden="true" className="text-slate-300">
                |
              </span>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1 font-semibold text-[#D96B0C] hover:text-[#063B7A] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear All Filters</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTrends((p) => !p)}
                aria-expanded={showTrends}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#063B7A] hover:text-[#D96B0C] transition-colors cursor-pointer"
              >
                <BarChart3 className="w-4 h-4" aria-hidden="true" />
                <span>{showTrends ? 'Hide Job Trends' : 'Job Trends Chart'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenJobAlerts}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0A8E43] hover:text-[#077235] transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span>Create Job Alert</span>
              </button>
            </div>
          </div>

          {/* Search History Chips */}
          {searchHistory.length > 0 && onSelectHistoryItem && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
                <History className="w-3.5 h-3.5 text-[#063B7A]" aria-hidden="true" />
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
                    className="inline-flex items-center rounded-lg bg-white border border-slate-200 text-[#063B7A] hover:border-[#063B7A] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectHistoryItem(item)}
                      className="px-2.5 py-1 font-medium cursor-pointer"
                    >
                      {label}
                    </button>
                    {onRemoveHistoryItem && (
                      <button
                        type="button"
                        onClick={() => onRemoveHistoryItem(item.id)}
                        aria-label={`Remove ${label}`}
                        className="pr-2 py-1 text-slate-400 hover:text-red-600 cursor-pointer"
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
                  className="text-[11px] font-semibold text-slate-500 hover:text-[#063B7A] underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

          {showTrends && (
            <div className="mt-4">
              <JobTrendsSection
                jobs={jobs}
                onFilterByKeyword={(kw) => updateAndApplyFilter({ keyword: kw })}
                onFilterByLocation={(loc) => updateAndApplyFilter({ location: loc })}
              />
            </div>
          )}
        </div>
      </section>

      {/* Main Two-Column Content: Left Sticky Filters + Right Directory & Openings */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        {/* Mobile Collapsible Filters Trigger */}
        <div className="lg:hidden mb-5">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-sm font-semibold text-[#063B7A] cursor-pointer"
            aria-expanded={mobileFiltersOpen}
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
              <span>
                Filters{hasAnyActiveFilter ? ` (${activeChips.length} active)` : ''}
              </span>
            </span>
            {mobileFiltersOpen ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {mobileFiltersOpen && (
            <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              {renderSidebarFilterControls('mobile-filter')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Sticky Left Filters Sidebar (Desktop) */}
          <aside
            aria-label="Job Filters"
            className="hidden lg:block lg:col-span-3 lg:sticky lg:top-24 bg-white border border-slate-200 rounded-xl p-5 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h2 className="font-display text-sm font-bold text-[#063B7A] flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
                <span>Filters</span>
              </h2>
              {hasAnyActiveFilter && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-[#D96B0C] hover:text-[#063B7A] transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {renderSidebarFilterControls('desktop-filter')}
          </aside>

          {/* Right Main Area */}
          <div className="lg:col-span-9 space-y-7 min-w-0">
            {/* Removable Active Filter Chips */}
            {hasAnyActiveFilter && (
              <div
                aria-label="Active Filters"
                className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
              >
                <span className="text-xs font-semibold text-slate-500 mr-1">
                  Active Filters:
                </span>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#063B7A]/25 text-xs font-semibold text-[#063B7A] hover:border-[#D96B0C] hover:text-[#D96B0C] transition-colors cursor-pointer"
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    <span>{chip.label}</span>
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="ml-auto text-xs font-semibold text-[#D96B0C] hover:underline cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Heading + Subtext */}
            <header className="border-b border-slate-200 pb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#063B7A] tracking-tight">
                  Current Job Openings
                </h1>
                <span className="text-sm font-semibold text-[#063B7A] tabular-nums">
                  {displayedJobs.length} {displayedJobs.length === 1 ? 'Job' : 'Jobs'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-base sm:text-lg font-bold text-[#063B7A] tracking-tight">
                  For Every Professional. For Every Role.
                </p>
                <p className="text-sm sm:text-base font-semibold text-[#0A8E43]">
                  Specialists in Doctors &amp; Pharmaceutical Professionals.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Welcoming Verified Roles across Pharmaceuticals, Healthcare, Hospitals, Manufacturing, FMCG, IT, Software, AI, Sales, Marketing, Accounts, Finance, HR &amp; Administration.
                </p>
                <p className="text-xs sm:text-sm font-semibold text-[#063B7A] pt-0.5">
                  100% Verified. 100% Transparent. Trusted Since 2012.
                </p>
              </div>
            </header>

            {/* Current Job Openings List / Skeleton Loader / Empty State */}
            {isLoading && jobs.length === 0 ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <JobListRowSkeleton key={idx} />
                ))}
              </div>
            ) : displayedJobs.length === 0 ? (
              <section
                aria-label="No Jobs Available"
                className="bg-slate-50/70 border border-slate-200 rounded-xl px-6 py-12 text-center"
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-white border border-slate-200 text-[#063B7A] flex items-center justify-center shadow-xs">
                  <Briefcase className="w-6 h-6" aria-hidden="true" />
                </div>

                <h2 className="mt-4 font-display text-lg sm:text-xl font-bold text-[#063B7A]">
                  No Jobs Available At This Moment
                </h2>

                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Verified mandates will appear here as soon as they are published.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenJobAlerts}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Bell className="w-4 h-4" aria-hidden="true" />
                    <span>Create Job Alert</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenModal('upload-resume')}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    <span>Upload Resume</span>
                  </button>
                </div>
              </section>
            ) : (
              <div className="space-y-5">
                <section aria-label="Job Listings" className="space-y-4">
                  {paginatedJobs.map((job) => {
                    const maskedCompany = maskCompanyName(job.company, job.companyMasked);
                    const isSaved = savedJobIds.includes(job.id);
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
                        className="group bg-white border border-slate-200 hover:border-[#062856] rounded-xl shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-lg bg-[#062856] text-[#F6D574] flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5" aria-hidden="true" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold text-[#9A6F04]">
                                  {maskedCompany}
                                </p>
                                {smartMatch && (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                                      smartMatch.score >= 80
                                        ? 'bg-[#0A8E43]/15 text-[#0A8E43]'
                                        : 'bg-[#062856]/10 text-[#062856]'
                                    }`}
                                  >
                                    {smartMatch.score}% {smartMatch.label}
                                  </span>
                                )}
                              </div>
                              <h2 className="mt-0.5 font-display text-lg font-bold text-[#062856] group-hover:text-[#9A6F04] transition-colors">
                                {job.title}
                              </h2>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FBF4DC] border border-[#D4AF37]/50 text-[#062856] text-xs font-bold tabular-nums">
                              <IndianRupee className="w-3.5 h-3.5 text-[#9A6F04]" aria-hidden="true" />
                              <span>{job.salary}</span>
                            </span>

                            {onToggleSaveJob && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSaveJob(job.id);
                                }}
                                aria-label={isSaved ? `Unsave ${job.title}` : `Save ${job.title}`}
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                  isSaved
                                    ? 'bg-[#FBF4DC] border-[#D4AF37] text-[#9A6F04]'
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[#062856]'
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

                        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#062856]" aria-hidden="true" />
                            <span>{job.location}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <Briefcase className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{job.experience}</span>
                          </span>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onApplyJob(job);
                            }}
                            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#062856] hover:bg-[#041C3F] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
                            <span>Apply Now</span>
                          </button>

                          <span className="min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold text-[#062856] group-hover:text-[#9A6F04] inline-flex items-center gap-1.5 transition-colors">
                            <span>View Job Details</span>
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {/* 20-Per-Page Pagination Bar + Unlimited Load More */}
                {(totalPages > 1 || (hasMoreJobs && onLoadMoreJobs)) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                    <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                      Showing {(safePage - 1) * JOBS_PER_PAGE + 1}–
                      {Math.min(safePage * JOBS_PER_PAGE, displayedJobs.length)} of{' '}
                      {displayedJobs.length} Jobs
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => {
                          setCurrentPage((p) => Math.max(1, p - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#063B7A] hover:border-[#063B7A] disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        <span>Previous</span>
                      </button>

                      {pageNumbers.map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setCurrentPage(num);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                            num === safePage
                              ? 'bg-[#063B7A] text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#063B7A]'
                          }`}
                        >
                          {num}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => {
                          setCurrentPage((p) => Math.min(totalPages, p + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#063B7A] hover:border-[#063B7A] disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {hasMoreJobs && onLoadMoreJobs && (
                        <button
                          type="button"
                          disabled={isLoadingMore}
                          onClick={onLoadMoreJobs}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                        >
                          {isLoadingMore ? 'Loading More...' : 'Load More Jobs'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Browse By Category Section */}
            <section
              aria-label="Browse By Category"
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h2 className="font-display text-lg font-bold text-[#063B7A]">
                  Browse By Category
                </h2>
                <span className="text-xs text-slate-500">
                  Select any specialty, function, level, or qualification to filter
                </span>
              </div>

              {/* Prime Hirings */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A8E43] mb-2">
                  Prime Hirings
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {PRIME_HIRINGS.map((item) => {
                    const active = appliedFilters.keyword.toLowerCase() === item.toLowerCase();
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => updateAndApplyFilter({ keyword: item })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#063B7A] border-[#063B7A] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#063B7A] hover:text-[#063B7A]'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Functions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#063B7A] mb-2">
                  Functions
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {FUNCTION_CATEGORIES.map((item) => {
                    const active = appliedFilters.keyword.toLowerCase() === item.toLowerCase();
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => updateAndApplyFilter({ keyword: item })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#063B7A] border-[#063B7A] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#063B7A] hover:text-[#063B7A]'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Levels */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#D96B0C] mb-2">
                  Levels
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {LEVEL_CATEGORIES.map((item) => {
                    const active = level === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setLevel(active ? '' : item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#063B7A] border-[#063B7A] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#063B7A] hover:text-[#063B7A]'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Medical */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A8E43] mb-2">
                  Medical
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {MEDICAL_SPECIALITIES.map((item) => {
                    const active = appliedFilters.keyword.toLowerCase() === item.toLowerCase();
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => updateAndApplyFilter({ keyword: item })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#063B7A] border-[#063B7A] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#063B7A] hover:text-[#063B7A]'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Qualifications */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#063B7A] mb-2">
                  Qualifications
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {QUALIFICATION_CHIPS.map((item) => {
                    const active = qualification === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQualification(active ? '' : item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#063B7A] border-[#063B7A] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#063B7A] hover:text-[#063B7A]'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sectors */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Sectors
                </h3>
                <div className="flex flex-wrap items-center gap-y-1.5 text-xs sm:text-sm text-slate-700">
                  {SECTOR_CATEGORIES.map((sector, idx) => (
                    <span key={sector} className="inline-flex items-center">
                      {idx > 0 && (
                        <span aria-hidden="true" className="mx-2 text-slate-300">
                          |
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => updateAndApplyFilter({ keyword: sector })}
                        className={`font-medium transition-colors cursor-pointer hover:text-[#063B7A] hover:underline ${
                          appliedFilters.keyword.toLowerCase() === sector.toLowerCase()
                            ? 'text-[#063B7A] font-bold underline'
                            : ''
                        }`}
                      >
                        {sector}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Quick Bottom Actions: Upload Resume */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Submit your profile for upcoming Verified Roles.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenModal('upload-resume')}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#063B7A] hover:bg-[#042A58] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Upload Resume</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single-Line Search Jobs Footer */}
      <div className="bg-slate-50 border-t border-slate-200 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <a
            href="mailto:info@vardhmanconsultancy.com"
            className="inline-flex items-center justify-center gap-2 text-[13px] whitespace-nowrap font-semibold text-[#063B7A] hover:text-[#D96B0C] transition-colors"
          >
            <Mail className="w-4 h-4 text-[#F58220] shrink-0" aria-hidden="true" />
            <span>info@vardhmanconsultancy.com</span>
          </a>
        </div>
      </div>
    </div>
  );
}
