import {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { History, Loader2, Search, Sparkles, TrendingUp, X } from 'lucide-react';
import {
  JobListing,
  SearchHistoryItem,
  SearchSuggestionItem,
} from '../types/portal';
import { fetchAiSearchSuggestions } from '../utils/candidateApi';
import {
  buildSearchSuggestions,
  SuggestionFieldType,
} from '../utils/searchSuggestions';

interface SearchSuggestionInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  field: SuggestionFieldType;
  jobs: JobListing[];
  searchHistory?: SearchHistoryItem[];
  icon?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  inputClassName?: string;
  enableAiExpand?: boolean;
  onPressEnterWithoutSelection?: () => void;
}

export function SearchSuggestionInput({
  id,
  value,
  onChange,
  onSelectSuggestion,
  placeholder,
  ariaLabel,
  field,
  jobs,
  searchHistory = [],
  icon,
  inputRef,
  inputClassName = '',
  enableAiExpand = true,
  onPressEnterWithoutSelection,
}: SearchSuggestionInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const baseSuggestions = useMemo(
    () =>
      buildSearchSuggestions({
        query: value,
        field,
        jobs,
        searchHistory,
        maxItems: 7,
      }),
    [value, field, jobs, searchHistory]
  );

  const combinedSuggestions = useMemo<SearchSuggestionItem[]>(() => {
    const seen = new Set(baseSuggestions.map((s) => s.value.toLowerCase()));
    const aiItems: SearchSuggestionItem[] = [];
    for (const raw of aiSuggestions) {
      const clean = raw.trim();
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      aiItems.push({
        value: clean,
        label: clean,
        category: 'AI',
      });
    }
    return [...baseSuggestions, ...aiItems].slice(0, 10);
  }, [baseSuggestions, aiSuggestions]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value, isOpen]);

  useEffect(() => {
    setAiSuggestions([]);
    setAiError('');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const chooseOption = (chosenValue: string) => {
    onChange(chosenValue);
    if (onSelectSuggestion) {
      onSelectSuggestion(chosenValue);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      setHighlightedIndex(0);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        combinedSuggestions.length === 0
          ? -1
          : (prev + 1) % combinedSuggestions.length
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        combinedSuggestions.length === 0
          ? -1
          : prev <= 0
            ? combinedSuggestions.length - 1
            : prev - 1
      );
    } else if (e.key === 'Enter') {
      if (
        isOpen &&
        highlightedIndex >= 0 &&
        highlightedIndex < combinedSuggestions.length
      ) {
        e.preventDefault();
        chooseOption(combinedSuggestions[highlightedIndex].value);
      } else {
        setIsOpen(false);
        if (onPressEnterWithoutSelection) {
          onPressEnterWithoutSelection();
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleAiExpand = async () => {
    if (field === 'designation') return;
    const clean = value.trim();
    if (clean.length < 2 || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      const results = await fetchAiSearchSuggestions(clean, field);
      setAiSuggestions(results);
      setIsOpen(true);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to fetch AI suggestions.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const showClear = value.trim().length > 0;
  const canShowAiTrigger =
    enableAiExpand && field !== 'designation' && value.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        {icon}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && combinedSuggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
          }
          aria-label={ariaLabel}
          autoComplete="off"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
        />
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setIsOpen(true);
            }}
            aria-label="Clear search field"
            className="absolute right-2.5 w-6 h-6 rounded-md text-slate-400 hover:text-[#062856] hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && (combinedSuggestions.length > 0 || canShowAiTrigger) && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${field} search suggestions`}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {combinedSuggestions.map((item, idx) => {
              const active = idx === highlightedIndex;
              return (
                <button
                  key={`${item.category}:${item.value}`}
                  id={`${listboxId}-opt-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => chooseOption(item.value)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FBF4DC] text-[#062856]'
                      : 'bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {item.category === 'Recent' ? (
                      <History
                        className="w-3.5 h-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                    ) : item.category === 'AI' ? (
                      <Sparkles
                        className="w-3.5 h-3.5 text-[#9A6F04] shrink-0"
                        aria-hidden="true"
                      />
                    ) : item.category === 'Live Jobs' ? (
                      <TrendingUp
                        className="w-3.5 h-3.5 text-[#0A8E43] shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Search
                        className="w-3.5 h-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-medium truncate">{item.label}</span>
                  </span>

                  <span className="text-[11px] font-semibold text-slate-500 shrink-0 tabular-nums">
                    {item.category === 'AI'
                      ? 'AI Related'
                      : item.category === 'Recent'
                        ? 'Recent'
                        : item.matchCount && item.matchCount > 0
                          ? `${item.matchCount} ${item.matchCount === 1 ? 'opening' : 'openings'}`
                          : 'Popular'}
                  </span>
                </button>
              );
            })}
          </div>

          {canShowAiTrigger && (
            <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              {aiError ? (
                <span className="text-[11px] text-red-600 truncate">{aiError}</span>
              ) : (
                <span className="text-[11px] text-slate-500 truncate">
                  Need related role or city ideas?
                </span>
              )}
              <button
                type="button"
                disabled={aiLoading}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleAiExpand()}
                className="px-2.5 py-1 rounded-lg bg-[#062856] hover:bg-[#041C3F] disabled:opacity-60 text-[#F6D574] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {aiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                )}
                <span>{aiLoading ? 'Expanding...' : 'AI Suggest Related'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
