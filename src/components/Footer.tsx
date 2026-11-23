import { useState } from 'react';
import { ExternalLink, FileUp, Linkedin, Mail } from 'lucide-react';
import {
  FOOTER_SOCIAL_LINKS,
  OFFICIAL_EMAIL,
} from '../utils/jobHelpers';
import { PORTAL_BRAND_LOGO_SRC } from './Header';

interface FooterProps {
  onNavigateHome: () => void;
  onNavigateAbout?: () => void;
  onNavigateSearchJobs: () => void;
  onNavigateVcsInsights: () => void;
  onNavigateBuildResume: () => void;
  onNavigateInterviewTips: () => void;
  onNavigateJobSeekerTerms: () => void;
  onNavigateContactUs: () => void;
  onSubmitResume?: () => void;
}

export function Footer({
  onNavigateHome,
  onNavigateAbout,
  onNavigateSearchJobs,
  onNavigateVcsInsights,
  onNavigateBuildResume,
  onNavigateInterviewTips,
  onNavigateJobSeekerTerms,
  onNavigateContactUs,
  onSubmitResume,
}: FooterProps) {
  const [logoError, setLogoError] = useState(false);
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: 'Home', action: onNavigateHome },
    { label: 'Jobs', action: onNavigateSearchJobs },
    { label: 'About Us', action: onNavigateAbout || onNavigateHome },
    { label: 'Build Resume', action: onNavigateBuildResume },
    { label: 'Interview Tips', action: onNavigateInterviewTips },
    { label: 'VCS Insights', action: onNavigateVcsInsights },
    { label: 'Terms & Conditions', action: onNavigateJobSeekerTerms },
    { label: 'Contact Us', action: onNavigateContactUs },
  ];

  return (
    <footer className="bg-[#041C3F] text-slate-200 border-t-2 border-[#D4AF37]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-white/12">
          {/* Brand + Core CTA: Submit Resume | info@vardhmanconsultancy.com */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome();
              }}
              className="inline-flex items-center bg-white rounded-xl px-3.5 py-2 shadow-sm w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              {!logoError ? (
                <img
                  src={PORTAL_BRAND_LOGO_SRC}
                  alt="JobsNia.com — Jobs With Purpose"
                  referrerPolicy="no-referrer"
                  decoding="sync"
                  onError={() => setLogoError(true)}
                  className="h-20 sm:h-24 w-auto object-contain select-none"
                />
              ) : (
                <span className="font-display font-bold text-base text-[#062856]">
                  JobsNia.com
                </span>
              )}
            </a>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onSubmitResume || onNavigateBuildResume}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Submit Resume</span>
              </button>

              <a
                href={`mailto:${OFFICIAL_EMAIL}`}
                className="min-h-[42px] px-3.5 py-2 rounded-lg border border-white/20 hover:border-[#D4AF37] text-white hover:text-[#F6D574] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" aria-hidden="true" />
                <span>{OFFICIAL_EMAIL}</span>
              </a>
            </div>
          </div>

          {/* Clickable Social Link */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <a
              href={FOOTER_SOCIAL_LINKS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Linkedin className="w-4 h-4 text-[#F6D574] shrink-0" aria-hidden="true" />
              <span>LinkedIn</span>
              <ExternalLink className="w-3 h-3 text-slate-400" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* About, Quick Links & Contact Structured Columns */}
        <div className="py-8 grid grid-cols-1 md:grid-cols-12 gap-8 border-b border-white/12 text-xs sm:text-sm">
          <div className="md:col-span-5 space-y-2.5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#F6D574]">
              About JobsNia.com
            </h2>
            <p className="text-slate-300 leading-relaxed max-w-md">
              JobsNia.com is a venture of Vardhman Consultancy Services (VCS) - a professionally managed recruitment &amp; placement consultant from Jaipur, Rajasthan. Founded in 2012, headed by Mr. Vikas Jain. We help you find the Right People for the Right Jobs on the Right Time. Whatever we do, we do 100%
            </p>
            <p className="text-slate-300 leading-relaxed flex flex-col items-start gap-1">
              <a
                href="https://www.jobsnia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-[#F6D574] font-semibold underline underline-offset-2 transition-colors"
              >
                www.jobsnia.com
              </a>
              <a
                href="https://www.vardhmanconsultancy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-[#F6D574] font-semibold underline underline-offset-2 transition-colors"
              >
                www.vardhmanconsultancy.com
              </a>
            </p>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#F6D574]">
              Quick Links
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {quickLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="text-left text-slate-300 hover:text-[#F6D574] font-medium transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#F6D574]">
              Contact Desk
            </h2>
            <p className="text-slate-300">
              Official Email:{' '}
              <a
                href={`mailto:${OFFICIAL_EMAIL}`}
                className="text-white hover:text-[#F6D574] font-semibold underline-offset-2 hover:underline"
              >
                {OFFICIAL_EMAIL}
              </a>
            </p>
            <p className="text-slate-300">
              All inquiries, applications &amp; hiring mandates are processed securely through the portal.
            </p>
            <button
              type="button"
              onClick={onNavigateContactUs}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#F6D574] hover:underline cursor-pointer"
            >
              <span>Open Inquiry Form</span>
            </button>
          </div>
        </div>

        {/* Copyright Row */}
        <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <p>
            © {currentYear} JobsNia.com · A Venture of Vardhman Consultancy Services. All Rights Reserved.
          </p>
          <p className="text-slate-400">
            100% Free Placement Services for Every Candidate · Jaipur, India
          </p>
        </div>
      </div>
    </footer>
  );
}
