import { useState } from 'react';
import {
  Briefcase,
  LayoutDashboard,
  Layers,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  ShieldCheck,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { CandidateProfile, PortalModalType, PortalPageView } from '../types/portal';

interface HeaderProps {
  currentPage?: PortalPageView;
  candidate: CandidateProfile | null;
  onNavigateHome: () => void;
  onNavigateJobs: () => void;
  onNavigateAbout?: () => void;
  onNavigateServices: () => void;
  onNavigateSearchJobs: () => void;
  onNavigateVcsInsights: () => void;
  onNavigateBuildResume: () => void;
  onNavigateInterviewTips: () => void;
  onNavigateJobSeekerTerms: () => void;
  onNavigateMyResume: () => void;
  onNavigateMyApplications: () => void;
  onNavigateRegister: () => void;
  onNavigateLogin: () => void;
  onNavigateEmployerLogin: () => void;
  onNavigateDashboard: () => void;
  onUploadResumeAction: () => void;
  onApplyNowNavAction: () => void;
  onPostJobAction: () => void;
  onNavigateContactUs: () => void;
  onLogout: () => void;
  onOpenModal: (modal: PortalModalType) => void;
}

export const LOGO_SRC = '/assets/aistudio/IMG-20261121-WA1566_67b18474.jpg';
export const PORTAL_BRAND_LOGO_SRC = '/assets/aistudio/IMG-20261121-WA1566_67b18474.jpg';

export function Header({
  currentPage = 'home',
  candidate,
  onNavigateHome,
  onNavigateJobs,
  onNavigateAbout,
  onNavigateServices,
  onNavigateLogin,
  onNavigateEmployerLogin,
  onNavigateDashboard,
  onPostJobAction,
  onNavigateContactUs,
  onLogout,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const isEmployer = candidate?.role === 'employer';
  const isAdmin = candidate?.role === 'admin';
  const isJobSeekerLoggedIn = Boolean(candidate && !isEmployer && !isAdmin);

  const isDashboardActive =
    currentPage === 'dashboard' ||
    currentPage === 'employer-dashboard' ||
    currentPage === 'admin-dashboard';

  const handleMobileItemClick = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/98 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#062856] via-[#D4AF37] to-[#062856]" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 min-h-[82px] sm:min-h-[96px] lg:min-h-[104px] py-1.5">
          {/* Header Left: JobsNia.com Logo | Jobs | Services */}
          <div className="flex items-center gap-5 sm:gap-7 min-w-0">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                onNavigateHome();
              }}
              className="flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-lg"
              aria-label="JobsNia.com — By Vardhman Consultancy Services Home"
            >
              {!logoError ? (
                <img
                  src={PORTAL_BRAND_LOGO_SRC}
                  alt="JobsNia.com — Jobs With Purpose"
                  referrerPolicy="no-referrer"
                  decoding="sync"
                  onError={() => setLogoError(true)}
                  className="h-[72px] sm:h-[88px] lg:h-[96px] w-auto object-contain select-none"
                />
              ) : (
                <span className="font-display font-bold text-base sm:text-lg text-[#062856] whitespace-nowrap">
                  JobsNia.com
                </span>
              )}
            </a>

            <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={onNavigateJobs}
                className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-t-sm ${
                  currentPage === 'home' || currentPage === 'search-jobs' || currentPage === 'job-details'
                    ? 'text-[#062856] border-[#D4AF37]'
                    : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                }`}
              >
                Jobs
              </button>

              <button
                type="button"
                onClick={onNavigateAbout || onNavigateServices}
                className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-t-sm ${
                  currentPage === 'about-us'
                    ? 'text-[#062856] border-[#D4AF37]'
                    : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                }`}
              >
                About
              </button>

              <button
                type="button"
                onClick={onNavigateServices}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-[#062856] transition-colors whitespace-nowrap cursor-pointer border-b-2 border-transparent hover:border-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-t-sm"
              >
                Services
              </button>

              <button
                type="button"
                onClick={onNavigateContactUs}
                className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-t-sm ${
                  currentPage === 'contact-us'
                    ? 'text-[#062856] border-[#D4AF37]'
                    : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                }`}
              >
                Contact
              </button>

              {isJobSeekerLoggedIn && (
                <button
                  type="button"
                  onClick={onNavigateDashboard}
                  className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                    isDashboardActive
                      ? 'text-[#062856] border-[#D4AF37]'
                      : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                  }`}
                >
                  Dashboard
                </button>
              )}

              {isEmployer && (
                <>
                  <button
                    type="button"
                    onClick={onNavigateDashboard}
                    className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                      currentPage === 'employer-dashboard'
                        ? 'text-[#062856] border-[#D4AF37]'
                        : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={onPostJobAction}
                    className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                      currentPage === 'post-job'
                        ? 'text-[#062856] border-[#D4AF37]'
                        : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                    }`}
                  >
                    Post A Job
                  </button>
                </>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={onNavigateDashboard}
                  className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                    currentPage === 'admin-dashboard'
                      ? 'text-[#062856] border-[#D4AF37]'
                      : 'text-slate-600 hover:text-[#062856] border-transparent hover:border-[#D4AF37]'
                  }`}
                >
                  Admin Desk
                </button>
              )}
            </nav>
          </div>

          {/* Header Right: Candidate Login | Employer Login */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {candidate ? (
              <>
                <button
                  type="button"
                  onClick={onNavigateDashboard}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-[#062856] font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 max-w-[190px] cursor-pointer transition-colors"
                >
                  <User className="w-4 h-4 text-[#9A6F04] shrink-0" aria-hidden="true" />
                  <span className="truncate">{candidate.name}</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className="min-h-[40px] px-4 py-2 rounded-lg border border-[#062856] text-[#062856] hover:bg-[#062856] hover:text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
                >
                  Candidate Login
                </button>
                <button
                  type="button"
                  onClick={onNavigateEmployerLogin}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#062856] hover:bg-[#041C3F] text-[#F6D574] border border-[#062856] text-xs sm:text-sm font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  Employer Login
                </button>
              </>
            )}
          </div>

          {/* Mobile / Tablet Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 text-[#062856] hover:bg-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white shadow-xl">
          <nav aria-label="Mobile Navigation" className="max-w-7xl mx-auto px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMobileItemClick(onNavigateJobs)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[#062856] font-semibold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                <span>Jobs</span>
              </button>

              <button
                type="button"
                onClick={() => handleMobileItemClick(onNavigateAbout || onNavigateServices)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[#062856] font-semibold text-sm flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                <span>About</span>
              </button>

              <button
                type="button"
                onClick={() => handleMobileItemClick(onNavigateServices)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[#062856] font-semibold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                <span>Services</span>
              </button>

              <button
                type="button"
                onClick={() => handleMobileItemClick(onNavigateContactUs)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[#062856] font-semibold text-sm flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                <span>Contact</span>
              </button>
            </div>

            {candidate && (
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleMobileItemClick(onNavigateDashboard)}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#062856]/6 text-[#062856] font-semibold text-sm flex items-center gap-2 cursor-pointer"
                >
                  {isAdmin ? (
                    <UserCheck className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                  ) : (
                    <LayoutDashboard className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                  )}
                  <span>{isAdmin ? 'Admin Desk' : isEmployer ? 'Employer Dashboard' : 'Dashboard'}</span>
                </button>
                {isEmployer && (
                  <button
                    type="button"
                    onClick={() => handleMobileItemClick(onPostJobAction)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-slate-50 text-[#062856] font-semibold text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                    <span>Post A Job</span>
                  </button>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5">
              {candidate ? (
                <>
                  <div className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[#062856] font-semibold text-sm inline-flex items-center justify-center gap-1.5">
                    <User className="w-4 h-4 text-[#9A6F04] shrink-0" aria-hidden="true" />
                    <span className="truncate">{candidate.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMobileItemClick(onLogout)}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-[#062856] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleMobileItemClick(onNavigateLogin)}
                    className="min-h-[44px] px-3 py-2.5 rounded-lg border border-[#062856] text-[#062856] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Candidate Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileItemClick(onNavigateEmployerLogin)}
                    className="min-h-[44px] px-3 py-2.5 rounded-lg bg-[#062856] text-[#F6D574] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Employer Login</span>
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
