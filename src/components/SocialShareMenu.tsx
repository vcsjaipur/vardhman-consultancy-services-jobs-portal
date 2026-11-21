import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Share2, X } from 'lucide-react';

interface SocialShareMenuProps {
  title: string;
  text: string;
  url: string;
  variant?: 'icon' | 'button' | 'hero' | 'feed';
  className?: string;
}

export function SocialShareMenu({
  title,
  text,
  url,
  variant = 'icon',
  className = '',
}: SocialShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(title);

  const shareChannels = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
      badge: 'WA',
      color: 'text-[#0A8E43] bg-[#0A8E43]/10 hover:bg-[#0A8E43]/18',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      badge: 'in',
      color: 'text-[#0A66C2] bg-[#0A66C2]/10 hover:bg-[#0A66C2]/18',
    },
    {
      name: 'X / Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      badge: 'X',
      color: 'text-slate-800 bg-slate-100 hover:bg-slate-200',
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      badge: 'f',
      color: 'text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/18',
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      badge: 'TG',
      color: 'text-[#0088CC] bg-[#0088CC]/10 hover:bg-[#0088CC]/18',
    },
    {
      name: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
      badge: 'Mail',
      color: 'text-[#063B7A] bg-[#063B7A]/10 hover:bg-[#063B7A]/18',
    },
  ];

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      } else {
        const temp = document.createElement('textarea');
        temp.value = `${text}\n${url}`;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const renderTrigger = () => {
    if (variant === 'hero') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className={`min-h-[42px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer ${className}`}
        >
          <Share2 className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
          <span>Share Job</span>
        </button>
      );
    }

    if (variant === 'feed') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#063B7A] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${className}`}
        >
          <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Share</span>
        </button>
      );
    }

    if (variant === 'button') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#062856] text-xs font-semibold text-[#062856] inline-flex items-center gap-1.5 transition-colors cursor-pointer ${className}`}
        >
          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Share</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`Share ${title}`}
        title="Share on social media"
        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
          open
            ? 'bg-[#062856] border-[#062856] text-[#F6D574]'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[#062856] hover:border-[#062856]'
        } ${className}`}
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      {renderTrigger()}

      {open && (
        <div
          role="dialog"
          aria-label={`Share ${title}`}
          className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-40 text-left"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-[#062856]">Share via Social Media</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close share menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {shareChannels.map((ch) => (
              <a
                key={ch.name}
                href={ch.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors ${ch.color}`}
              >
                {ch.name === 'WhatsApp' ? (
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : ch.name === 'Email' ? (
                  <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-4 h-4 rounded text-[10px] font-extrabold bg-white/80 flex items-center justify-center shrink-0">
                    {ch.badge}
                  </span>
                )}
                <span className="truncate">{ch.name}</span>
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className={`mt-2 w-full min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              copied
                ? 'bg-[#0A8E43]/10 border-[#0A8E43]/30 text-[#0A8E43]'
                : 'bg-slate-50 border-slate-200 text-[#062856] hover:bg-slate-100'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy Direct Link</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
