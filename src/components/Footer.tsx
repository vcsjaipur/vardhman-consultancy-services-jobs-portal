import { useState } from 'react';
import { ExternalLink, FileUp, Linkedin, Mail, MessageCircle, Radio } from 'lucide-react';
import {
  FOOTER_SOCIAL_LINKS,
  OFFICIAL_EMAIL,
  OFFICIAL_PHONE_DISPLAY,
} from '../utils/jobHelpers';
import { LOGO_SRC } from './Header';

interface FooterProps {
  onNavigateHome: () => void;
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

  const secondaryLinks = [
    { label: 'Search Jobs', action: onNavigateSearchJobs },
    { label: 'VCS Insights', action: onNavigateVcsInsights },
    { label: 'Build Resume', action: onNavigateBuildResume },
    { label: 'Interview Tips', action: onNavigateInterviewTips },
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
              className="inline-flex items-center bg-white rounded-xl px-3 py-1.5 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              {!logoError ? (
                <img
                  src={LOGO_SRC}
                  alt="Vardhman Consultancy Services"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <span className="font-display font-bold text-base text-[#062856]">
                  Vardhman Consultancy Services
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

          {/* Clickable Social & WhatsApp Links */}
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

            <a
              href={FOOTER_SOCIAL_LINKS.whatsappChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Radio className="w-4 h-4 text-[#F6D574] shrink-0" aria-hidden="true" />
              <span>WhatsApp Channel</span>
              <ExternalLink className="w-3 h-3 text-slate-400" aria-hidden="true" />
            </a>

            <a
              href={FOOTER_SOCIAL_LINKS.whatsappChat}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/50 text-xs sm:text-sm font-semibold text-[#F6D574] inline-flex items-center gap-2 transition-colors whitespace-nowrap tabular-nums"
            >
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>WhatsApp Chat ({OFFICIAL_PHONE_DISPLAY})</span>
            </a>
          </div>
        </div>

        {/* Compact Secondary Portal Links + Copyright */}
        <div className="pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {secondaryLinks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="text-slate-300 hover:text-[#F6D574] font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="text-slate-400 whitespace-nowrap">
            © {currentYear} Vardhman Consultancy Services
          </p>
        </div>
      </div>
    </footer>
  );
}
