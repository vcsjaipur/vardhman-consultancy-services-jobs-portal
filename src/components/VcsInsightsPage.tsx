import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Edit3,
  ImagePlus,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import {
  CandidateProfile,
  InsightCategory,
  InsightPost,
} from '../types/portal';
import { readImageFileAsBase64, SaveInsightPostPayload } from '../utils/candidateApi';
import { LOGO_SRC } from './Header';
import { InsightsPostSkeleton } from './SkeletonLoaders';
import { SocialShareMenu } from './SocialShareMenu';

interface VcsInsightsPageProps {
  candidate: CandidateProfile | null;
  posts: InsightPost[];
  isLoading: boolean;
  onCreatePost: (payload: SaveInsightPostPayload) => Promise<void>;
  onUpdatePost: (postId: string, payload: SaveInsightPostPayload) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onToggleLike: (postId: string) => Promise<void>;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  onBackHome: () => void;
  onNavigateSearchJobs: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
}

const COVER_BANNER_SRC = '/src/assets/images/vcs_insights_cover_1794811322748.jpg';

const CATEGORIES: InsightCategory[] = [
  'Official Update',
  'Industry Insights',
  'Career Guidance',
  'Verified Opportunities',
];

type FilterTab = 'All Updates' | InsightCategory;

const FILTER_TABS: FilterTab[] = [
  'All Updates',
  'Official Update',
  'Industry Insights',
  'Career Guidance',
  'Verified Opportunities',
];

function formatPostTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (diffMinutes < 1) return `Just now · ${formattedDate}`;
  if (diffMinutes < 60) return `${diffMinutes}m ago · ${formattedDate}`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago · ${formattedDate}`;
  return formattedDate;
}

export function VcsInsightsPage({
  candidate,
  posts,
  isLoading,
  onCreatePost,
  onUpdatePost,
  onDeletePost,
  onToggleLike,
  onAddComment,
  onDeleteComment,
  onBackHome,
  onNavigateSearchJobs,
  onGoToLogin,
  onGoToRegister,
}: VcsInsightsPageProps) {
  const isAdmin = candidate?.role === 'admin';

  const [coverError, setCoverError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FilterTab>('All Updates');

  // Admin Create Post State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<InsightCategory>('Official Update');
  const [newDescription, setNewDescription] = useState('');
  const [newHashtags, setNewHashtags] = useState('');
  const [newCtaLabel, setNewCtaLabel] = useState('');
  const [newImageBase64, setNewImageBase64] = useState('');
  const [newImageName, setNewImageName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);

  // Admin Edit Post State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<InsightCategory>('Official Update');
  const [editDescription, setEditDescription] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editCtaLabel, setEditCtaLabel] = useState('');
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageBase64, setEditImageBase64] = useState('');
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Admin Delete Confirm State
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Engagement States (Likes, Comments, Share)
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [brokenPostImages, setBrokenPostImages] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null);
  const [deletingCommentKey, setDeletingCommentKey] = useState<string | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const displayedPosts =
    activeCategory === 'All Updates'
      ? posts
      : posts.filter((post) => post.category === activeCategory);

  const handleCreateImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    setCreateError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const read = await readImageFileAsBase64(file);
      setNewImageBase64(read.base64);
      setNewImageName(read.fileName);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to load selected image.');
    }
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (newTitle.trim().length < 3) {
      setCreateError('Please enter a post title (at least 3 characters).');
      return;
    }
    if (newDescription.trim().length < 10) {
      setCreateError('Please enter a clear, formal description (at least 10 characters).');
      return;
    }

    setIsCreating(true);
    try {
      const parsedTags = newHashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      await onCreatePost({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        hashtags: parsedTags,
        ctaLabel: newCtaLabel.trim() || null,
        imageBase64: newImageBase64 || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewCategory('Official Update');
      setNewHashtags('');
      setNewCtaLabel('');
      setNewImageBase64('');
      setNewImageName('');
      if (createFileInputRef.current) {
        createFileInputRef.current.value = '';
      }
      setIsComposerOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to publish update.');
    } finally {
      setIsCreating(false);
    }
  };

  const startEditingPost = (post: InsightPost) => {
    setEditingPostId(post.id);
    setEditTitle(post.title);
    setEditCategory(post.category);
    setEditDescription(post.description);
    setEditHashtags((post.hashtags || []).join(' '));
    setEditCtaLabel(post.ctaLabel || '');
    setEditImagePreview(post.imageUrl);
    setEditImageBase64('');
    setEditRemoveImage(false);
    setEditError('');
    setConfirmDeletePostId(null);
  };

  const handleEditImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    setEditError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const read = await readImageFileAsBase64(file);
      setEditImageBase64(read.base64);
      setEditImagePreview(read.base64);
      setEditRemoveImage(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to load selected image.');
    }
  };

  const handleSaveEdit = async (e: FormEvent, postId: string) => {
    e.preventDefault();
    setEditError('');

    if (editTitle.trim().length < 3) {
      setEditError('Please enter a post title (at least 3 characters).');
      return;
    }
    if (editDescription.trim().length < 10) {
      setEditError('Please enter a clear post description (at least 10 characters).');
      return;
    }

    setIsSavingEdit(true);
    try {
      const parsedTags = editHashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      await onUpdatePost(postId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        hashtags: parsedTags,
        ctaLabel: editCtaLabel.trim() || null,
        imageBase64: editImageBase64 || undefined,
        removeImage: editRemoveImage,
      });
      setEditingPostId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save post changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      await onDeletePost(postId);
      setConfirmDeletePostId(null);
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleLikeClick = async (postId: string) => {
    if (likingPostId === postId) return;
    setLikingPostId(postId);
    try {
      await onToggleLike(postId);
    } finally {
      setLikingPostId(null);
    }
  };

  const handleCommentButtonClick = (postId: string) => {
    const input = commentInputRefs.current[postId];
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCommentSubmit = async (e: FormEvent, postId: string) => {
    e.preventDefault();
    const content = (commentDrafts[postId] || '').trim();
    if (!content) {
      setCommentErrors((prev) => ({
        ...prev,
        [postId]: 'Please enter your comment before posting.',
      }));
      return;
    }

    setCommentErrors((prev) => ({ ...prev, [postId]: '' }));
    setSubmittingCommentPostId(postId);
    try {
      await onAddComment(postId, content);
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      setCommentErrors((prev) => ({
        ...prev,
        [postId]: err instanceof Error ? err.message : 'Unable to post comment.',
      }));
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  const handleDeleteCommentClick = async (postId: string, commentId: string) => {
    const key = `${postId}:${commentId}`;
    setDeletingCommentKey(key);
    try {
      await onDeleteComment(postId, commentId);
    } finally {
      setDeletingCommentKey(null);
    }
  };

  return (
    <div className="bg-[#F3F6FA] min-h-[calc(100vh-5rem)] border-b border-slate-200 pb-14">
      {/* Subtle Brand Accent Top Line */}
      <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
        <div className="bg-[#063B7A]" />
        <div className="bg-[#F58220]" />
        <div className="bg-[#0A8E43]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Back Home Link */}
        <div>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-[#063B7A] hover:border-[#063B7A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>
        </div>

        {/* LinkedIn Company Page Style Header Card */}
        <section
          aria-label="VCS Insights Header"
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
        >
          {/* Corporate Cover Banner */}
          <div className="relative h-36 sm:h-48 lg:h-52 w-full bg-gradient-to-r from-[#063B7A] via-[#084A96] to-[#042A58]">
            {!coverError ? (
              <img
                src={COVER_BANNER_SRC}
                alt="Vardhman Consultancy Services Corporate Advisory"
                referrerPolicy="no-referrer"
                onError={() => setCoverError(true)}
                className="w-full h-full object-cover"
              />
            ) : null}
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#042147]/70 via-[#063B7A]/20 to-transparent"
              aria-hidden="true"
            />
          </div>

          <div className="px-5 sm:px-8 pb-5">
            {/* Logo Overlap + Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 relative z-10">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-200 shadow-md p-2 flex items-center justify-center shrink-0">
                {!logoError ? (
                  <img
                    src={LOGO_SRC}
                    alt="Vardhman Consultancy Services"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="font-display font-extrabold text-xl text-[#063B7A]">
                    VCS
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1 sm:pt-0">
                {candidate?.role !== 'employer' && (
                  <button
                    type="button"
                    onClick={onNavigateSearchJobs}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-[#063B7A]/30 bg-white hover:bg-[#063B7A]/5 text-[#063B7A] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4" aria-hidden="true" />
                    <span>Explore Verified Jobs</span>
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen((prev) => !prev)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] hover:from-[#042A58] hover:to-[#031F42] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>{isComposerOpen ? 'Close Post Form' : 'New Official Post'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Company Page Title & Subtitle */}
            <div className="mt-4">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#063B7A] tracking-tight">
                VCS Insights
              </h1>
              <p className="mt-1 text-base sm:text-lg font-semibold text-slate-800">
                Official Updates from Vardhman Consultancy Services
              </p>
              <p className="mt-1 text-sm sm:text-base text-slate-600 max-w-2xl">
                Industry Insights, Career Guidance, and Verified Opportunities.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-500">
                <span className="font-semibold text-[#0A8E43]">
                  Vardhman Consultancy Services
                </span>
                <span aria-hidden="true">·</span>
                <span>Est. 2012</span>
                <span aria-hidden="true">·</span>
                <span>Executive Search &amp; Career Advisory</span>
                <span aria-hidden="true">·</span>
                <a
                  href="mailto:info@vardhmanconsultancy.com"
                  className="text-[#063B7A] hover:text-[#D96B0C] font-medium text-[13px] whitespace-nowrap transition-colors"
                >
                  info@vardhmanconsultancy.com
                </a>
              </div>
            </div>

            {/* LinkedIn-Style Underline Tabs */}
            <div
              role="tablist"
              aria-label="Filter VCS Insights by category"
              className="mt-6 pt-1 border-t border-slate-200 flex items-center gap-1 sm:gap-2 overflow-x-auto"
            >
              {FILTER_TABS.map((tab) => {
                const isActive = activeCategory === tab;
                const count =
                  tab === 'All Updates'
                    ? posts.length
                    : posts.filter((p) => p.category === tab).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(tab)}
                    className={`min-h-[42px] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      isActive
                        ? 'border-[#0A8E43] text-[#0A8E43]'
                        : 'border-transparent text-slate-600 hover:text-[#063B7A]'
                    }`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Main 2-Column LinkedIn Company Feed Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Company Overview Sidebar */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#063B7A] shrink-0" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#063B7A]">
                  About This Official Feed
                </h2>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Serving since 2012, Vardhman Consultancy Services shares authentic hiring market perspectives, interview preparation notes, and verified leadership mandates across Healthcare, Pharmaceuticals, Manufacturing, IT, and Corporate functions.
              </p>

              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm text-slate-600">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0A8E43] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-slate-800">Verified Editorial Standard:</span>{' '}
                    Only the VCS Admin &amp; Recruitment Team publishes official posts.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-[#063B7A] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-slate-800">Open Reading, Member Comments:</span>{' '}
                    All visitors can read updates openly; logged-in users may participate in discussions.
                  </span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Official Correspondence</p>
                <a
                  href="mailto:info@vardhmanconsultancy.com"
                  className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap font-semibold text-[#063B7A] hover:text-[#D96B0C] transition-colors"
                >
                  <Mail className="w-4 h-4 text-[#F58220] shrink-0" aria-hidden="true" />
                  <span>info@vardhmanconsultancy.com</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Right Feed Column */}
          <div className="lg:col-span-8 space-y-5 min-w-0">
            {/* Admin-Only Composer Trigger / Form */}
            {isAdmin && (
              <section
                aria-label="Admin Post Composer"
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs"
              >
                {!isComposerOpen ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 p-1.5 flex items-center justify-center shrink-0">
                        {!logoError ? (
                          <img
                            src={LOGO_SRC}
                            alt="VCS Admin"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="font-display font-bold text-sm text-[#063B7A]">VCS</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#063B7A]">
                          Publish an Official Update
                        </p>
                        <p className="text-xs text-slate-500">
                          Signed in as VCS Admin ({candidate?.name})
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsComposerOpen(true)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Create Official Post</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateSubmit} className="space-y-4">
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[#063B7A]">
                          Create Official VCS Insight
                        </h2>
                        <p className="text-xs text-slate-500">
                          Posts appear immediately at the top of VCS Insights for all visitors.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsComposerOpen(false)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Close composer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {createError && (
                      <p
                        className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
                        role="alert"
                      >
                        {createError}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="insight-new-title"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Post Title
                        </label>
                        <input
                          id="insight-new-title"
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g., Pharmaceutical Regulatory Hiring Outlook 2026"
                          className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="insight-new-category"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Category
                        </label>
                        <select
                          id="insight-new-category"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as InsightCategory)}
                          className="w-full min-h-[44px] px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="insight-new-desc"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Post Description
                      </label>
                      <textarea
                        id="insight-new-desc"
                        rows={4}
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Write clear, formal industry insights, career guidance, or verified opportunity announcements..."
                        className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="insight-new-hashtags"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Hashtags (Optional)
                        </label>
                        <input
                          id="insight-new-hashtags"
                          type="text"
                          value={newHashtags}
                          onChange={(e) => setNewHashtags(e.target.value)}
                          placeholder="#VardhmanConsultancy #TrustedSince2012"
                          className="w-full min-h-[42px] px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="insight-new-cta"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Action Button Label (Optional)
                        </label>
                        <input
                          id="insight-new-cta"
                          type="text"
                          value={newCtaLabel}
                          onChange={(e) => setNewCtaLabel(e.target.value)}
                          placeholder="e.g., Explore Verified Jobs"
                          className="w-full min-h-[42px] px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Post Image (Optional — PNG, JPG, WebP, or GIF up to 5 MB)
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={createFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleCreateImageSelect}
                          className="hidden"
                          id="insight-new-image"
                        />
                        <label
                          htmlFor="insight-new-image"
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:border-[#063B7A] text-xs sm:text-sm font-semibold text-[#063B7A] inline-flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <ImagePlus className="w-4 h-4" aria-hidden="true" />
                          <span>{newImageName ? 'Change Image' : 'Attach High-Quality Image'}</span>
                        </label>
                        {newImageName && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewImageBase64('');
                              setNewImageName('');
                              if (createFileInputRef.current) {
                                createFileInputRef.current.value = '';
                              }
                            }}
                            className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                          >
                            Remove ({newImageName})
                          </button>
                        )}
                      </div>

                      {newImageBase64 && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 max-h-60 bg-slate-50">
                          <img
                            src={newImageBase64}
                            alt="Selected post preview"
                            className="w-full max-h-60 object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsComposerOpen(false)}
                        className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreating}
                        className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] hover:from-[#042A58] hover:to-[#031F42] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                        <span>{isCreating ? 'Publishing...' : 'Publish Post'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {/* Posts Feed List / Empty State */}
            {isLoading ? (
              <InsightsPostSkeleton count={2} />
            ) : displayedPosts.length === 0 ? (
              <section
                aria-label="No Official Updates Yet"
                className="bg-white border border-slate-200 rounded-2xl px-6 py-14 text-center shadow-xs"
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-50 border border-slate-200 text-[#063B7A] flex items-center justify-center">
                  <Building2 className="w-6 h-6" aria-hidden="true" />
                </div>

                <h2 className="mt-4 font-display text-lg sm:text-xl font-bold text-[#063B7A]">
                  {activeCategory === 'All Updates'
                    ? 'No Official Updates Published Yet'
                    : `No Updates in ${activeCategory}`}
                </h2>

                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  {activeCategory === 'All Updates'
                    ? 'Industry insights, career guidance, and verified opportunities published by the Vardhman Consultancy Services team will appear here.'
                    : 'No official updates have been posted under this category yet. View all updates or explore verified job openings.'}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {activeCategory !== 'All Updates' && (
                    <button
                      type="button"
                      onClick={() => setActiveCategory('All Updates')}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-[#063B7A] text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      View All Updates
                    </button>
                  )}
                  {candidate?.role !== 'employer' && (
                    <button
                      type="button"
                      onClick={onNavigateSearchJobs}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4" aria-hidden="true" />
                      <span>Explore Verified Jobs</span>
                    </button>
                  )}
                  {isAdmin && !isComposerOpen && (
                    <button
                      type="button"
                      onClick={() => setIsComposerOpen(true)}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Publish First Update</span>
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <div className="space-y-5">
                {displayedPosts.map((post) => {
                  const isEditing = editingPostId === post.id;
                  const isConfirmingDelete = confirmDeletePostId === post.id;
                  const imageFailed = brokenPostImages[post.id];
                  const commentDraft = commentDrafts[post.id] || '';
                  const commentError = commentErrors[post.id] || '';

                  return (
                    <article
                      key={post.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
                    >
                      {/* Post Author Identity Row */}
                      <div className="p-5 sm:p-6 pb-0 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border border-slate-200 bg-white p-1.5 flex items-center justify-center shrink-0">
                            {!logoError ? (
                              <img
                                src={LOGO_SRC}
                                alt="Vardhman Consultancy Services"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="font-display font-bold text-xs text-[#063B7A]">
                                VCS
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-display text-sm sm:text-base font-bold text-[#063B7A] truncate">
                              Vardhman Consultancy Services
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span className="font-medium text-slate-600">Est. 2012</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {formatPostTimestamp(post.createdAt)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-[#0A8E43]">{post.category}</span>
                              {post.updatedAt && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Edited</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Admin-Only Edit / Delete Controls */}
                        {isAdmin && !isEditing && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={deletingPostId === post.id}
                                  onClick={() => handleConfirmDeletePost(post.id)}
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                                >
                                  {deletingPostId === post.id ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePostId(null)}
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditingPost(post)}
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#063B7A] hover:bg-slate-100 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  aria-label={`Edit post ${post.title}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span className="hidden sm:inline">Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePostId(post.id)}
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  aria-label={`Delete post ${post.title}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span className="hidden sm:inline">Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inline Admin Edit Mode OR Published Post Body */}
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveEdit(e, post.id)}
                          className="p-5 sm:p-6 space-y-4"
                        >
                          {editError && (
                            <p
                              className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
                              role="alert"
                            >
                              {editError}
                            </p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Post Title
                              </label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full min-h-[42px] px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Category
                              </label>
                              <select
                                value={editCategory}
                                onChange={(e) =>
                                  setEditCategory(e.target.value as InsightCategory)
                                }
                                className="w-full min-h-[42px] px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none cursor-pointer"
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Post Description
                            </label>
                            <textarea
                              rows={4}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none leading-relaxed"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Hashtags
                              </label>
                              <input
                                type="text"
                                value={editHashtags}
                                onChange={(e) => setEditHashtags(e.target.value)}
                                placeholder="#VardhmanConsultancy #VerifiedJobs"
                                className="w-full min-h-[40px] px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Action Button Label (Optional)
                              </label>
                              <input
                                type="text"
                                value={editCtaLabel}
                                onChange={(e) => setEditCtaLabel(e.target.value)}
                                placeholder="e.g., Explore Verified Jobs"
                                className="w-full min-h-[40px] px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                ref={editFileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={handleEditImageSelect}
                                className="hidden"
                                id={`edit-image-${post.id}`}
                              />
                              <label
                                htmlFor={`edit-image-${post.id}`}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#063B7A] hover:border-[#063B7A] inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                                <span>{editImagePreview ? 'Replace Image' : 'Add Image'}</span>
                              </label>

                              {editImagePreview && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditImagePreview(null);
                                    setEditImageBase64('');
                                    setEditRemoveImage(true);
                                  }}
                                  className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                                >
                                  Remove Image
                                </button>
                              )}
                            </div>

                            {editImagePreview && (
                              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-56 bg-slate-50">
                                <img
                                  src={editImagePreview}
                                  alt="Edited post preview"
                                  className="w-full max-h-56 object-cover"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingPostId(null)}
                              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingEdit}
                              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
                            >
                              {isSavingEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {/* Post Title, Formal Description, CTA & Hashtags */}
                          <div className="px-5 sm:px-6 pt-4 pb-4 space-y-3">
                            <h2 className="font-display text-lg sm:text-xl font-bold text-[#063B7A] leading-snug">
                              {post.title}
                            </h2>
                            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed whitespace-pre-line max-w-[75ch]">
                              {post.description}
                            </p>

                            {post.ctaLabel && candidate?.role !== 'employer' && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={onNavigateSearchJobs}
                                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Briefcase className="w-4 h-4" aria-hidden="true" />
                                  <span>{post.ctaLabel}</span>
                                </button>
                              </div>
                            )}

                            {post.hashtags && post.hashtags.length > 0 && (
                              <p className="text-xs sm:text-sm font-semibold text-[#063B7A] flex flex-wrap gap-x-2.5 gap-y-1 pt-0.5">
                                {post.hashtags.map((tag) => (
                                  <span key={tag}>{tag}</span>
                                ))}
                              </p>
                            )}
                          </div>

                          {/* Optional Post Image */}
                          {post.imageUrl && (
                            <div className="border-y border-slate-100 bg-slate-50">
                              {!imageFailed ? (
                                <img
                                  src={post.imageUrl}
                                  alt={post.title}
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setBrokenPostImages((prev) => ({
                                      ...prev,
                                      [post.id]: true,
                                    }))
                                  }
                                  className="w-full max-h-[460px] object-cover"
                                />
                              ) : (
                                <div className="py-10 px-6 text-center bg-gradient-to-br from-[#063B7A]/5 via-slate-50 to-[#0A8E43]/5">
                                  <Building2
                                    className="w-8 h-8 mx-auto text-[#063B7A]/50"
                                    aria-hidden="true"
                                  />
                                  <p className="mt-2 text-xs font-medium text-slate-500">
                                    {post.title}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Engagement Counts Row */}
                          <div className="px-5 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-500 tabular-nums">
                            <span>
                              {post.likesCount} {post.likesCount === 1 ? 'Like' : 'Likes'}
                            </span>
                            <span>
                              {post.comments.length}{' '}
                              {post.comments.length === 1 ? 'Comment' : 'Comments'}
                            </span>
                          </div>

                          {/* Like, Comment, Share Buttons Bar */}
                          <div className="px-3 sm:px-4 py-1.5 border-t border-slate-100 grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              disabled={likingPostId === post.id}
                              onClick={() => handleLikeClick(post.id)}
                              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                                post.likedByViewer
                                  ? 'text-[#063B7A] bg-[#063B7A]/8'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#063B7A]'
                              }`}
                            >
                              <ThumbsUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>{post.likedByViewer ? 'Liked' : 'Like'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCommentButtonClick(post.id)}
                              className="min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#063B7A] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>Comment</span>
                            </button>

                            <SocialShareMenu
                              variant="feed"
                              title={post.title}
                              text={`${post.title} — Official Update by Vardhman Consultancy Services (Est. 2012)`}
                              url={`${window.location.origin}${window.location.pathname}#vcs-insights`}
                            />
                          </div>

                          {/* Comment Section (Visible to All; Commenting Allowed Only for Logged-In Users) */}
                          <div className="bg-slate-50/70 border-t border-slate-200/80 px-5 sm:px-6 py-4 space-y-4">
                            {post.comments.length > 0 ? (
                              <ul className="space-y-3" aria-label="Comments">
                                {post.comments.map((comment) => {
                                  const commentKey = `${post.id}:${comment.id}`;
                                  return (
                                    <li
                                      key={comment.id}
                                      className="bg-white border border-slate-200/80 rounded-xl px-4 py-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-xs sm:text-sm font-bold text-[#063B7A]">
                                            {comment.authorName}{' '}
                                            <span className="font-medium text-slate-500">
                                              ·{' '}
                                              {comment.authorRole === 'admin'
                                                ? 'VCS Team'
                                                : comment.authorRole === 'employer'
                                                  ? 'Employer'
                                                  : 'Member'}
                                            </span>
                                          </p>
                                          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                                            {formatPostTimestamp(comment.createdAt)}
                                          </p>
                                        </div>

                                        {isAdmin && (
                                          <button
                                            type="button"
                                            disabled={deletingCommentKey === commentKey}
                                            onClick={() =>
                                              handleDeleteCommentClick(post.id, comment.id)
                                            }
                                            className="min-h-[30px] px-2 py-1 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                                            aria-label={`Delete comment by ${comment.authorName}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>
                                              {deletingCommentKey === commentKey
                                                ? 'Removing...'
                                                : 'Delete'}
                                            </span>
                                          </button>
                                        )}
                                      </div>

                                      <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                        {comment.content}
                                      </p>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500">
                                No comments yet. Share a professional perspective or question below.
                              </p>
                            )}

                            {/* Comment Composer: Logged-In Users Only */}
                            {candidate ? (
                              <form
                                onSubmit={(e) => handleCommentSubmit(e, post.id)}
                                className="space-y-2"
                              >
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                  <input
                                    ref={(el) => {
                                      commentInputRefs.current[post.id] = el;
                                    }}
                                    type="text"
                                    value={commentDraft}
                                    onChange={(e) =>
                                      setCommentDrafts((prev) => ({
                                        ...prev,
                                        [post.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={`Comment as ${candidate.name}...`}
                                    aria-label={`Write a comment on ${post.title}`}
                                    className="flex-1 min-h-[42px] px-3.5 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                                  />
                                  <button
                                    type="submit"
                                    disabled={submittingCommentPostId === post.id}
                                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>
                                      {submittingCommentPostId === post.id
                                        ? 'Posting...'
                                        : 'Post Comment'}
                                    </span>
                                  </button>
                                </div>

                                {commentError && (
                                  <p className="text-xs font-medium text-red-600" role="alert">
                                    {commentError}
                                  </p>
                                )}
                              </form>
                            ) : (
                              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                                  <Lock
                                    className="w-4 h-4 text-[#063B7A] shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Only logged-in users can post comments. Sign in to join this discussion.
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={onGoToLogin}
                                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#063B7A] hover:bg-[#042A58] text-white text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Login
                                  </button>
                                  <button
                                    type="button"
                                    onClick={onGoToRegister}
                                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#063B7A]/30 text-[#063B7A] hover:bg-[#063B7A]/5 text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Register
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
