import { useMemo, useState } from 'react';
import { BarChart3, Briefcase, IndianRupee, MapPin, TrendingUp, Users } from 'lucide-react';
import { JobListing } from '../types/portal';

interface JobTrendsSectionProps {
  jobs: JobListing[];
  onFilterByKeyword?: (keyword: string) => void;
  onFilterByLocation?: (location: string) => void;
}

function classifySector(job: JobListing): string {
  const text = `${job.title} ${job.designation} ${job.qualification} ${job.skills.join(' ')} ${job.description}`.toLowerCase();
  if (/(doctor|mbbs|md|ms|dnb|cardiolog|radiolog|patholog|hospital|clinical|nurse|surgeon|physician)/.test(text)) {
    return 'Healthcare & Doctors';
  }
  if (/(pharma|mr|medical rep|qa|qc|gmp|regulatory|formulation|b\.pharm|m\.pharm|plant)/.test(text)) {
    return 'Pharma & Life Sciences';
  }
  if (/(finance|account|audit|gst|tally|controller|ca|tax|banking)/.test(text)) {
    return 'Accounts & Finance';
  }
  if (/(software|developer|it|ai|data|cloud|react|engineer|tech)/.test(text)) {
    return 'IT, Software & AI';
  }
  if (/(sales|marketing|business dev|bdm|asm|rsm|zsm|product manager)/.test(text)) {
    return 'Sales & Marketing';
  }
  if (/(hr|human resource|admin|recruit|operations|purchase)/.test(text)) {
    return 'HR, Admin & Operations';
  }
  return 'Other Specialized Roles';
}

function classifySalaryBand(salary: string): string {
  const s = salary.toLowerCase();
  if (s.includes('35+')) return '₹35+ LPA';
  if (s.includes('20') && s.includes('35')) return '₹20 – 35 LPA';
  if (s.includes('10') && s.includes('20')) return '₹10 – 20 LPA';
  if (s.includes('5') && s.includes('10')) return '₹5 – 10 LPA';
  if (s.includes('up to') || s.includes('5 lpa')) return 'Up to ₹5 LPA';
  return 'Negotiable / Market';
}

function classifyExperienceBand(exp: string): string {
  const e = exp.toLowerCase();
  if (e.includes('fresher') || e.startsWith('0')) return '0–1 Yrs (Fresher)';
  if (e.includes('1') && e.includes('3')) return '1–3 Years';
  if (e.includes('3') && e.includes('5')) return '3–5 Years';
  if (e.includes('5') && e.includes('10')) return '5–10 Years';
  if (/10|15|20|25|30/.test(e)) return '10+ Years Senior';
  return 'Flexible / As per JD';
}

