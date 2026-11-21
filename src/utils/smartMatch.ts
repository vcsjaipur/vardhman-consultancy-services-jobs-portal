import { CandidateProfile, JobListing, SearchHistoryItem, SmartMatchResult } from '../types/portal';

const LOCAL_SEARCH_HISTORY_KEY = 'vcs_portal_search_history_v1';

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s+.#]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function parseYearsNumber(expStr: string): number | null {
  const lower = expStr.toLowerCase();
  if (lower.includes('fresher') || lower.startsWith('0')) return 0;
  const matches = lower.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[0]);
}

export function computeSmartMatch(
  job: JobListing,
  candidate: CandidateProfile | null
): SmartMatchResult | null {
  if (!candidate || candidate.role !== 'candidate') return null;

  const jobText = [
    job.title,
    job.jobTitle || '',
    job.designation,
    job.qualification,
    job.description,
    ...job.skills,
  ]
    .join(' ')
    .toLowerCase();

  const candidateSkills = (candidate.keySkills || []).map((s) => s.trim()).filter(Boolean);
  const candidateTokens = Array.from(
    new Set([
      ...candidateSkills.flatMap((s) => tokenize(s)),
      ...tokenize(candidate.preferredRole || ''),
      ...tokenize(candidate.designation || ''),
      ...tokenize(candidate.qualification || ''),
      ...tokenize(candidate.resumeHeadline || ''),
    ])
  );

  let score = 42; // Baseline for verified portal candidate
  const reasons: string[] = [];
  const matchedSkills: string[] = [];

  // 1. Skills match (up to +32)
  if (candidateSkills.length > 0) {
    for (const skill of candidateSkills) {
      const sLower = skill.toLowerCase();
      if (jobText.includes(sLower) || job.skills.some((js) => js.toLowerCase().includes(sLower))) {
        matchedSkills.push(skill);
      }
    }
    if (matchedSkills.length > 0) {
      const bonus = Math.min(32, 12 + matchedSkills.length * 7);
      score += bonus;
      reasons.push(`${matchedSkills.length} key skill match`);
    }
  } else if (candidateTokens.length > 0) {
    const tokenHits = candidateTokens.filter((t) => jobText.includes(t));
    if (tokenHits.length > 0) {
      score += Math.min(24, tokenHits.length * 6);
      reasons.push('Profile keywords align');
    }
  }

  // 2. Role / Qualification alignment (up to +14)
  const roleWords = tokenize(
    `${candidate.preferredRole || ''} ${candidate.designation || ''} ${candidate.qualification || ''}`
  );
  const roleHits = roleWords.filter((w) => jobText.includes(w));
  if (roleHits.length > 0) {
    score += Math.min(14, roleHits.length * 5);
    reasons.push('Role & qualification alignment');
  }

  // 3. Location match (up to +12)
  const jobLoc = (job.location || '').toLowerCase();
  const candCity = (candidate.preferredLocation || candidate.city || '').toLowerCase().trim();
  if (jobLoc.includes('pan india') || jobLoc.includes('remote') || jobLoc.includes('anywhere')) {
    score += 10;
    reasons.push('Pan-India / flexible location');
  } else if (candCity && (jobLoc.includes(candCity) || candCity.split(/[,\s]+/).some((c) => c.length > 2 && jobLoc.includes(c)))) {
    score += 12;
    reasons.push(`Matches preferred location (${candidate.preferredLocation || candidate.city})`);
  }

  // 4. Experience compatibility (up to +8)
  const candYears = parseYearsNumber(candidate.experience || '');
  const jobYears = parseYearsNumber(job.experience || '');
  if (candYears !== null && jobYears !== null) {
    if (Math.abs(candYears - jobYears) <= 2 || candYears >= jobYears) {
      score += 8;
      reasons.push('Experience level compatible');
    }
  }

  // 5. Verified skill test bonus (+4)
  if ((candidate.skillTestResults || []).some((t) => t.scorePercent >= 60)) {
    score += 4;
    reasons.push('Verified skill test badge');
  }

  const finalScore = Math.max(35, Math.min(98, Math.round(score)));
  const label: SmartMatchResult['label'] =
    finalScore >= 85
      ? 'Top Match'
      : finalScore >= 72
        ? 'Strong Match'
        : finalScore >= 58
          ? 'Good Fit'
          : 'Moderate Fit';

  return {
    score: finalScore,
    label,
    matchedSkills: matchedSkills.slice(0, 5),
    reasons: reasons.slice(0, 3),
  };
}

export function loadLocalSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SearchHistoryItem[]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function persistLocalSearchHistory(items: SearchHistoryItem[]): void {
  try {
    window.localStorage.setItem(LOCAL_SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
  } catch {
    // Ignore storage quota errors
  }
}

export function addLocalSearchHistoryItem(input: {
  keyword: string;
  location: string;
  experience?: string;
  salary?: string;
  designation?: string;
}): SearchHistoryItem[] {
  const keyword = input.keyword.trim();
  const location = input.location.trim();
  const experience = (input.experience || '').trim();
  const salary = (input.salary || '').trim();
  const designation = (input.designation || '').trim();

  if (!keyword && !location && !experience && !salary && !designation) {
    return loadLocalSearchHistory();
  }

  const existing = loadLocalSearchHistory();
  const nextItem: SearchHistoryItem = {
    id: `sh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    keyword,
    location,
    experience: experience || undefined,
    salary: salary || undefined,
    designation: designation || undefined,
    createdAt: new Date().toISOString(),
  };

  const deduped = existing.filter(
    (item) =>
      !(
        item.keyword.toLowerCase() === keyword.toLowerCase() &&
        item.location.toLowerCase() === location.toLowerCase() &&
        (item.experience || '') === experience
      )
  );
  const next = [nextItem, ...deduped].slice(0, 12);
  persistLocalSearchHistory(next);
  return next;
}
