import { JobListing, PortalPageView } from '../types/portal';

const SITE_ORIGIN = 'https://www.jobsnia.com';
const BRAND_NAME = 'JobsNia.com — Vardhman Consultancy Services';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/aistudio/JobsNia._com_Vardhman_Consulting_86d1bef6.jpg`;

interface SeoPageConfig {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

const PAGE_SEO_MAP: Record<PortalPageView, SeoPageConfig> = {
  home: {
    title: 'JobsNia.com — Free Job Portal & Placement Services | Vardhman Consultancy Services',
    description:
      'Find verified Pharmaceutical, Healthcare, Hospital, Doctor, IT & Non-IT jobs across India on JobsNia.com. 100% Free Placement Services by Vardhman Consultancy Services (Jaipur, est. 2012).',
    path: '/',
  },
  'search-jobs': {
    title: 'Search Latest Jobs in India — Pharma, Healthcare, IT & Non-IT | JobsNia.com',
    description:
      'Browse active verified job openings across Jaipur, Rajasthan & Pan India on JobsNia.com. Apply directly with 100% free candidate placement.',
    path: '/search-jobs',
  },
  'job-details': {
    title: 'Job Opening Details | JobsNia.com — Vardhman Consultancy Services',
    description:
      'View full job description, salary package, required skills, and apply online free on JobsNia.com.',
    path: '/search-jobs',
  },
  'about-us': {
    title: 'About JobsNia.com & Vardhman Consultancy Services (Est. 2012, Jaipur)',
    description:
      'Learn about JobsNia.com, a venture of Vardhman Consultancy Services (VCS) founded by Mr. Vikas Jain in 2012 in Jaipur — delivering 100% free placement for candidates.',
    path: '/about-us',
  },
  'build-resume': {
    title: 'Free Resume Builder & ATS CV Maker | JobsNia.com',
    description:
      'Create a professional ATS-friendly resume PDF for free on JobsNia.com and get noticed by top Pharmaceutical, Healthcare, and IT employers.',
    path: '/build-resume',
  },
  'interview-tips': {
    title: 'Interview Preparation Tips & Career Guide | JobsNia.com',
    description:
      'Expert HR interview tips, salary negotiation advice, and career guidance from Vardhman Consultancy Services recruiters on JobsNia.com.',
    path: '/interview-tips',
  },
  'vcs-insights': {
    title: 'VCS Insights — Hiring Trends, Recruitment News & Career Updates | JobsNia.com',
    description:
      'Read verified hiring market updates, pharma & healthcare industry insights, and career advice published by Vardhman Consultancy Services on JobsNia.com.',
    path: '/vcs-insights',
  },
  'contact-us': {
    title: 'Contact JobsNia.com & Vardhman Consultancy Services — Jaipur, India',
    description:
      'Contact Vardhman Consultancy Services (JobsNia.com) for hiring mandates, candidate placement inquiries, and career support at info@vardhmanconsultancy.com.',
    path: '/contact-us',
  },
  'post-job': {
    title: 'Post a Job Opening & Hire Verified Talent | JobsNia.com Employer Desk',
    description:
      'Submit company hiring requirements on JobsNia.com Employer Desk and reach pre-screened Pharmaceutical, Healthcare, IT, and Non-IT professionals across India.',
    path: '/post-job',
  },
  'job-seeker-terms': {
    title: 'Job Seeker Terms & 100% Free Placement Policy | JobsNia.com',
    description:
      'Read JobsNia.com and Vardhman Consultancy Services transparent terms ensuring 100% free recruitment services for job seekers.',
    path: '/job-seeker-terms',
  },
  login: {
    title: 'Candidate & Employer Login | JobsNia.com',
    description: 'Sign in to your JobsNia.com account to manage job applications, resumes, and employer mandates.',
    path: '/login',
    noindex: true,
  },
  register: {
    title: 'Create Free Job Seeker or Employer Account | JobsNia.com',
    description: 'Register free on JobsNia.com to upload your resume, apply to verified jobs, or post hiring requirements.',
    path: '/register',
  },
  dashboard: {
    title: 'Candidate Dashboard | JobsNia.com',
    description: 'Track your job applications, resume profile, and smart job matches on JobsNia.com.',
    path: '/dashboard',
    noindex: true,
  },
  'employer-dashboard': {
    title: 'Employer Dashboard | JobsNia.com',
    description: 'Manage company job postings and candidate applications on JobsNia.com.',
    path: '/employer-dashboard',
    noindex: true,
  },
  'admin-dashboard': {
    title: 'Admin Console | JobsNia.com',
    description: 'Portal administration console.',
    path: '/admin-dashboard',
    noindex: true,
  },
  congratulations: {
    title: 'Application Submitted Successfully | JobsNia.com',
    description: 'Your submission on JobsNia.com was received by Vardhman Consultancy Services.',
    path: '/',
    noindex: true,
  },
};

function upsertMetaTag(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function toIsoDateOrToday(raw?: string): string {
  if (raw) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }
  }
  return new Date().toISOString().split('T')[0];
}

function mapEmploymentType(jobType?: string): string {
  const normalized = String(jobType || '').toLowerCase();
  if (normalized.includes('part')) return 'PART_TIME';
  if (normalized.includes('contract')) return 'CONTRACTOR';
  if (normalized.includes('intern')) return 'INTERN';
  if (normalized.includes('temp')) return 'TEMPORARY';
  return 'FULL_TIME';
}

function buildJobPostingSchema(job: JobListing): Record<string, unknown> {
  const datePosted = toIsoDateOrToday(job.createdAt || job.postedAt);
  const validThroughDate = new Date(Date.parse(datePosted) + 60 * 24 * 60 * 60 * 1000);
  const validThrough =
    job.lastDateToApply && !Number.isNaN(Date.parse(job.lastDateToApply))
      ? toIsoDateOrToday(job.lastDateToApply)
      : validThroughDate.toISOString().split('T')[0];

  const cleanLocation = (job.location || 'Jaipur, Rajasthan').trim();
  const locationParts = cleanLocation.split(',').map((s) => s.trim()).filter(Boolean);
  const locality = locationParts[0] || 'Jaipur';
  const region = locationParts[1] || 'India';

  return {
    '@type': 'JobPosting',
    title: job.title,
    description:
      (job.description || '').trim() ||
      `${job.title} opening (${job.experience || 'Experienced'}) in ${cleanLocation}. Apply free through JobsNia.com — Vardhman Consultancy Services.`,
    identifier: {
      '@type': 'PropertyValue',
      name: 'JobsNia.com',
      value: job.id,
    },
    datePosted,
    validThrough,
    employmentType: mapEmploymentType(job.jobType),
    directApply: true,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Vardhman Consultancy Services (JobsNia.com)',
      sameAs: SITE_ORIGIN,
      logo: DEFAULT_IMAGE,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: locality,
        addressRegion: region,
        addressCountry: 'IN',
      },
    },
    url: `${SITE_ORIGIN}/job/${encodeURIComponent(job.id)}`,
  };
}

export function updateSeoForRoute(options: {
  page: PortalPageView;
  selectedJob?: JobListing | null;
  approvedJobs?: JobListing[];
}): void {
  if (typeof document === 'undefined') return;
  const { page, selectedJob, approvedJobs = [] } = options;
  const baseConfig = PAGE_SEO_MAP[page] || PAGE_SEO_MAP.home;

  let title = baseConfig.title;
  let description = baseConfig.description;
  let canonicalPath = baseConfig.path;

  if (page === 'job-details' && selectedJob) {
    title = `${selectedJob.title} Job in ${selectedJob.location || 'India'} | JobsNia.com`;
    description = `Apply free for ${selectedJob.title} (${selectedJob.experience || 'Open Experience'}, ${selectedJob.salary || 'Competitive Salary'}) in ${selectedJob.location || 'India'} on JobsNia.com — Vardhman Consultancy Services.`;
    canonicalPath = `/job/${encodeURIComponent(selectedJob.id)}`;
  }

  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  document.title = title;

  upsertCanonicalLink(canonicalUrl);
  upsertMetaTag('meta[name="description"]', 'name', 'description', description);
  upsertMetaTag(
    'meta[name="robots"]',
    'name',
    'robots',
    baseConfig.noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );
  upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
  upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', BRAND_NAME);
  upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  upsertMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);

  // Inject dynamic Schema.org JobPosting structured data for Google Jobs
  const existingScript = document.getElementById('jobsnia-dynamic-jsonld');
  const jobSchemas: Record<string, unknown>[] = [];

  if (page === 'job-details' && selectedJob) {
    jobSchemas.push(buildJobPostingSchema(selectedJob));
  } else if (page === 'home' || page === 'search-jobs') {
    for (const job of approvedJobs.slice(0, 10)) {
      jobSchemas.push(buildJobPostingSchema(job));
    }
  }

  if (jobSchemas.length > 0) {
    const scriptEl = existingScript || document.createElement('script');
    scriptEl.id = 'jobsnia-dynamic-jsonld';
    scriptEl.setAttribute('type', 'application/ld+json');
    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': jobSchemas,
    });
    if (!existingScript) {
      document.head.appendChild(scriptEl);
    }
  } else if (existingScript) {
    existingScript.remove();
  }
}
