import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, ensureVerifiedGoogleUser, googleProvider } from './firebase';
import { AboutUsPage } from './components/AboutUsPage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { ApplyJobModal } from './components/ApplyJobModal';
import { BuildResumePage } from './components/BuildResumePage';
import { CongratulationsPage } from './components/CongratulationsPage';
import { ContactUsPage } from './components/ContactUsPage';
import { DashboardPage } from './components/DashboardPage';
import { EmployerDashboardPage } from './components/EmployerDashboardPage';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HeroSearch } from './components/HeroSearch';
import { InterviewTipsPage } from './components/InterviewTipsPage';
import { JobAlertsModal } from './components/JobAlertsModal';
import { JobDetailsPage } from './components/JobDetailsPage';
import { JobSeekerTermsPage } from './components/JobSeekerTermsPage';
import { LiveJobsSection } from './components/LiveJobsSection';
import { LoginPage } from './components/LoginPage';
import { PortalActionModal } from './components/PortalActionModal';
import { PostJobPage } from './components/PostJobPage';
import { RegisterPage } from './components/RegisterPage';
import { SearchJobsPage } from './components/SearchJobsPage';
import { SkillTestModal } from './components/SkillTestModal';
import { VcsInsightsPage } from './components/VcsInsightsPage';
import { WhyChooseSection } from './components/WhyChooseSection';
import { CompanySection } from './components/CompanySection';
import { OfflineBanner } from './components/OfflineBanner';
import {
  AdminErrorNotification,
  CandidateProfile,
  CongratulationsContext,
  FirestoreSubscriptionError,
  InsightPost,
  JobApplication,
  JobListing,
  JobSearchFilters,
  PortalModalType,
  PortalPageView,
  SearchHistoryItem,
  SearchPageFilters,
  UserRole,
} from './types/portal';
import {
  buildFirestoreSubscriptionError,
  markAdminFeedResolved,
  upsertAdminError,
} from './utils/adminErrorTracker';
import {
  addInsightComment,
  createInsightPost,
  deleteCandidateSearchHistory,
  deleteInsightComment,
  deleteInsightPost,
  fetchAdminApplications,
  fetchAdminJobs,
  fetchCurrentCandidate,
  fetchEmployerJobs,
  fetchInsightPosts,
  fetchMyApplications,
  getCachedCandidateProfile,
  getStoredToken,
  loginWithGoogleToken,
  saveCandidateSearchHistory,
  SaveInsightPostPayload,
  setCachedCandidateProfile,
  setStoredToken,
  toggleInsightLike,
  updateAdminJobStatus,
  updateInsightPost,
} from './utils/candidateApi';
import {
  fetchGlobalAutoApproveSetting,
  fetchPublicJobById,
  getCachedVisitorStats,
  resolveGoogleUserProfileFromFirestore,
  setGlobalAutoApproveSetting,
  SiteVisitorStats,
  subscribeAdminApplicationsFromFirestore,
  subscribeAdminJobsFromFirestore,
  subscribeAdminResumeGodamFromFirestore,
  subscribeAdminUsersFromFirestore,
  subscribeApprovedPublicJobs,
  subscribeCandidateApplicationsFromFirestore,
  subscribeCandidateResumeGodamFromFirestore,
  subscribeCumulativeVisitorsFromFirestore,
  subscribeEmployerApplicationsFromFirestore,
  subscribeEmployerJobsFromFirestore,
  syncApprovedJobsToPublicInFirestore,
  syncUserProfileToFirestore,
  updateJobApprovalInFirestore,
} from './utils/firestorePortal';
import { updateSeoForRoute } from './utils/seoManager';
import {
  fetchSharedActiveJobs,
  fetchSharedCandidatesAsApplications,
  fetchSharedCompanyRequirements,
  fetchSharedJobById,
  fetchSharedResumeGodamEntries,
  SharedClientQueryRecord,
  SharedCompanyRequirementRecord,
  startSharedAutoSyncDaemon,
  subscribeSharedActiveJobs,
  subscribeSharedCandidatesAsApplications,
  subscribeSharedClientQueries,
  subscribeSharedCompanyRequirements,
  subscribeSharedResumeGodamEntries,
} from './utils/sharedPortalFirestore';
import {
  loadOfflineCache,
  OFFLINE_CACHE_KEYS,
  saveOfflineCache,
  startOfflineApiDaemon,
} from './utils/offlineSyncManager';
import {
  filterJobsList,
  loadSavedJobIds,
  persistSavedJobIds,
} from './utils/jobHelpers';
import {
  addLocalSearchHistoryItem,
  loadLocalSearchHistory,
  persistLocalSearchHistory,
} from './utils/smartMatch';

const INITIAL_FILTERS: JobSearchFilters = {
  keyword: '',
  location: '',
  experience: '',
  salary: '',
};

const INITIAL_SEARCH_PAGE_FILTERS: SearchPageFilters = {
  ...INITIAL_FILTERS,
  designation: '',
};

function parseRouteFromHash(): {
  page: PortalPageView;
  jobId: string | null;
  portalRole?: UserRole;
  searchQuery?: string;
} {
  const rawHash = window.location.hash;
  const clean = rawHash.replace(/^#\/?/, '').toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const queryParam = (searchParams.get('q') || '').trim();

  if (clean === 'vcs-admin-only-2026') {
    return { page: 'login', jobId: null, portalRole: 'admin' };
  }
  if (clean === 'vcs-admin-register-2026') {
    return { page: 'register', jobId: null, portalRole: 'admin' };
  }
  if (clean === 'employer-login') {
    return { page: 'login', jobId: null, portalRole: 'employer' };
  }
  if (clean === 'employer-register') {
    return { page: 'register', jobId: null, portalRole: 'employer' };
  }
  if (clean === 'search-jobs') {
    return { page: 'search-jobs', jobId: null, searchQuery: queryParam || undefined };
  }
  if (clean === 'register') {
    return { page: 'register', jobId: null, portalRole: 'candidate' };
  }
  if (clean === 'login') {
    return { page: 'login', jobId: null, portalRole: 'candidate' };
  }
  if (clean === 'dashboard') {
    return { page: 'dashboard', jobId: null };
  }
  if (clean === 'post-job') {
    return { page: 'post-job', jobId: null };
  }
  if (clean === 'employer-dashboard') {
    return { page: 'employer-dashboard', jobId: null };
  }
  if (clean === 'admin-dashboard') {
    return { page: 'admin-dashboard', jobId: null };
  }
  if (clean === 'about-us' || clean === 'about') {
    return { page: 'about-us', jobId: null };
  }
  if (clean === 'contact-us') {
    return { page: 'contact-us', jobId: null };
  }
  if (clean === 'build-resume') {
    return { page: 'build-resume', jobId: null };
  }
  if (clean === 'interview-tips') {
    return { page: 'interview-tips', jobId: null };
  }
  if (clean === 'job-seeker-terms') {
    return { page: 'job-seeker-terms', jobId: null };
  }
  if (clean === 'congratulations') {
    return { page: 'congratulations', jobId: null };
  }
  if (clean === 'vcs-insights' || clean.startsWith('vcs-insights?')) {
    return { page: 'vcs-insights', jobId: null };
  }
  if (rawHash.startsWith('#job/')) {
    const id = decodeURIComponent(rawHash.slice('#job/'.length));
    return { page: 'job-details', jobId: id || null };
  }

  // Also support clean SEO URLs (e.g. https://www.jobsnia.com/search-jobs or /job/123)
  const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (cleanPath === 'search-jobs' || cleanPath === 'jobs') {
    return { page: 'search-jobs', jobId: null, searchQuery: queryParam || undefined };
  }
  if (cleanPath === 'about-us' || cleanPath === 'about') {
    return { page: 'about-us', jobId: null };
  }
  if (cleanPath === 'contact-us' || cleanPath === 'contact') {
    return { page: 'contact-us', jobId: null };
  }
  if (cleanPath === 'build-resume') {
    return { page: 'build-resume', jobId: null };
  }
  if (cleanPath === 'interview-tips') {
    return { page: 'interview-tips', jobId: null };
  }
  if (cleanPath === 'vcs-insights') {
    return { page: 'vcs-insights', jobId: null };
  }
  if (cleanPath === 'post-job') {
    return { page: 'post-job', jobId: null };
  }
  if (cleanPath === 'job-seeker-terms') {
    return { page: 'job-seeker-terms', jobId: null };
  }
  if (cleanPath === 'register') {
    return { page: 'register', jobId: null, portalRole: 'candidate' };
  }
  if (cleanPath === 'login') {
    return { page: 'login', jobId: null, portalRole: 'candidate' };
  }
  if (cleanPath === 'employer-login') {
    return { page: 'login', jobId: null, portalRole: 'employer' };
  }
  if (cleanPath === 'employer-register') {
    return { page: 'register', jobId: null, portalRole: 'employer' };
  }
  if (cleanPath === 'vcs-admin-only-2026') {
    return { page: 'login', jobId: null, portalRole: 'admin' };
  }
  if (cleanPath === 'vcs-admin-register-2026') {
    return { page: 'register', jobId: null, portalRole: 'admin' };
  }
  if (cleanPath === 'dashboard') {
    return { page: 'dashboard', jobId: null };
  }
  if (cleanPath === 'employer-dashboard') {
    return { page: 'employer-dashboard', jobId: null };
  }
  if (cleanPath === 'admin-dashboard' || cleanPath === 'admin') {
    return { page: 'admin-dashboard', jobId: null };
  }
  if (window.location.pathname.startsWith('/job/')) {
    const rawId = window.location.pathname.slice('/job/'.length).replace(/\/+$/, '');
    const id = decodeURIComponent(rawId);
    return { page: 'job-details', jobId: id || null };
  }
  if (queryParam) {
    return { page: 'search-jobs', jobId: null, searchQuery: queryParam };
  }

  return { page: 'home', jobId: null };
}

function mergeApplicationsLists(...lists: JobApplication[][]): JobApplication[] {
  const map = new Map<string, JobApplication>();
  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id) continue;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
        continue;
      }
      map.set(item.id, {
        ...existing,
        ...item,
        applicantEmail: item.applicantEmail || existing.applicantEmail,
        applicantPhone: item.applicantPhone || existing.applicantPhone,
        city: item.city || existing.city,
        qualificationExperience:
          item.qualificationExperience || existing.qualificationExperience,
        resumeSummary: item.resumeSummary || existing.resumeSummary,
        resumeBase64: item.resumeBase64 || existing.resumeBase64,
        termsAccepted: item.termsAccepted ?? existing.termsAccepted,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => Date.parse(b.appliedAt || '') - Date.parse(a.appliedAt || '')
  );
}

