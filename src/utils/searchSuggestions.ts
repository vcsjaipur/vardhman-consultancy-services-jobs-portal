import {
  JobListing,
  SearchHistoryItem,
  SearchSuggestionItem,
} from '../types/portal';

const CURATED_ROLE_SKILL_SUGGESTIONS = [
  'Medical Representative',
  'Consultant Physician',
  'Cardiologist',
  'Radiologist',
  'Pathologist',
  'Gynaecologist',
  'Paediatrician',
  'MBBS Medical Officer',
  'Pharmaceutical Sales & Marketing',
  'Area Sales Manager (Pharma)',
  'National Sales Manager',
  'Product Manager',
  'Production / QA / QC',
  'Quality Assurance (QA)',
  'Quality Control (QC)',
  'Regulatory Affairs',
  'R&D Formulation',
  'Pharmacovigilance',
  'Plant Head',
  'Clinical Research',
  'Hospital Operations Manager',
  'Nursing Superintendent',
  'Pharmacist',
  'Accounts & Finance Head',
  'Chartered Accountant (CA)',
  'HR & Administration',
  'Software Engineer / IT',
  'AI / ML Engineer',
  'Nutrition & Dietetics',
  'Oncology & Anesthesia',
  'Biotechnology / Life Sciences',
];

const CURATED_LOCATION_SUGGESTIONS = [
  'Pan India',
  'Mumbai',
  'Delhi NCR',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Chennai',
  'Kolkata',
  'Chandigarh',
  'Baddi (Himachal Pradesh)',
  'Indore',
  'Lucknow',
  'Noida',
  'Gurugram',
  'Vadodara',
  'Surat',
  'Nagpur',
  'Bhopal',
  'Kochi',
  'Dehradun',
  'Haridwar',
  'Remote',
];

const CURATED_DESIGNATION_SUGGESTIONS = [
  'Medical Officer',
  'Consultant Doctor',
  'Medical Representative',
  'Area Manager',
  'Regional Sales Manager',
  'National Sales Manager',
  'Product Manager',
  'QA Executive',
  'QC Analyst',
  'AGM',
  'DGM',
  'GM',
  'Vice President',
  'Plant Head',
  'Finance Controller',
  'HR Manager',
  'Software Engineer',
];

export type SuggestionFieldType = 'keyword' | 'location' | 'designation';

export function buildSearchSuggestions(params: {
  query: string;
  field: SuggestionFieldType;
  jobs: JobListing[];
  searchHistory?: SearchHistoryItem[];
  maxItems?: number;
}): SearchSuggestionItem[] {
  const { query, field, jobs, searchHistory = [], maxItems = 8 } = params;
  const cleanQuery = query.trim().toLowerCase();

  const itemsMap = new Map<string, SearchSuggestionItem>();

  const addCandidate = (
    rawValue: string,
    category: SearchSuggestionItem['category'],
    incrementCount = false
  ) => {
    const value = rawValue.trim();
    if (!value || value.length < 2) return;
    const key = value.toLowerCase();
    const existing = itemsMap.get(key);
    if (existing) {
      if (incrementCount) {
        existing.matchCount = (existing.matchCount || 0) + 1;
      }
      return;
    }
    itemsMap.set(key, {
      value,
      label: value,
      category,
      matchCount: incrementCount ? 1 : undefined,
    });
  };

  // 1. Recent search history items first
  for (const h of searchHistory) {
    if (field === 'keyword' && h.keyword) {
      addCandidate(h.keyword, 'Recent', false);
    } else if (field === 'location' && h.location) {
      addCandidate(h.location, 'Recent', false);
    } else if (field === 'designation' && h.designation) {
      addCandidate(h.designation, 'Recent', false);
    }
  }

  // 2. Live approved job fields
  for (const job of jobs) {
    if (field === 'keyword') {
      if (job.title) addCandidate(job.title, 'Live Jobs', true);
      if (job.designation && job.designation !== job.title) {
        addCandidate(job.designation, 'Live Jobs', true);
      }
      for (const skill of job.skills || []) {
        addCandidate(skill, 'Live Jobs', true);
      }
    } else if (field === 'location') {
      if (job.location) {
        addCandidate(job.location, 'Live Jobs', true);
        const parts = job.location.split(/[,/|-]+/).map((p) => p.trim());
        if (parts.length > 1) {
          for (const part of parts) {
            if (part.length >= 3) addCandidate(part, 'Live Jobs', true);
          }
        }
      }
    } else if (field === 'designation') {
      if (job.designation) addCandidate(job.designation, 'Live Jobs', true);
      if (job.title) addCandidate(job.title, 'Live Jobs', true);
    }
  }

  // 3. Curated sector / city catalog
  const curatedPool =
    field === 'location'
      ? CURATED_LOCATION_SUGGESTIONS
      : field === 'designation'
        ? CURATED_DESIGNATION_SUGGESTIONS
        : CURATED_ROLE_SKILL_SUGGESTIONS;

  for (const item of curatedPool) {
    addCandidate(item, 'Popular', false);
  }

  const allItems = Array.from(itemsMap.values());

  if (!cleanQuery) {
    // When empty, show recent + highest-frequency live jobs + top curated options
    return allItems
      .sort((a, b) => {
        const order = { Recent: 0, 'Live Jobs': 1, Popular: 2, AI: 3 };
        if (order[a.category] !== order[b.category]) {
          return order[a.category] - order[b.category];
        }
        return (b.matchCount || 0) - (a.matchCount || 0);
      })
      .slice(0, maxItems);
  }

  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

  const ranked = allItems
    .map((item) => {
      const lower = item.value.toLowerCase();
      let rankScore = 0;

      if (lower === cleanQuery) rankScore += 100;
      else if (lower.startsWith(cleanQuery)) rankScore += 65;
      else if (lower.includes(cleanQuery)) rankScore += 40;
      else if (queryTokens.length > 1 && queryTokens.every((t) => lower.includes(t))) {
        rankScore += 30;
      } else if (queryTokens.some((t) => t.length >= 2 && lower.includes(t))) {
        rankScore += 15;
      }

      if (rankScore === 0) return null;

      if (item.category === 'Recent') rankScore += 12;
      if (item.category === 'Live Jobs') rankScore += 10 + Math.min(8, item.matchCount || 0);

      return { item, rankScore };
    })
    .filter((x): x is { item: SearchSuggestionItem; rankScore: number } => x !== null)
    .sort((a, b) => b.rankScore - a.rankScore || a.item.value.localeCompare(b.item.value));

  return ranked.slice(0, maxItems).map((r) => r.item);
}