export function JobTrendsSection({
  jobs,
  onFilterByKeyword,
  onFilterByLocation,
}: JobTrendsSectionProps) {
  const [activeTab, setActiveTab] = useState<'sector' | 'location' | 'salary' | 'experience'>('sector');

  const analytics = useMemo(() => {
    const sectorMap = new Map<string, number>();
    const locationMap = new Map<string, number>();
    const salaryMap = new Map<string, number>();
    const expMap = new Map<string, number>();
    let totalOpenings = 0;

    for (const job of jobs) {
      totalOpenings += Math.max(1, Number(job.openings || job.openingsCount || 1));

      const sector = classifySector(job);
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);

      const primaryCity =
        (job.location || 'Pan India')
          .split(',')[0]
          .split('/')[0]
          .trim() || 'Pan India';
      locationMap.set(primaryCity, (locationMap.get(primaryCity) || 0) + 1);

      const sal = classifySalaryBand(job.salary || '');
      salaryMap.set(sal, (salaryMap.get(sal) || 0) + 1);

      const exp = classifyExperienceBand(job.experience || '');
      expMap.set(exp, (expMap.get(exp) || 0) + 1);
    }

    const toSorted = (map: Map<string, number>, limit = 6) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, count]) => ({ label, count }));

    return {
      totalJobs: jobs.length,
      totalOpenings,
      uniqueCities: locationMap.size,
      sectors: toSorted(sectorMap, 6),
      locations: toSorted(locationMap, 6),
      salaries: toSorted(salaryMap, 6),
      experiences: toSorted(expMap, 6),
    };
  }, [jobs]);

  const currentBars =
    activeTab === 'sector'
      ? analytics.sectors
      : activeTab === 'location'
        ? analytics.locations
        : activeTab === 'salary'
          ? analytics.salaries
          : analytics.experiences;

  const maxCount = Math.max(1, ...currentBars.map((b) => b.count));

  const barColors = [
    '#062856',
    '#0A8E43',
    '#F58220',
    '#083B7E',
    '#D4AF37',
    '#0E7490',
  ];

  const handleBarClick = (label: string) => {
    if (activeTab === 'sector' && onFilterByKeyword) {
      const keyword =
        label === 'Healthcare & Doctors'
          ? 'Doctor'
          : label === 'Pharma & Life Sciences'
            ? 'Pharma'
            : label === 'Accounts & Finance'
              ? 'Finance'
              : label === 'IT, Software & AI'
                ? 'Software'
                : label === 'Sales & Marketing'
                  ? 'Sales'
                  : label === 'HR, Admin & Operations'
                    ? 'HR'
                    : '';
      if (keyword) onFilterByKeyword(keyword);
    } else if (activeTab === 'location' && onFilterByLocation) {
      onFilterByLocation(label);
    }
  };

  return (
    <section
      aria-label="Live Job Market Trends Chart"
      className="bg-slate-50/90 border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#0A8E43] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            <span>Live Hiring Analytics · Vardhman Consultancy Services</span>
          </p>
          <h3 className="mt-1 font-display text-lg sm:text-xl font-extrabold text-[#062856]">
            Job Market Trends &amp; Demand Chart
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
          {[
            { id: 'sector', label: 'By Sector', icon: Briefcase },
            { id: 'location', label: 'Top Cities', icon: MapPin },
            { id: 'salary', label: 'Salary Bands', icon: IndianRupee },
            { id: 'experience', label: 'Experience', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#062856] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#062856]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Summary Metrics */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Active Verified Mandates</p>
            <p className="mt-0.5 font-display text-xl font-extrabold text-[#062856] tabular-nums">
              {analytics.totalJobs}
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-[#D4AF37]" aria-hidden="true" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Open Positions</p>
            <p className="mt-0.5 font-display text-xl font-extrabold text-[#0A8E43] tabular-nums">
              {analytics.totalOpenings}
            </p>
          </div>
          <Users className="w-5 h-5 text-[#0A8E43]" aria-hidden="true" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Hiring Cities Covered</p>
            <p className="mt-0.5 font-display text-xl font-extrabold text-[#F58220] tabular-nums">
              {analytics.uniqueCities}
            </p>
          </div>
          <MapPin className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
        </div>
      </div>

      {/* Interactive SVG Horizontal Bar Chart */}
      {currentBars.length === 0 ? (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
          Verified job trends will display here once active mandates are loaded.
        </div>
      ) : (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
          {currentBars.map((bar, idx) => {
            const pct = Math.max(8, Math.round((bar.count / maxCount) * 100));
            const color = barColors[idx % barColors.length];
            const interactive =
              (activeTab === 'sector' && Boolean(onFilterByKeyword)) ||
              (activeTab === 'location' && Boolean(onFilterByLocation));

            return (
              <div key={bar.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  {interactive ? (
                    <button
                      type="button"
                      onClick={() => handleBarClick(bar.label)}
                      className="font-semibold text-[#062856] hover:text-[#D96B0C] hover:underline text-left cursor-pointer"
                    >
                      {bar.label}
                    </button>
                  ) : (
                    <span className="font-semibold text-[#062856]">{bar.label}</span>
                  )}
                  <span className="font-bold text-slate-700 tabular-nums">
                    {bar.count} {bar.count === 1 ? 'role' : 'roles'}
                  </span>
                </div>

                <svg
                  className="w-full h-3 rounded-full overflow-hidden bg-slate-100"
                  viewBox="0 0 100 6"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${bar.label}: ${bar.count} roles`}
                >
                  <rect x="0" y="0" width={pct} height="6" rx="3" fill={color} />
                </svg>
              </div>
            );
          })}

          {(activeTab === 'sector' || activeTab === 'location') && (
            <p className="pt-1 text-[11px] text-slate-500">
              Tip: Click any {activeTab === 'sector' ? 'sector' : 'city'} label above to filter matching verified openings.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