function mergeJobsLists(...lists: JobListing[][]): JobListing[] {
  const map = new Map<string, JobListing>();
  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id) continue;
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aMs = Date.parse(a.createdAt || a.postedAt || '') || 0;
    const bMs = Date.parse(b.createdAt || b.postedAt || '') || 0;
    return bMs - aMs;
  });
}

export default function App() {
  const initialRoute = parseRouteFromHash();
  const [currentPage, setCurrentPage] = useState<PortalPageView>(initialRoute.page);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialRoute.jobId);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(() =>
    getCachedCandidateProfile()
  );
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);

  const [approvedJobs, setApprovedJobs] = useState<JobListing[]>(() =>
    loadOfflineCache<JobListing[]>(OFFLINE_CACHE_KEYS.approvedJobs, [])
  );
  const [totalApprovedJobsCount, setTotalApprovedJobsCount] = useState(() =>
    loadOfflineCache<JobListing[]>(OFFLINE_CACHE_KEYS.approvedJobs, []).length
  );
  const [isLoadingPublicJobs, setIsLoadingPublicJobs] = useState(
    () => loadOfflineCache<JobListing[]>(OFFLINE_CACHE_KEYS.approvedJobs, []).length === 0
  );

  const [employerJobs, setEmployerJobs] = useState<JobListing[]>([]);
  const [isLoadingEmployerJobs, setIsLoadingEmployerJobs] = useState(false);
  const [employerApplications, setEmployerApplications] = useState<JobApplication[]>([]);
  const [isLoadingEmployerApplications, setIsLoadingEmployerApplications] = useState(false);

  const [adminJobs, setAdminJobs] = useState<JobListing[]>([]);
  const [isLoadingAdminJobs, setIsLoadingAdminJobs] = useState(false);
  const [adminApplications, setAdminApplications] = useState<JobApplication[]>(() =>
    loadOfflineCache<JobApplication[]>(OFFLINE_CACHE_KEYS.adminApplications, [])
  );
  const [companyRequirements, setCompanyRequirements] = useState<
    SharedCompanyRequirementRecord[]
  >(() =>
    loadOfflineCache<SharedCompanyRequirementRecord[]>(
      OFFLINE_CACHE_KEYS.companyRequirements,
      []
    )
  );
  const [registeredUsers, setRegisteredUsers] = useState<CandidateProfile[]>([]);
  const [clientQueries, setClientQueries] = useState<SharedClientQueryRecord[]>([]);
  const [visitorStats, setVisitorStats] = useState<SiteVisitorStats | null>(() =>
    getCachedVisitorStats()
  );
  const [isLoadingAdminApplications, setIsLoadingAdminApplications] = useState(false);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [adminErrors, setAdminErrors] = useState<AdminErrorNotification[]>([]);
  const [adminSubscriptionRetrySeq, setAdminSubscriptionRetrySeq] = useState(0);

  const [insightsPosts, setInsightsPosts] = useState<InsightPost[]>(() =>
    loadOfflineCache<InsightPost[]>(OFFLINE_CACHE_KEYS.insightsPosts, [])
  );
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const [filters, setFilters] = useState<JobSearchFilters>(() => ({
    ...INITIAL_FILTERS,
    keyword: initialRoute.searchQuery || '',
  }));
  const [appliedFilters, setAppliedFilters] = useState<JobSearchFilters | null>(null);

  const [searchPageFilters, setSearchPageFilters] = useState<SearchPageFilters>(() => ({
    ...INITIAL_SEARCH_PAGE_FILTERS,
    keyword: initialRoute.searchQuery || '',
  }));
  const [appliedSearchPageFilters, setAppliedSearchPageFilters] =
    useState<SearchPageFilters>(() => ({
      ...INITIAL_SEARCH_PAGE_FILTERS,
      keyword: initialRoute.searchQuery || '',
    }));

  const [activeModal, setActiveModal] = useState<PortalModalType>(null);
  const [isJobAlertsOpen, setIsJobAlertsOpen] = useState(false);
  const [applyModalState, setApplyModalState] = useState<{
    isOpen: boolean;
    mode: 'apply-job' | 'submit-resume';
    job: JobListing | null;
  }>({
    isOpen: false,
    mode: 'apply-job',
    job: null,
  });

  const [pendingApplyJob, setPendingApplyJob] = useState<JobListing | null>(null);
  const [pendingPostJob, setPendingPostJob] = useState(false);
  const [registerDefaultRole, setRegisterDefaultRole] = useState<UserRole>(
    initialRoute.portalRole || 'candidate'
  );
  const [loginPortalRole, setLoginPortalRole] = useState<UserRole>(
    initialRoute.portalRole || 'candidate'
  );
  const [congratulationsContext, setCongratulationsContext] =
    useState<CongratulationsContext>({ type: 'register' });
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => loadSavedJobIds());
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() =>
    loadLocalSearchHistory()
  );
  const [skillTestModalState, setSkillTestModalState] = useState<{
    isOpen: boolean;
    initialTopic: string;
  }>({
    isOpen: false,
    initialTopic: '',
  });
  const keywordInputRef = useRef<HTMLInputElement | null>(null);
  const restoringGoogleRef = useRef(false);
  const sharedActiveJobsRef = useRef<JobListing[]>([]);
  const primaryPublicJobsRef = useRef<JobListing[]>([]);

  const applyMergedApprovedJobs = () => {
    const merged = mergeJobsLists(
      sharedActiveJobsRef.current,
      primaryPublicJobsRef.current
    );
    setApprovedJobs(merged);
    setTotalApprovedJobsCount(merged.length);
    if (merged.length > 0) {
      saveOfflineCache(OFFLINE_CACHE_KEYS.approvedJobs, merged);
    }
  };

  const loadApprovedJobs = async () => {
    try {
      const list = await fetchSharedActiveJobs();
      sharedActiveJobsRef.current = list;
      applyMergedApprovedJobs();
    } catch {
      // Retain real-time snapshot state if manual refresh fails
    } finally {
      setIsLoadingPublicJobs(false);
    }
  };

  const handleLoadMorePublicJobs = async () => {
    // All active jobs are live-synced across devices
  };

  const loadApplicationsForCandidate = async () => {
    if (auth.currentUser?.emailVerified) return;
    setIsLoadingApplications(true);
    try {
      const list = await fetchMyApplications();
      setApplications(list);
    } catch {
      setApplications([]);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const loadEmployerJobsList = async () => {
    if (auth.currentUser?.emailVerified) return;
    setIsLoadingEmployerJobs(true);
    try {
      const list = await fetchEmployerJobs();
      setEmployerJobs(list);
    } catch {
      setEmployerJobs([]);
    } finally {
      setIsLoadingEmployerJobs(false);
    }
  };

  const reportAdminError = (err: FirestoreSubscriptionError) => {
    setAdminErrors((prev) => upsertAdminError(prev, err));
  };

  const markAdminFeedHealthy = (feedKey: string) => {
    setAdminErrors((prev) => markAdminFeedResolved(prev, feedKey));
  };

  const loadAdminJobsList = async () => {
    setIsLoadingAdminApplications(true);
    try {
      const [serverApps, sharedApps, sharedCandidates, sharedReqs] = await Promise.all([
        fetchAdminApplications().catch((err) => {
          if (auth.currentUser?.emailVerified) {
            reportAdminError(
              buildFirestoreSubscriptionError({
                feedKey: 'admin-api-applications',
                sourceLabel: 'Admin Applications API',
                database: 'api',
                operationType: 'get',
                path: '/api/admin/applications',
                error: err,
              })
            );
          }
          return [];
        }),
        fetchSharedResumeGodamEntries(reportAdminError).catch(() => []),
        fetchSharedCandidatesAsApplications(reportAdminError).catch(() => []),
        fetchSharedCompanyRequirements(reportAdminError).catch(() => []),
      ]);
      if (serverApps.length > 0 || sharedApps.length > 0 || sharedCandidates.length > 0) {
        setAdminApplications((prev) => {
          const next = mergeApplicationsLists(prev, serverApps, sharedApps, sharedCandidates);
          saveOfflineCache(OFFLINE_CACHE_KEYS.adminApplications, next);
          return next;
        });
      }
      if (sharedReqs.length > 0) {
        setCompanyRequirements(sharedReqs);
        saveOfflineCache(OFFLINE_CACHE_KEYS.companyRequirements, sharedReqs);
      }
    } finally {
      if (!auth.currentUser?.emailVerified) {
        setIsLoadingAdminApplications(false);
      }
    }

    if (auth.currentUser?.emailVerified) return;
    setIsLoadingAdminJobs(true);
    try {
      const list = await fetchAdminJobs();
      setAdminJobs(list);
    } catch (err) {
      setAdminJobs([]);
      reportAdminError(
        buildFirestoreSubscriptionError({
          feedKey: 'admin-api-jobs',
          sourceLabel: 'Admin Jobs API',
          database: 'api',
          operationType: 'get',
          path: '/api/admin/jobs',
          error: err,
        })
      );
    } finally {
      setIsLoadingAdminJobs(false);
    }
  };

  const loadInsightsFeed = async () => {
    setIsLoadingInsights(true);
    try {
      const list = await fetchInsightPosts();
      setInsightsPosts(list);
      saveOfflineCache(OFFLINE_CACHE_KEYS.insightsPosts, list);
    } catch {
      // Preserve offline cached insights if network is offline
    } finally {
      setIsLoadingInsights(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    const unsubscribeVisitors = subscribeCumulativeVisitorsFromFirestore(
      (stats) => {
        setVisitorStats(stats);
        markAdminFeedHealthy('visitor-stats');
      },
      (err) => {
        reportAdminError(err);
      }
    );
    return () => {
      unsubscribe();
      unsubscribeVisitors();
    };
  }, []);

  useEffect(() => {
    const stopSyncDaemon = startSharedAutoSyncDaemon();
    const stopApiDaemon = startOfflineApiDaemon();

    const unsubscribeSharedJobs = subscribeSharedActiveJobs(
      (jobsList) => {
        sharedActiveJobsRef.current = jobsList;
        applyMergedApprovedJobs();
        setIsLoadingPublicJobs(false);
        markAdminFeedHealthy('shared-active-jobs');
      },
      (friendlyMessage, details) => {
        setIsLoadingPublicJobs(false);
        if (details) {
          reportAdminError(details);
        } else {
          reportAdminError(
            buildFirestoreSubscriptionError({
              feedKey: 'shared-active-jobs',
              sourceLabel: 'Shared Portal Active Jobs',
              database: 'shared',
              operationType: 'list',
              path: 'jobs',
              error: friendlyMessage,
            })
          );
        }
      }
    );

    const unsubscribePrimaryJobs = subscribeApprovedPublicJobs(
      (jobsList) => {
        primaryPublicJobsRef.current = jobsList;
        applyMergedApprovedJobs();
        setIsLoadingPublicJobs(false);
        markAdminFeedHealthy('public-jobs');
      },
      200,
      (err) => {
        setIsLoadingPublicJobs(false);
        reportAdminError(err);
      }
    );

    void loadApprovedJobs();
    loadInsightsFeed();

    let active = true;
    fetchCurrentCandidate().then((profile) => {
      if (!active || !profile) return;
      setCandidate(profile);
      loadApplicationsForCandidate();
      loadEmployerJobsList();
      loadInsightsFeed();
      if (profile.role === 'admin') {
        void loadAdminJobsList();
      }
    });

    const refreshCrossDeviceLiveData = () => {
      void loadApprovedJobs();
      loadInsightsFeed();
      fetchCurrentCandidate().then((profile) => {
        if (!active || !profile) return;
        setCandidate(profile);
        if (profile.role === 'candidate') {
          void loadApplicationsForCandidate();
        } else if (profile.role === 'employer') {
          void loadEmployerJobsList();
        } else if (profile.role === 'admin') {
          void loadAdminJobsList();
        }
      });
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        refreshCrossDeviceLiveData();
      }
    };

    window.addEventListener('online', refreshCrossDeviceLiveData);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      active = false;
      stopSyncDaemon();
      stopApiDaemon();
      unsubscribeSharedJobs();
      unsubscribePrimaryJobs();
      window.removeEventListener('online', refreshCrossDeviceLiveData);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (
      candidate?.role === 'candidate' &&
      Array.isArray(candidate.searchHistory) &&
      candidate.searchHistory.length > 0
    ) {
      setSearchHistory(candidate.searchHistory);
      persistLocalSearchHistory(candidate.searchHistory);
    }
  }, [candidate?.id, candidate?.searchHistory]);

  useEffect(() => {
    if (
      firebaseUser &&
      firebaseUser.emailVerified &&
      !candidate &&
      !getStoredToken() &&
      !restoringGoogleRef.current
    ) {
      restoringGoogleRef.current = true;
      const email = String(firebaseUser.email || '').trim().toLowerCase();
      const targetRole: UserRole =
        email === 'cvforvcs@gmail.com' ? 'admin' : loginPortalRole || 'candidate';
      firebaseUser
        .getIdToken()
        .then((idToken) => loginWithGoogleToken(idToken, targetRole))
        .then((res) => {
          if (res?.candidate) {
            setCandidate(res.candidate);
            return;
          }
          return resolveGoogleUserProfileFromFirestore(firebaseUser, targetRole).then(
            (profile) => {
              setCachedCandidateProfile(profile);
              setCandidate(profile);
            }
          );
        })
        .catch(() => {
          return resolveGoogleUserProfileFromFirestore(firebaseUser, targetRole)
            .then((profile) => {
              setCachedCandidateProfile(profile);
              setCandidate(profile);
            })
            .catch(() => {});
        })
        .finally(() => {
          restoringGoogleRef.current = false;
        });
    }
  }, [firebaseUser, candidate, loginPortalRole]);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !candidate) {
      return;
    }

    void syncUserProfileToFirestore(candidate).catch(() => {
      // Keep session functional if background profile sync rejects
    });

    const unsubscribers: Array<() => void> = [];

    if (candidate.role === 'candidate') {
      setIsLoadingApplications(true);
      unsubscribers.push(
        subscribeCandidateApplicationsFromFirestore(firebaseUser.uid, (apps) => {
          setApplications((prev) => mergeApplicationsLists(prev, apps));
          setIsLoadingApplications(false);
        })
      );
      unsubscribers.push(
        subscribeCandidateResumeGodamFromFirestore(firebaseUser.uid, (godamApps) => {
          setApplications((prev) => mergeApplicationsLists(prev, godamApps));
          setIsLoadingApplications(false);
        })
      );
    }

    if (candidate.role === 'employer') {
      setIsLoadingEmployerJobs(true);
      setIsLoadingEmployerApplications(true);
      unsubscribers.push(
        subscribeEmployerJobsFromFirestore(firebaseUser.uid, (jobsList) => {
          setEmployerJobs(jobsList);
          setIsLoadingEmployerJobs(false);
        })
      );
      unsubscribers.push(
        subscribeEmployerApplicationsFromFirestore(firebaseUser.uid, (apps) => {
          setEmployerApplications(apps);
          setIsLoadingEmployerApplications(false);
        })
      );
    }

    if (candidate.role === 'admin') {
      setIsLoadingAdminJobs(true);
      setIsLoadingAdminApplications(true);
      unsubscribers.push(
        subscribeAdminJobsFromFirestore(
          (jobsList) => {
            setAdminJobs(jobsList);
            setIsLoadingAdminJobs(false);
            markAdminFeedHealthy('admin-jobs');
          },
          (err) => {
            setIsLoadingAdminJobs(false);
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeAdminApplicationsFromFirestore(
          (apps) => {
            setAdminApplications((prev) => mergeApplicationsLists(prev, apps));
            setIsLoadingAdminApplications(false);
            markAdminFeedHealthy('admin-applications');
          },
          (err) => {
            setIsLoadingAdminApplications(false);
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeAdminResumeGodamFromFirestore(
          (godamApps) => {
            setAdminApplications((prev) => mergeApplicationsLists(prev, godamApps));
            setIsLoadingAdminApplications(false);
            markAdminFeedHealthy('admin-resume-godam');
          },
          (err) => {
            setIsLoadingAdminApplications(false);
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeSharedResumeGodamEntries(
          (sharedApps) => {
            setAdminApplications((prev) => {
              const next = mergeApplicationsLists(prev, sharedApps);
              saveOfflineCache(OFFLINE_CACHE_KEYS.adminApplications, next);
              return next;
            });
            setIsLoadingAdminApplications(false);
            markAdminFeedHealthy('shared-resume-applications');
            markAdminFeedHealthy('shared-resume-candidates');
          },
          (err) => {
            setIsLoadingAdminApplications(false);
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeSharedCandidatesAsApplications(
          (sharedCands) => {
            setAdminApplications((prev) => {
              const next = mergeApplicationsLists(prev, sharedCands);
              saveOfflineCache(OFFLINE_CACHE_KEYS.adminApplications, next);
              return next;
            });
            setIsLoadingAdminApplications(false);
            markAdminFeedHealthy('shared-candidates-feed');
          },
          (err) => {
            setIsLoadingAdminApplications(false);
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeAdminUsersFromFirestore(
          (usersList) => {
            setRegisteredUsers(usersList);
            markAdminFeedHealthy('admin-users');
          },
          (err) => {
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeSharedCompanyRequirements(
          (reqs) => {
            setCompanyRequirements(reqs);
            saveOfflineCache(OFFLINE_CACHE_KEYS.companyRequirements, reqs);
            markAdminFeedHealthy('shared-company-requirements');
          },
          (err) => {
            reportAdminError(err);
          }
        )
      );
      unsubscribers.push(
        subscribeSharedClientQueries(
          (queries) => {
            setClientQueries(queries);
            markAdminFeedHealthy('shared-client-queries');
          },
          (err) => {
            reportAdminError(err);
          }
        )
      );
      void Promise.all([
        fetchAdminApplications().catch(() => []),
        fetchSharedResumeGodamEntries(reportAdminError).catch(() => []),
        fetchSharedCandidatesAsApplications(reportAdminError).catch(() => []),
        fetchSharedCompanyRequirements(reportAdminError).catch(() => []),
      ]).then(([serverApps, sharedApps, sharedCands, sharedReqs]) => {
        if (serverApps.length > 0 || sharedApps.length > 0 || sharedCands.length > 0) {
          setAdminApplications((prev) => {
            const next = mergeApplicationsLists(prev, serverApps, sharedApps, sharedCands);
            saveOfflineCache(OFFLINE_CACHE_KEYS.adminApplications, next);
            return next;
          });
        }
        if (sharedReqs.length > 0) {
          setCompanyRequirements(sharedReqs);
          saveOfflineCache(OFFLINE_CACHE_KEYS.companyRequirements, sharedReqs);
        }
        setIsLoadingAdminApplications(false);
      });
      fetchGlobalAutoApproveSetting()
        .then((enabled) => {
          setAutoApproveEnabled(enabled);
          markAdminFeedHealthy('auto-approve-setting');
        })
        .catch((err) => {
          reportAdminError(
            buildFirestoreSubscriptionError({
              feedKey: 'auto-approve-setting',
              sourceLabel: 'Job Workflow Setting',
              database: 'primary',
              operationType: 'get',
              path: 'portal_settings/jobs',
              error: err,
            })
          );
        });
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [firebaseUser, candidate?.id, candidate?.role, adminSubscriptionRetrySeq]);

  useEffect(() => {
    const handleHashChange = () => {
      const next = parseRouteFromHash();
      setCurrentPage(next.page);
      setSelectedJobId(next.jobId);
      if (next.portalRole) {
        setRegisterDefaultRole(next.portalRole);
        setLoginPortalRole(next.portalRole);
      }
      if (next.page === 'search-jobs' || next.page === 'job-details') {
        void loadApprovedJobs();
      }
      if (next.page === 'vcs-insights') {
        loadInsightsFeed();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const selectedJob =
      currentPage === 'job-details' && selectedJobId
        ? approvedJobs.find((job) => job.id === selectedJobId) || null
        : null;
    updateSeoForRoute({
      page: currentPage,
      selectedJob,
      approvedJobs,
    });
  }, [currentPage, selectedJobId, approvedJobs]);

  useEffect(() => {
    if (currentPage !== 'job-details' || !selectedJobId) return;
    if (approvedJobs.some((job) => job.id === selectedJobId)) return;

    let cancelled = false;
    void Promise.all([
      fetchSharedJobById(selectedJobId).catch(() => null),
      fetchPublicJobById(selectedJobId).catch(() => null),
    ]).then(([sharedJob, publicJob]) => {
      const fetchedJob = sharedJob || publicJob;
      if (cancelled || !fetchedJob) return;
      setApprovedJobs((prev) =>
        prev.some((j) => j.id === fetchedJob.id) ? prev : [fetchedJob, ...prev]
      );
    });
    return () => {
      cancelled = true;
    };
  }, [currentPage, selectedJobId, approvedJobs]);

  useEffect(() => {
    if (!candidate) return;
    if (
      candidate.role === 'employer' &&
      (currentPage === 'home' ||
        currentPage === 'login' ||
        currentPage === 'register' ||
        currentPage === 'search-jobs' ||
        currentPage === 'job-details' ||
        currentPage === 'build-resume' ||
        currentPage === 'interview-tips' ||
        currentPage === 'job-seeker-terms' ||
        currentPage === 'dashboard' ||
        currentPage === 'admin-dashboard')
    ) {
      setCurrentPage('employer-dashboard');
      setSelectedJobId(null);
      if (window.location.hash !== '#employer-dashboard') {
        window.location.hash = '#employer-dashboard';
      }
    } else if (
      candidate.role === 'candidate' &&
      (currentPage === 'login' ||
        currentPage === 'register' ||
        currentPage === 'employer-dashboard' ||
        currentPage === 'post-job' ||
        currentPage === 'admin-dashboard')
    ) {
      setCurrentPage('dashboard');
      setSelectedJobId(null);
      if (window.location.hash !== '#dashboard') {
        window.location.hash = '#dashboard';
      }
    } else if (
      candidate.role === 'admin' &&
      (currentPage === 'login' || currentPage === 'register')
    ) {
      setCurrentPage('admin-dashboard');
      setSelectedJobId(null);
      if (window.location.hash !== '#admin-dashboard') {
        window.location.hash = '#admin-dashboard';
      }
    }
  }, [candidate, currentPage]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navigateToHome = (scrollTargetId?: string) => {
    if (candidate?.role === 'employer' && !scrollTargetId) {
      loadEmployerJobsList();
      setCurrentPage('employer-dashboard');
      setSelectedJobId(null);
      if (window.location.hash !== '#employer-dashboard') {
        window.location.hash = '#employer-dashboard';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentPage('home');
    setSelectedJobId(null);
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
    if (scrollTargetId) {
      window.setTimeout(() => {
        scrollToSection(scrollTargetId);
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateToHashPage = (
    page:
      | 'about-us'
      | 'search-jobs'
      | 'register'
      | 'login'
      | 'dashboard'
      | 'post-job'
      | 'employer-dashboard'
      | 'admin-dashboard'
      | 'contact-us'
      | 'build-resume'
      | 'interview-tips'
      | 'job-seeker-terms'
      | 'congratulations'
      | 'vcs-insights',
    hash: string
  ) => {
    setCurrentPage(page);
    setSelectedJobId(null);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateJobs = () => {
    if (currentPage !== 'home') {
      navigateToHome('live-jobs');
      return;
    }
    scrollToSection('live-jobs');
  };

  const handleNavigateServices = () => {
    if (currentPage !== 'home') {
      navigateToHome('services');
      return;
    }
    scrollToSection('services');
  };

  const handleNavigateAbout = () => {
    navigateToHashPage('about-us', '#about-us');
  };

  const handleToggleSaveJob = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId];
      persistSavedJobIds(next);
      return next;
    });
  };

  const handleNavigateSearchJobs = () => {
    if (candidate?.role === 'employer') {
      handleNavigateEmployerDashboard();
      return;
    }
    loadApprovedJobs();
    navigateToHashPage('search-jobs', '#search-jobs');
  };

  const handleNavigateVcsInsights = () => {
    loadInsightsFeed();
    navigateToHashPage('vcs-insights', '#vcs-insights');
  };

  const handleNavigateRegister = (defaultRole: UserRole = 'candidate') => {
    setRegisterDefaultRole(defaultRole);
    const targetHash =
      defaultRole === 'employer'
        ? '#/employer-register'
        : defaultRole === 'admin'
          ? '#/vcs-admin-register-2026'
          : '#register';
    navigateToHashPage('register', targetHash);
  };

  const handleNavigateLogin = (portalRole: UserRole = 'candidate') => {
    setLoginPortalRole(portalRole);
    const targetHash =
      portalRole === 'employer'
        ? '#/employer-login'
        : portalRole === 'admin'
          ? '#/vcs-admin-only-2026'
          : '#login';
    navigateToHashPage('login', targetHash);
  };

  const handleNavigateRoleDashboard = (profileOverride?: CandidateProfile | null) => {
    const activeUser = profileOverride ?? candidate;
    if (activeUser?.role === 'admin') {
      loadAdminJobsList();
      navigateToHashPage('admin-dashboard', '#admin-dashboard');
      return;
    }
    if (activeUser?.role === 'employer') {
      loadEmployerJobsList();
      navigateToHashPage('employer-dashboard', '#employer-dashboard');
      return;
    }
    loadApplicationsForCandidate();
    navigateToHashPage('dashboard', '#dashboard');
  };

  const handleNavigateEmployerDashboard = () => {
    loadEmployerJobsList();
    navigateToHashPage('employer-dashboard', '#employer-dashboard');
  };

  const handleNavigateContactUs = () => {
    navigateToHashPage('contact-us', '#contact-us');
  };

  const handleNavigateBuildResume = () => {
    navigateToHashPage('build-resume', '#build-resume');
  };

  const handleNavigateInterviewTips = () => {
    navigateToHashPage('interview-tips', '#interview-tips');
  };

  const handleNavigateJobSeekerTerms = () => {
    navigateToHashPage('job-seeker-terms', '#job-seeker-terms');
  };

  const handleNavigateMyResume = () => {
    navigateToHashPage('dashboard', '#dashboard');
    if (candidate) {
      window.setTimeout(() => {
        scrollToSection('dashboard-resume-section');
      }, 100);
    }
  };

  const handleNavigateMyApplications = () => {
    navigateToHashPage('dashboard', '#dashboard');
    if (candidate) {
      window.setTimeout(() => {
        scrollToSection('dashboard-applications-section');
      }, 100);
    }
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentPage('job-details');
    const targetHash = `#job/${encodeURIComponent(jobId)}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recordSearchHistory = (input: {
    keyword: string;
    location: string;
    experience?: string;
    salary?: string;
    designation?: string;
  }) => {
    const hasCriteria =
      input.keyword.trim() ||
      input.location.trim() ||
      (input.experience || '').trim() ||
      (input.salary || '').trim() ||
      (input.designation || '').trim();
    if (!hasCriteria) return;

    const updatedLocal = addLocalSearchHistoryItem(input);
    setSearchHistory(updatedLocal);

    if (candidate?.role === 'candidate') {
      void saveCandidateSearchHistory(input)
        .then((res) => {
          if (Array.isArray(res.history)) {
            setSearchHistory(res.history);
            persistLocalSearchHistory(res.history);
          }
          if (res.candidate) {
            setCandidate(res.candidate);
          }
        })
        .catch(() => null);
    }
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    if (currentPage === 'home') {
      const nextHome: JobSearchFilters = {
        keyword: item.keyword || '',
        location: item.location || '',
        experience: item.experience || '',
        salary: item.salary || '',
      };
      setFilters(nextHome);
      setAppliedFilters(nextHome);
      scrollToSection('live-jobs');
      return;
    }

    const nextSearchPage: SearchPageFilters = {
      keyword: item.keyword || '',
      location: item.location || '',
      experience: item.experience || '',
      salary: item.salary || '',
      designation: item.designation || '',
    };
    setSearchPageFilters(nextSearchPage);
    setAppliedSearchPageFilters(nextSearchPage);
    if (currentPage !== 'search-jobs') {
      handleNavigateSearchJobs();
    }
  };

  const handleRemoveHistoryItem = (id: string) => {
    setSearchHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      persistLocalSearchHistory(next);
      return next;
    });
    if (candidate?.role === 'candidate') {
      void deleteCandidateSearchHistory(id)
        .then((res) => {
          if (res.candidate) setCandidate(res.candidate);
        })
        .catch(() => null);
    }
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
    persistLocalSearchHistory([]);
    if (candidate?.role === 'candidate') {
      void deleteCandidateSearchHistory()
        .then((res) => {
          if (res.candidate) setCandidate(res.candidate);
        })
        .catch(() => null);
    }
  };

  const handleSearchSubmit = () => {
    setAppliedFilters({ ...filters });
    recordSearchHistory(filters);
    scrollToSection('live-jobs');
  };

  const handleResetSearch = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(null);
  };

  const handleSearchPageSubmit = () => {
    setAppliedSearchPageFilters({ ...searchPageFilters });
    recordSearchHistory(searchPageFilters);
  };

  const handleResetSearchPageFilters = () => {
    setSearchPageFilters(INITIAL_SEARCH_PAGE_FILTERS);
    setAppliedSearchPageFilters(INITIAL_SEARCH_PAGE_FILTERS);
  };

  const handleFilterHomeByKeyword = (keyword: string) => {
    const nextFilters: SearchPageFilters = {
      keyword,
      location: '',
      experience: '',
      salary: '',
      designation: '',
    };
    setSearchPageFilters(nextFilters);
    setAppliedSearchPageFilters(nextFilters);
    recordSearchHistory({ keyword, location: '' });
    handleNavigateSearchJobs();
  };

  const handleUploadResumeAction = () => {
    setPendingApplyJob(null);
    setPendingPostJob(false);
    setApplyModalState({
      isOpen: true,
      mode: 'submit-resume',
      job: null,
    });
  };

  const handleApplyNowNavAction = () => {
    handleNavigateSearchJobs();
  };

  const handlePostJobAction = () => {
    if (candidate?.role === 'candidate') {
      handleNavigateSearchJobs();
      return;
    }
    navigateToHashPage('post-job', '#post-job');
  };

  const handleOpenPortalActionModal = (modal: PortalModalType) => {
    if (modal === 'upload-resume') {
      handleUploadResumeAction();
      return;
    }
    if (modal === 'apply') {
      handleApplyNowNavAction();
      return;
    }
    if (modal === 'post-job') {
      handlePostJobAction();
      return;
    }
    if (modal === 'register') {
      handleNavigateRegister('candidate');
      return;
    }
    if (modal === 'login') {
      handleNavigateLogin();
      return;
    }
    setActiveModal(modal);
  };

  const handleApplyForJob = (job: JobListing) => {
    setApplyModalState({
      isOpen: true,
      mode: 'apply-job',
      job,
    });
  };

  const handleAuthSuccess = async (
    loggedInUser: CandidateProfile,
    source: 'register' | 'login' | 'register-browse' = 'login',
    initialJob?: JobListing | null
  ) => {
    setCandidate(loggedInUser);
    await loadApplicationsForCandidate();
    await loadEmployerJobsList();
    if (initialJob) {
      setEmployerJobs((prev) => [initialJob, ...prev.filter((j) => j.id !== initialJob.id)]);
      if (loggedInUser.role === 'admin') {
        setAdminJobs((prev) => [initialJob, ...prev.filter((j) => j.id !== initialJob.id)]);
      }
    }
    await loadInsightsFeed();
    if (loggedInUser.role === 'admin') {
      await loadAdminJobsList();
    }

    if (pendingPostJob) {
      setPendingPostJob(false);
      navigateToHashPage('post-job', '#post-job');
      return;
    }

    if (source === 'register-browse') {
      setPendingApplyJob(null);
      handleNavigateSearchJobs();
      return;
    }

    if (pendingApplyJob) {
      const targetJob = pendingApplyJob;
      setPendingApplyJob(null);
      handleSelectJob(targetJob.id);
      setApplyModalState({
        isOpen: true,
        mode: 'apply-job',
        job: targetJob,
      });
      return;
    }

    handleNavigateRoleDashboard(loggedInUser);
  };

  const handleOwnerGoogleSignIn = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const email = String(cred.user.email || '').trim().toLowerCase();
    if (!cred.user.emailVerified || email !== 'cvforvcs@gmail.com') {
      await signOut(auth).catch(() => {});
      throw new Error(
        'Access restricted to authorized Google account only.'
      );
    }

    let adminProfile: CandidateProfile | null = null;
    try {
      const idToken = await cred.user.getIdToken();
      const res = await loginWithGoogleToken(idToken, 'admin');
      if (res?.candidate?.role === 'admin') {
        adminProfile = res.candidate;
      }
    } catch {
      // On static Firebase Hosting, /api/auth/google is absent — build owner session from verified Firebase Auth
    }

    if (!adminProfile) {
      adminProfile = {
        id: cred.user.uid,
        role: 'admin',
        name: cred.user.displayName || 'Vardhman Consultancy Owner',
        email,
        phone: cred.user.phoneNumber || '',
        city: 'Jaipur',
        experience: 'Owner / Admin',
        resumeId: null,
        resumeFileName: null,
        resumeUpdatedAt: null,
        createdAt: new Date().toISOString(),
      };
      setCachedCandidateProfile(adminProfile);
    }

    setCandidate(adminProfile);
    void syncUserProfileToFirestore(adminProfile).catch(() => {});
    navigateToHashPage('admin-dashboard', '#admin-dashboard');
  };

  const handleLogout = () => {
    void signOut(auth).catch(() => {});
    setStoredToken(null);
    setCandidate(null);
    setApplications([]);
    setEmployerJobs([]);
    setEmployerApplications([]);
    setAdminJobs([]);
    setAdminApplications([]);
    setRegisteredUsers([]);
    setClientQueries([]);
    setAdminErrors([]);
    setAutoApproveEnabled(false);
    setPendingApplyJob(null);
    setPendingPostJob(false);
    loadInsightsFeed();
    navigateToHome();
  };

  const handleDismissAdminError = (errorId: string) => {
    setAdminErrors((prev) =>
      prev.map((item) => (item.id === errorId ? { ...item, dismissed: true } : item))
    );
  };

  const handleClearAdminErrors = () => {
    setAdminErrors([]);
  };

  const handleRetryAdminSubscriptions = async () => {
    setAdminSubscriptionRetrySeq((seq) => seq + 1);
    await Promise.all([loadAdminJobsList(), loadApprovedJobs()]);
  };

  const handleApplicationSubmitted = (newApp: JobApplication) => {
    setApplications((prev) => mergeApplicationsLists([newApp], prev));
    if (candidate?.role === 'admin') {
      setAdminApplications((prev) => mergeApplicationsLists([newApp], prev));
    }
    setCongratulationsContext({
      type: 'apply',
      candidateName: newApp.applicantName,
      jobTitle: newApp.jobTitle,
      companyMasked: newApp.companyMasked,
    });
  };

  const handleJobPosted = (newJob: JobListing) => {
    setEmployerJobs((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);
    if (candidate?.role === 'admin') {
      setAdminJobs((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);
    }
    if (newJob.status === 'Approved') {
      setApprovedJobs((prev) => {
        const next = [newJob, ...prev.filter((j) => j.id !== newJob.id)];
        setTotalApprovedJobsCount(next.length);
        return next;
      });
    }
  };

  const handleAdminStatusUpdate = async (
    jobId: string,
    status: 'Approved' | 'Rejected'
  ) => {
    await ensureVerifiedGoogleUser();
    const targetJob =
      adminJobs.find((j) => j.id === jobId) ||
      approvedJobs.find((j) => j.id === jobId);
    if (!targetJob) {
      throw new Error('Selected job could not be located.');
    }
    const updatedJob = await updateJobApprovalInFirestore(targetJob, status);
    void updateAdminJobStatus(jobId, status).catch(() => null);
    setAdminJobs((prev) => prev.map((j) => (j.id === jobId ? updatedJob : j)));
    setEmployerJobs((prev) => prev.map((j) => (j.id === jobId ? updatedJob : j)));
    await loadApprovedJobs();
  };

  const handleToggleAutoApprove = async (enabled: boolean) => {
    await ensureVerifiedGoogleUser();
    const next = await setGlobalAutoApproveSetting(enabled);
    setAutoApproveEnabled(next);
  };

  const handleCreateInsight = async (payload: SaveInsightPostPayload) => {
    const created = await createInsightPost(payload);
    setInsightsPosts((prev) => [created, ...prev]);
  };

  const handleUpdateInsight = async (postId: string, payload: SaveInsightPostPayload) => {
    const updated = await updateInsightPost(postId, payload);
    setInsightsPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
  };

  const handleDeleteInsight = async (postId: string) => {
    await deleteInsightPost(postId);
    setInsightsPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleToggleInsightLike = async (postId: string) => {
    const updated = await toggleInsightLike(postId);
    setInsightsPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
  };

  const handleAddInsightComment = async (postId: string, content: string) => {
    const updated = await addInsightComment(postId, content);
    setInsightsPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
  };

  const handleDeleteInsightComment = async (postId: string, commentId: string) => {
    const updated = await deleteInsightComment(postId, commentId);
    setInsightsPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
  };

  const handleSyncApprovedJobs = async () => {
    await ensureVerifiedGoogleUser();
    const syncedCount = await syncApprovedJobsToPublicInFirestore(adminJobs);
    if (syncedCount > 0) {
      await loadApprovedJobs();
    }
    return syncedCount;
  };

  const filteredHomeJobs = approvedJobs.filter((job) => {
    if (!appliedFilters) return true;
    const kw = appliedFilters.keyword.trim().toLowerCase();
    const loc = appliedFilters.location.trim().toLowerCase();
    const matchesKeyword =
      !kw ||
      job.title.toLowerCase().includes(kw) ||
      (job.jobTitle || '').toLowerCase().includes(kw) ||
      job.designation.toLowerCase().includes(kw) ||
      job.description.toLowerCase().includes(kw) ||
      (job.jobDescription || '').toLowerCase().includes(kw) ||
      job.location.toLowerCase().includes(kw) ||
      job.qualification.toLowerCase().includes(kw) ||
      job.skills.some((s) => s.toLowerCase().includes(kw));
    const matchesLocation = !loc || job.location.toLowerCase().includes(loc);
    const matchesExperience =
      !appliedFilters.experience ||
      job.experience === appliedFilters.experience ||
      (appliedFilters.experience.toLowerCase().includes('fresher') &&
        (job.experience.toLowerCase().includes('fresher') ||
          job.location.toLowerCase().includes('fresher')));
    const matchesSalary = !appliedFilters.salary || job.salary === appliedFilters.salary;
    return matchesKeyword && matchesLocation && matchesExperience && matchesSalary;
  });

  const filteredSearchPageJobs = filterJobsList(approvedJobs, appliedSearchPageFilters);
  const selectedJob =
    selectedJobId !== null
      ? approvedJobs.find((job) => job.id === selectedJobId) ?? null
      : null;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-white text-slate-900">
      <Header
        currentPage={currentPage}
        candidate={candidate}
        onNavigateHome={() => navigateToHome()}
        onNavigateJobs={handleNavigateJobs}
        onNavigateAbout={handleNavigateAbout}
        onNavigateServices={handleNavigateServices}
        onNavigateSearchJobs={handleNavigateSearchJobs}
        onNavigateVcsInsights={handleNavigateVcsInsights}
        onNavigateBuildResume={handleNavigateBuildResume}
        onNavigateInterviewTips={handleNavigateInterviewTips}
        onNavigateJobSeekerTerms={handleNavigateJobSeekerTerms}
        onNavigateMyResume={handleNavigateMyResume}
        onNavigateMyApplications={handleNavigateMyApplications}
        onNavigateRegister={() => handleNavigateRegister('candidate')}
        onNavigateLogin={() => handleNavigateLogin('candidate')}
        onNavigateEmployerLogin={() => handleNavigateLogin('employer')}
        onNavigateDashboard={() => handleNavigateRoleDashboard()}
        onUploadResumeAction={handleUploadResumeAction}
        onApplyNowNavAction={handleApplyNowNavAction}
        onPostJobAction={handlePostJobAction}
        onNavigateContactUs={handleNavigateContactUs}
        onLogout={handleLogout}
        onOpenModal={handleOpenPortalActionModal}
      />

      <main className="flex-1">
        {currentPage === 'home' && (
          <>
            <HeroSearch
              filters={filters}
              onFiltersChange={setFilters}
              onSearchSubmit={handleSearchSubmit}
              keywordInputRef={keywordInputRef}
              onNavigateBuildResume={handleNavigateBuildResume}
              onNavigateSearchJobs={handleNavigateSearchJobs}
              searchHistory={searchHistory}
              onSelectHistoryItem={handleSelectHistoryItem}
              onRemoveHistoryItem={handleRemoveHistoryItem}
              onClearHistory={handleClearHistory}
            />

            <LiveJobsSection
              jobs={filteredHomeJobs}
              isLoading={isLoadingPublicJobs}
              candidate={candidate}
              appliedFilters={appliedFilters}
              savedJobIds={savedJobIds}
              onToggleSaveJob={handleToggleSaveJob}
              onResetSearch={handleResetSearch}
              onSelectJob={handleSelectJob}
              onApplyJob={handleApplyForJob}
              onFilterByKeyword={handleFilterHomeByKeyword}
              onNavigateSearchJobs={handleNavigateSearchJobs}
              onOpenModal={handleOpenPortalActionModal}
            />

            <WhyChooseSection />

            <CompanySection
              candidate={candidate}
              onPostJobAction={handlePostJobAction}
              onEmployerLogin={() => handleNavigateLogin('employer')}
              onEmployerRegister={() => handleNavigateRegister('employer')}
              onContactUs={handleNavigateContactUs}
            />
          </>
        )}

        {currentPage === 'search-jobs' && (
          <SearchJobsPage
            filters={searchPageFilters}
            appliedFilters={appliedSearchPageFilters}
            jobs={filteredSearchPageJobs}
            isLoading={isLoadingPublicJobs}
            candidate={candidate}
            searchHistory={searchHistory}
            onSelectHistoryItem={handleSelectHistoryItem}
            onRemoveHistoryItem={handleRemoveHistoryItem}
            onClearHistory={handleClearHistory}
            savedJobIds={savedJobIds}
            onToggleSaveJob={handleToggleSaveJob}
            totalJobsCount={totalApprovedJobsCount}
            hasMoreJobs={false}
            isLoadingMore={false}
            onLoadMoreJobs={handleLoadMorePublicJobs}
            onFiltersChange={setSearchPageFilters}
            onSearchSubmit={handleSearchPageSubmit}
            onResetFilters={handleResetSearchPageFilters}
            onSelectJob={handleSelectJob}
            onApplyJob={handleApplyForJob}
            onBackHome={() => navigateToHome()}
            onOpenModal={handleOpenPortalActionModal}
            onOpenJobAlerts={() => setIsJobAlertsOpen(true)}
          />
        )}

        {currentPage === 'job-details' && (
          <JobDetailsPage
            job={selectedJob}
            candidate={candidate}
            isSaved={selectedJob ? savedJobIds.includes(selectedJob.id) : false}
            onToggleSaveJob={handleToggleSaveJob}
            onTakeSkillTest={(topic) =>
              setSkillTestModalState({ isOpen: true, initialTopic: topic })
            }
            onCandidateUpdated={setCandidate}
            onBackToSearch={handleNavigateJobs}
            onApplyJob={handleApplyForJob}
            onOpenModal={handleOpenPortalActionModal}
          />
        )}

        {currentPage === 'register' && (
          <RegisterPage
            key={registerDefaultRole}
            defaultRole={registerDefaultRole}
            pendingJobTitle={pendingApplyJob?.title || null}
            onSuccess={(user, initialJob) => handleAuthSuccess(user, 'register', initialJob)}
            onBrowseJobs={(user) => handleAuthSuccess(user, 'register-browse')}
            onGoToLogin={() => handleNavigateLogin(registerDefaultRole)}
            onBackHome={() => navigateToHome()}
          />
        )}

        {currentPage === 'login' && (
          <LoginPage
            key={loginPortalRole}
            portalRole={loginPortalRole}
            pendingJobTitle={pendingApplyJob?.title || null}
            onSuccess={(user) => handleAuthSuccess(user, 'login')}
            onGoToRegister={() => handleNavigateRegister(loginPortalRole)}
            onBackHome={() => navigateToHome()}
          />
        )}

        {currentPage === 'dashboard' && (
          <DashboardPage
            candidate={candidate}
            applications={applications}
            approvedJobs={approvedJobs}
            isLoadingApplications={isLoadingApplications}
            onCandidateUpdated={setCandidate}
            onApplicationsAdded={(newApps) =>
              setApplications((prev) => [
                ...newApps,
                ...prev.filter((a) => !newApps.some((n) => n.id === a.id)),
              ])
            }
            onOpenSkillTest={(topic) =>
              setSkillTestModalState({ isOpen: true, initialTopic: topic || '' })
            }
            onLogout={handleLogout}
            onGoToLogin={() => handleNavigateLogin('candidate')}
            onGoToRegister={() => handleNavigateRegister('candidate')}
            onGoToSearchJobs={handleNavigateSearchJobs}
            onGoToBuildResume={handleNavigateBuildResume}
            onSelectJob={handleSelectJob}
          />
        )}

        {currentPage === 'post-job' && (
          <PostJobPage
            candidate={candidate}
            onJobPosted={handleJobPosted}
            onGoToEmployerDashboard={handleNavigateEmployerDashboard}
            onGoToLogin={() => handleNavigateLogin('employer')}
            onGoToRegister={() => handleNavigateRegister('employer')}
            onBackHome={() => navigateToHome()}
          />
        )}

        {currentPage === 'employer-dashboard' && (
          <EmployerDashboardPage
            candidate={candidate}
            jobs={employerJobs}
            applications={employerApplications}
            isLoading={isLoadingEmployerJobs}
            isLoadingApplications={isLoadingEmployerApplications}
            onPostNewJob={handlePostJobAction}
            onJobPosted={handleJobPosted}
            onSelectJob={handleSelectJob}
            onLogout={handleLogout}
            onGoToLogin={() => handleNavigateLogin('employer')}
            onGoToRegister={() => handleNavigateRegister('employer')}
          />
        )}

        {currentPage === 'admin-dashboard' && (
          <AdminDashboardPage
            candidate={candidate}
            jobs={adminJobs}
            applications={adminApplications}
            registeredUsers={registeredUsers}
            companyRequirements={companyRequirements}
            clientQueries={clientQueries}
            visitorStats={visitorStats}
            isLoading={isLoadingAdminJobs}
            isLoadingApplications={isLoadingAdminApplications}
            autoApproveEnabled={autoApproveEnabled}
            adminErrors={adminErrors}
            onReportAdminError={reportAdminError}
            onDismissAdminError={handleDismissAdminError}
            onClearAdminErrors={handleClearAdminErrors}
            onRetryAdminSubscriptions={handleRetryAdminSubscriptions}
            onToggleAutoApprove={handleToggleAutoApprove}
            onSyncApprovedJobs={handleSyncApprovedJobs}
            onPostNewJob={handlePostJobAction}
            onUpdateStatus={handleAdminStatusUpdate}
            onManageVcsInsights={handleNavigateVcsInsights}
            onOwnerGoogleSignIn={handleOwnerGoogleSignIn}
            onLogout={handleLogout}
            onGoToLogin={() => handleNavigateLogin('admin')}
            onGoToRegister={() => handleNavigateRegister('admin')}
            onBackHome={() => navigateToHome()}
          />
        )}

        {currentPage === 'about-us' && <AboutUsPage />}

        {currentPage === 'contact-us' && (
          <ContactUsPage onBackHome={() => navigateToHome()} />
        )}

        {currentPage === 'build-resume' && (
          <BuildResumePage
            candidate={candidate}
            onBackHome={() => navigateToHome()}
          />
        )}

        {currentPage === 'interview-tips' && (
          <InterviewTipsPage
            onBackHome={() => navigateToHome()}
            onGoToSearchJobs={handleNavigateSearchJobs}
            onGoToBuildResume={handleNavigateBuildResume}
          />
        )}

        {currentPage === 'job-seeker-terms' && (
          <JobSeekerTermsPage
            onBackHome={() => navigateToHome()}
            onGoToSearchJobs={handleNavigateSearchJobs}
            onGoToBuildResume={handleNavigateBuildResume}
          />
        )}

        {currentPage === 'congratulations' && (
          <CongratulationsPage
            context={congratulationsContext}
            onBackHome={() => navigateToHome()}
            onSearchJobs={handleNavigateSearchJobs}
            onGoToDashboard={
              candidate ? () => handleNavigateRoleDashboard() : undefined
            }
          />
        )}

        {currentPage === 'vcs-insights' && (
          <VcsInsightsPage
            candidate={candidate}
            posts={insightsPosts}
            isLoading={isLoadingInsights}
            onCreatePost={handleCreateInsight}
            onUpdatePost={handleUpdateInsight}
            onDeletePost={handleDeleteInsight}
            onToggleLike={handleToggleInsightLike}
            onAddComment={handleAddInsightComment}
            onDeleteComment={handleDeleteInsightComment}
            onBackHome={() => navigateToHome()}
            onNavigateSearchJobs={handleNavigateSearchJobs}
            onGoToLogin={() => handleNavigateLogin('candidate')}
            onGoToRegister={() => handleNavigateRegister('candidate')}
          />
        )}
      </main>

      <Footer
        onNavigateHome={() => navigateToHome()}
        onNavigateAbout={handleNavigateAbout}
        onNavigateSearchJobs={handleNavigateSearchJobs}
        onNavigateVcsInsights={handleNavigateVcsInsights}
        onNavigateBuildResume={handleNavigateBuildResume}
        onNavigateInterviewTips={handleNavigateInterviewTips}
        onNavigateJobSeekerTerms={handleNavigateJobSeekerTerms}
        onNavigateContactUs={handleNavigateContactUs}
        onSubmitResume={handleUploadResumeAction}
      />

      <OfflineBanner />

      <ApplyJobModal
        isOpen={applyModalState.isOpen}
        mode={applyModalState.mode}
        job={applyModalState.job}
        candidate={candidate}
        onClose={() =>
          setApplyModalState((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        onApplicationSubmitted={handleApplicationSubmitted}
        onGoToDashboard={() => {
          setApplyModalState((prev) => ({ ...prev, isOpen: false }));
          navigateToHashPage('dashboard', '#dashboard');
        }}
        onViewFullTerms={() => {
          setApplyModalState((prev) => ({ ...prev, isOpen: false }));
          handleNavigateJobSeekerTerms();
        }}
      />

      <JobAlertsModal
        isOpen={isJobAlertsOpen}
        onClose={() => setIsJobAlertsOpen(false)}
        candidate={candidate}
      />

      <SkillTestModal
        isOpen={skillTestModalState.isOpen}
        initialTopic={skillTestModalState.initialTopic}
        candidate={candidate}
        onClose={() => setSkillTestModalState({ isOpen: false, initialTopic: '' })}
        onCandidateUpdated={setCandidate}
      />

      <PortalActionModal
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
