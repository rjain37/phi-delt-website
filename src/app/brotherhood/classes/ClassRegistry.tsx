"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Radio, RadioGroup } from "@headlessui/react";
import { Plus, Star, X } from "lucide-react";
import { useSession } from "next-auth/react";
import useSWRInfinite from "swr/infinite";

type Column = { key: string; label: string };
type Entry = Record<string, string>;
type CourseCatalogPage = {
  columns: Column[];
  entries: Entry[];
  total: number;
  allTotal: number;
  hasMore: boolean;
  semesterOptions: string[];
};
type ReviewForm = {
  courseCode: string;
  courseName: string;
  semester: string;
  professor: string;
  professorQuality: string;
  courseQuality: string;
  difficulty: string;
  commitment: string;
  comments: string;
};

const initialReviewForm: ReviewForm = {
  courseCode: "",
  courseName: "",
  semester: "",
  professor: "",
  professorQuality: "",
  courseQuality: "",
  difficulty: "",
  commitment: "",
  comments: "",
};

const commitmentOptions = [
  "<2 hours per week",
  "2 to 5 hours per week",
  "5 to 8 hours per week",
  "8 to 12 hours per week",
  ">12 hours per week",
];
const PAGE_SIZE = 24;

/** Timestamp / email columns — hidden in the catalog UI. */
function isHiddenCatalogColumn(c: Column): boolean {
  const label = c.label.toLowerCase();
  const key = c.key.toLowerCase();
  if (
    /^timestamp$|^timestamp_|_timestamp$|time_stamp|date_submitted|submitted_at/.test(
      key
    ) ||
    /\btimestamp\b|time stamp|date submitted|submitted at/.test(label)
  ) {
    return true;
  }
  if (
    /^email$|_email$|^e_mail$|email_address/.test(key) ||
    /\be-?mail\b|email address/.test(label)
  ) {
    return true;
  }
  return false;
}

/** Remove parenthetical asides; keep only (...including lectures...) segments. */
function formatCatalogVisualText(text: string): string {
  if (!text) return "";
  const kept: string[] = [];
  let n = 0;
  const masked = text.replace(
    /\([^)]*including\s+lectures[^)]*\)/gi,
    (full) => {
      const token = `__PD_KEEP_${n++}__`;
      kept.push(full);
      return token;
    }
  );
  const stripped = masked.replace(/\([^)]*\)/g, "");
  let out = stripped;
  kept.forEach((frag, idx) => {
    out = out.replace(`__PD_KEEP_${idx}__`, frag);
  });
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Field labels: wording tweaks + catalog text cleanup. */
function formatFieldLabel(label: string): string {
  let t = formatCatalogVisualText(label);

  t = t.replace(/\byour\s+name\b/gi, "Brother name");

  t = t.replace(/\boverall\s+professor\s+quality\b/gi, "Professor Quality");

  t = t.replace(/\bprofessor\s+name\s*\?/gi, "Professor Name");

  t = t.replace(
    /\bhow\s+many\s+hours\s+of\s+commitment\s+per\s+week\s*\??\s*\([^)]*including\s+lectures[^)]*\)/gi,
    "Commitment Per Week (including Lectures)"
  );

  t = t.replace(/\bcomments?\s+about\s+(?:the\s+)?course\s*\?/gi, "comments");

  t = t.replace(/\s*\(\s*just\s+click\s+it\s*\)/gi, "");

  return t.replace(/\s{2,}/g, " ").trim();
}

/** Already shown in the navy header subline — omit from detail rows. */
function isSublineOnlyField(
  c: Column,
  semesterColumn: Column | undefined
): boolean {
  if (semesterColumn && c.key === semesterColumn.key) {
    return true;
  }
  const label = formatFieldLabel(c.label).toLowerCase().trim();
  if (label === "brother name") {
    return true;
  }
  if (/^(which|what)\s+semester\b/.test(label)) {
    return true;
  }
  return false;
}

function isProfessorColumn(c: Column): boolean {
  const L = c.label.toLowerCase();
  const k = c.key.toLowerCase();
  return (
    (/\bprofessor\b|\bprof\b|\binstructor\b/.test(L) &&
      !/\bquality\b/.test(L)) ||
    /professor|instructor|_prof\b/.test(k)
  );
}

/** Course / overall quality (not difficulty). */
function isQualityColumn(c: Column): boolean {
  if (isDifficultyColumn(c)) return false;
  const L = c.label.toLowerCase();
  const k = c.key.toLowerCase();
  return (
    /\bquality\b/.test(L) ||
    /\b(how good|overall|rating)\b/.test(L) ||
    /_quality$|^quality$|course_quality|overall_rating/.test(k)
  );
}

function isDifficultyColumn(c: Column): boolean {
  const L = c.label.toLowerCase();
  const k = c.key.toLowerCase();
  return (
    /\bdifficult/.test(L) ||
    /\bhow hard\b/.test(L) ||
    /difficulty|difficult/.test(k)
  );
}

/** Parse 1–5 style ratings from form values (digits, x/5, etc.). */
function parseStarCount(raw: string, maxStars = 5): number | null {
  const t = raw.trim();
  if (!t) return null;
  const direct = Number(t.replace(",", "."));
  if (Number.isFinite(direct) && direct >= 0) {
    if (direct <= maxStars) return Math.min(maxStars, Math.max(0, Math.round(direct)));
    if (direct <= 10 && maxStars === 5)
      return Math.min(5, Math.max(0, Math.round(direct / 2)));
    return Math.min(maxStars, Math.max(0, Math.round(direct)));
  }
  const frac = t.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (b > 0 && Number.isFinite(a))
      return Math.min(
        maxStars,
        Math.max(0, Math.round((a / b) * maxStars))
      );
  }
  const d = t.match(/\b([1-9]|10)\b/);
  if (d) return Math.min(maxStars, Math.max(0, parseInt(d[1], 10)));
  return null;
}

function StarRating({ raw }: { raw: string }) {
  const n = parseStarCount(raw, 5);
  if (n === null) {
    return (
      <span className="text-(--navy) text-sm whitespace-pre-wrap">
        {formatCatalogVisualText(raw)}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${n} out of 5 stars`}
      title={raw}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            i < n
              ? "h-4 w-4 shrink-0 fill-(--gold) text-(--gold)"
              : "h-4 w-4 shrink-0 fill-transparent text-[#cbd5e1]"
          }
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

type DetailSegment =
  | { kind: "professor-quality"; professor: Column; quality: Column }
  | { kind: "single"; col: Column };

function buildDetailSegments(detailCols: Column[]): DetailSegment[] {
  const profIdx = detailCols.findIndex((c) => isProfessorColumn(c));
  const qualIdx = detailCols.findIndex(
    (c) => isQualityColumn(c) && !isDifficultyColumn(c)
  );
  const hasPair = profIdx >= 0 && qualIdx >= 0;
  const skip = new Set<string>();
  if (hasPair) {
    skip.add(detailCols[profIdx].key);
    skip.add(detailCols[qualIdx].key);
  }
  const pairFirstIdx = hasPair
    ? Math.min(profIdx, qualIdx)
    : -1;
  const segments: DetailSegment[] = [];
  let pairInserted = false;

  for (let i = 0; i < detailCols.length; i += 1) {
    const c = detailCols[i];
    if (hasPair && i === pairFirstIdx && !pairInserted) {
      segments.push({
        kind: "professor-quality",
        professor: detailCols[profIdx],
        quality: detailCols[qualIdx],
      });
      pairInserted = true;
      continue;
    }
    if (skip.has(c.key)) continue;
    segments.push({ kind: "single", col: c });
  }
  return segments;
}

function columnKeyMatches(key: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(key));
}

/** Best field for card title; uses only visible (non-hidden) column keys. */
function pickHeadline(
  entry: Entry,
  columnKeys: string[]
): { title: string; headlineKey: string | null } {
  const keys = columnKeys.filter((k) => entry[k]?.trim());

  const byCourse = keys.find((k) =>
    columnKeyMatches(k, [
      /course.*(title|name|number)/,
      /class.*(title|name|number)/,
      /subject/,
      /^course$/,
      /^class$/,
    ])
  );
  if (byCourse && entry[byCourse]?.trim()) {
    return {
      title: formatCatalogVisualText(entry[byCourse]),
      headlineKey: byCourse,
    };
  }

  const secondary = keys.find((k) => /^(course|class|what)/.test(k));
  if (secondary && entry[secondary]?.trim()) {
    return {
      title: formatCatalogVisualText(entry[secondary]),
      headlineKey: secondary,
    };
  }

  const first = keys[0];
  if (first && entry[first]?.trim()) {
    return {
      title: formatCatalogVisualText(entry[first]),
      headlineKey: first,
    };
  }

  return { title: "Course entry", headlineKey: null };
}

/**
 * Finds course code + course name columns; otherwise falls back to pickHeadline.
 */
function pickCourseHeader(
  entry: Entry,
  cols: Column[]
): {
  code: string | null;
  codeKey: string | null;
  name: string | null;
  nameKey: string | null;
  fallbackTitle: string | null;
  fallbackKey: string | null;
} {
  const withVals = cols.filter((c) => entry[c.key]?.trim());
  const keysWithVals = withVals.map((c) => c.key);

  const codeCol = withVals.find((c) => {
    const L = c.label.toLowerCase();
    const k = c.key.toLowerCase();
    return (
      /\b(course|class)\b.*\b(code|number)\b/.test(L) ||
      /\bcourse\s+(code|#|number)\b/.test(L) ||
      /^(course|class)_(code|number)$|course_number|^_number$/.test(k)
    );
  });

  const nameCol = withVals.find((c) => {
    if (codeCol && c.key === codeCol.key) return false;
    const L = c.label.toLowerCase();
    const k = c.key.toLowerCase();
    return (
      /\b(course|class)\b.*\b(name|title)\b/.test(L) ||
      /course_name|class_title|course_title|class_name/.test(k)
    );
  });

  if (codeCol || nameCol) {
    return {
      code: codeCol
        ? formatCatalogVisualText(entry[codeCol.key]!.trim())
        : null,
      codeKey: codeCol?.key ?? null,
      name: nameCol
        ? formatCatalogVisualText(entry[nameCol.key]!.trim())
        : null,
      nameKey: nameCol?.key ?? null,
      fallbackTitle: null,
      fallbackKey: null,
    };
  }

  const { title, headlineKey } = pickHeadline(entry, keysWithVals);
  return {
    code: null,
    codeKey: null,
    name: null,
    nameKey: null,
    fallbackTitle: title,
    fallbackKey: headlineKey,
  };
}

function sublineFor(
  entry: Entry,
  columnKeys: string[],
  excludeKeys: Set<string>
) {
  const keys = columnKeys.filter(
    (k) => entry[k]?.trim() && !excludeKeys.has(k)
  );
  const sem = keys.find((k) => /sem|term|season|year|reporting/.test(k));
  const name = keys.find((k) =>
    /name|brother|submitter|who/.test(k)
  );
  const parts: string[] = [];
  if (sem) parts.push(formatCatalogVisualText(entry[sem]!.trim()));
  if (name) parts.push(formatCatalogVisualText(entry[name]!.trim()));
  return parts.length ? parts.join(" · ") : null;
}

function renderFieldValue(col: Column, entry: Entry) {
  const raw = entry[col.key]?.trim() ?? "";
  if (isDifficultyColumn(col) || isQualityColumn(col)) {
    return <StarRating raw={raw} />;
  }
  return (
    <span className="whitespace-pre-wrap">
      {formatCatalogVisualText(raw)}
    </span>
  );
}

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="block text-sm font-semibold text-(--navy)">
          {label}
        </span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-medium text-[#64748b] hover:text-(--navy)"
          >
            Clear
          </button>
        ) : null}
      </div>
      <RadioGroup
        value={value}
        onChange={onChange}
        aria-label={label}
        className="flex items-center gap-1"
      >
        {["1", "2", "3", "4", "5"].map((rating) => (
          <Radio
            key={rating}
            value={rating}
            className="group rounded-md p-1 focus:outline-none data-focus:ring-2 data-focus:ring-(--blue)"
            title={`${rating} out of 5`}
          >
            {({ checked }) => {
              const filled = Number(rating) <= Number(value || 0);
              return (
                <Star
                  className={
                    filled || checked
                      ? "h-7 w-7 fill-(--gold) text-(--gold)"
                      : "h-7 w-7 fill-transparent text-[#cbd5e1] group-hover:text-(--gold)"
                  }
                  strokeWidth={1.5}
                />
              );
            }}
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
}

function ReviewModal({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { data: session } = useSession();
  const submitterName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const [form, setForm] = useState<ReviewForm>(initialReviewForm);
  const [courseNameEditable, setCourseNameEditable] = useState(false);
  const [courseNameStatus, setCourseNameStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = <K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!open) return;
    const courseCode = form.courseCode.trim();

    if (!courseCode) {
      setCourseNameEditable(false);
      setCourseNameStatus("");
      setField("courseName", "");
      return;
    }

    const controller = new AbortController();
    setCourseNameStatus("Looking up course title...");
    setCourseNameEditable(false);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/course-catalog/course-name?courseCode=${encodeURIComponent(
            courseCode
          )}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Course lookup failed");
        const json = await res.json();
        const name = typeof json?.name === "string" ? json.name.trim() : "";
        if (!name) throw new Error("Course lookup returned no title");
        setField("courseName", name);
        setCourseNameStatus("Course title autofilled");
      } catch {
        if (controller.signal.aborted) return;
        setCourseNameEditable(true);
        setCourseNameStatus("Course lookup failed. Enter the title manually.");
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.courseCode, open]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/course-catalog/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to submit review");

      setForm(initialReviewForm);
      setCourseNameEditable(false);
      setCourseNameStatus("");
      onSubmitted();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-(--navy)/55 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto px-4 py-8">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-[#dce3ec]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-5 py-4">
              <DialogTitle className="text-xl font-semibold text-(--navy)">
                Add Course Review
              </DialogTitle>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-[#64748b] hover:bg-[#f1f5f9] hover:text-(--navy)"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitReview} className="px-5 py-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="reviewer-name" className="block text-sm font-semibold text-(--navy) mb-2">
                    Reviewer
                  </label>
                  <input
                    id="reviewer-name"
                    value={submitterName}
                    readOnly
                    className="w-full rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-(--navy)"
                  />
                </div>
                <div>
                  <label htmlFor="review-semester" className="block text-sm font-semibold text-(--navy) mb-2">
                    Semester
                  </label>
                  <input
                    id="review-semester"
                    required
                    pattern="^(Fall|Spring|fall|spring)\s+(\d{2}|\d{4})$"
                    value={form.semester}
                    onChange={(e) => setField("semester", e.target.value)}
                    placeholder="Spring 2026"
                    title="Use Fall or Spring followed by a 2- or 4-digit year"
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2.5 text-(--navy) placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-(--blue)"
                  />
                </div>
                <div>
                  <label htmlFor="course-code" className="block text-sm font-semibold text-(--navy) mb-2">
                    Course code
                  </label>
                  <input
                    id="course-code"
                    required
                    inputMode="numeric"
                    pattern="^\d{2}-?\d{3}$"
                    value={form.courseCode}
                    onChange={(e) => setField("courseCode", e.target.value)}
                    placeholder="15-112"
                    title="Use a 5-digit course code, with or without the dash"
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2.5 text-(--navy) placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-(--blue)"
                  />
                </div>
                <div>
                  <label htmlFor="course-name" className="block text-sm font-semibold text-(--navy) mb-2">
                    Course title
                  </label>
                  <input
                    id="course-name"
                    required
                    value={form.courseName}
                    onChange={(e) => setField("courseName", e.target.value)}
                    readOnly={!courseNameEditable}
                    placeholder="Autofilled from course code"
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2.5 text-(--navy) placeholder:text-[#94a3b8] read-only:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-(--blue)"
                  />
                  {courseNameStatus ? (
                    <p className="mt-1.5 text-xs text-[#64748b]">{courseNameStatus}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="professor" className="block text-sm font-semibold text-(--navy) mb-2">
                    Professor
                  </label>
                  <input
                    id="professor"
                    value={form.professor}
                    onChange={(e) => setField("professor", e.target.value)}
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2.5 text-(--navy) focus:outline-none focus:ring-2 focus:ring-(--blue)"
                  />
                </div>
                <div>
                  <label htmlFor="commitment" className="block text-sm font-semibold text-(--navy) mb-2">
                    Weekly commitment
                  </label>
                  <select
                    id="commitment"
                    value={form.commitment}
                    onChange={(e) => setField("commitment", e.target.value)}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2.5 text-(--navy) focus:outline-none focus:ring-2 focus:ring-(--blue)"
                  >
                    <option value="">Select commitment</option>
                    {commitmentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StarRatingInput label="Course quality" value={form.courseQuality} onChange={(value) => setField("courseQuality", value)} />
                <StarRatingInput label="Professor quality" value={form.professorQuality} onChange={(value) => setField("professorQuality", value)} />
                <StarRatingInput label="Difficulty" value={form.difficulty} onChange={(value) => setField("difficulty", value)} />
              </div>

              <div>
                <label htmlFor="comments" className="block text-sm font-semibold text-(--navy) mb-2">
                  Comments
                </label>
                <textarea
                  id="comments"
                  value={form.comments}
                  onChange={(e) => setField("comments", e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2.5 text-(--navy) focus:outline-none focus:ring-2 focus:ring-(--blue)"
                />
              </div>

              {submitError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {submitError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-[#cbd5e1] px-4 py-2 font-medium text-(--navy) hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !submitterName}
                  className="inline-flex items-center gap-2 rounded-md bg-(--blue) px-4 py-2 font-medium text-white hover:bg-[#4A85B0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isSubmitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

export default function ClassRegistry() {
  const { status } = useSession();
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState<string>("all");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const {
    data: pages,
    error,
    isLoading,
    isValidating,
    mutate,
    setSize,
  } = useSWRInfinite<CourseCatalogPage>((pageIndex, previousPageData) => {
    if (previousPageData && !previousPageData.hasMore) return null;
    const params = new URLSearchParams({
      query,
      semester,
      offset: String(pageIndex * PAGE_SIZE),
      limit: String(PAGE_SIZE),
    });
    return `/api/course-catalog?${params.toString()}`;
  });
  const firstPage = pages?.[0];
  const entries: Entry[] = useMemo(
    () => pages?.flatMap((page) => page.entries ?? []) ?? [],
    [pages]
  );
  const hasMore = Boolean(pages?.[pages.length - 1]?.hasMore);
  const isLoadingMore = isValidating && Boolean(pages?.length);

  const visibleColumns = useMemo(
    () => firstPage ? firstPage.columns.filter((c: Column) => !isHiddenCatalogColumn(c)) : [],
    [firstPage]
  );

  const columnKeys = useMemo(
    () => visibleColumns.map((c: Column) => c.key),
    [visibleColumns]
  );

  const semesterColumn = useMemo(() => {
    return visibleColumns.find(
      (c: Column) =>
        /semester|term|reporting|when.*took/i.test(c.label) ||
        /semester|term|season/.test(c.key)
    );
  }, [visibleColumns]);

  const semesterOptions = useMemo(() => {
    return firstPage?.semesterOptions ?? [];
  }, [firstPage?.semesterOptions]);

  const detailColumns = useCallback(
    (entry: Entry, excludedKeys: Set<string>) =>
      visibleColumns.filter((c: Column) => {
        const v = entry[c.key]?.trim();
        if (!v) return false;
        if (excludedKeys.has(c.key)) return false;
        if (isSublineOnlyField(c, semesterColumn)) return false;
        return true;
      }),
    [visibleColumns, semesterColumn]
  );

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSize((size) => size + 1);
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, setSize]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-[#dce3ec] p-5 sm:p-6 mb-10">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="catalog-search"
              className="block text-sm font-semibold text-(--navy) mb-2"
            >
              Search
            </label>
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Professor, number, course name, tips…"
              className="w-full rounded-xl border border-[#cbd5e1] px-4 py-3 text-(--navy) placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-(--blue) focus:border-transparent"
            />
          </div>
          {semesterColumn && semesterOptions.length > 0 ? (
            <div className="w-full lg:w-56">
              <label
                htmlFor="semester-filter"
                className="block text-sm font-semibold text-(--navy) mb-2"
              >
                {formatFieldLabel(semesterColumn.label)}
              </label>
              <select
                id="semester-filter"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full rounded-xl border border-[#cbd5e1] px-4 py-3 text-(--navy) bg-white focus:outline-none focus:ring-2 focus:ring-(--blue)"
              >
                <option value="all">All</option>
                {semesterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatCatalogVisualText(opt)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setIsReviewModalOpen(true)}
            disabled={status !== "authenticated"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-(--blue) px-4 py-3 font-semibold text-white hover:bg-[#4A85B0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add Review
          </button>
        </div>
        {firstPage && (
          <p className="mt-4 text-sm text-[#64748b]">
            Showing{" "}
            <span className="font-semibold text-(--navy)">
              {entries.length}
            </span>{" "}
            of {firstPage.total} matching submissions
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-(--navy)">
          <div className="h-10 w-10 border-2 border-(--blue) border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading catalog…</p>
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-800"
          role="alert"
        >
          <p className="font-semibold mb-2">Couldn’t load Course Catalog</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {(firstPage && !isLoading) && firstPage.allTotal === 0 ? (
        <div className="rounded-2xl border border-[#dce3ec] bg-white px-6 py-16 text-center text-[#64748b]">
          No rows yet in the &quot;Course Catalog&quot; sheet, or the tab is
          empty.
        </div>
      ) : entries.length === 0 ? (
        !isLoading && (
          <div className="rounded-2xl border border-[#dce3ec] bg-white px-6 py-16 text-center text-[#64748b]">
            No submissions match your filters. Try clearing search or semester.
          </div>
        )
      ) : (
        <>
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry: Entry, idx: number) => {
            const header = pickCourseHeader(entry, visibleColumns);
            const excludedKeys = new Set(
              [
                header.codeKey,
                header.nameKey,
                header.fallbackKey,
              ].filter((x): x is string => Boolean(x))
            );
            const sub = sublineFor(entry, columnKeys, excludedKeys);
            const detailCols = detailColumns(entry, excludedKeys);
            const detailSegments = buildDetailSegments(detailCols);
            const courseHref = header.code
              ? `https://courses.scottylabs.org/course/${encodeURIComponent(
                  header.code
                )}`
              : null;
            const headerContent = (
              <>
                {header.code ? (
                  <span className="text-white">{header.code}</span>
                ) : null}
                {header.name ? (
                  <span
                    className={
                      header.code
                        ? "text-gray-300 italic font-normal text-base tracking-tight"
                        : "text-white font-semibold text-lg"
                    }
                  >
                    {header.name}
                  </span>
                ) : null}
              </>
            );

            return (
              <li key={`catalog-${idx}`}>
                <article className="h-full flex flex-col rounded-2xl border border-[#dce3ec] bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="bg-(--navy) px-5 py-4 text-white">
                    {header.fallbackTitle && !header.code && !header.name ? (
                      <h2 className="text-lg font-semibold leading-snug line-clamp-3">
                        {header.fallbackTitle}
                      </h2>
                    ) : (
                      <h2 className="text-lg font-semibold leading-snug flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        {courseHref ? (
                          <a
                            href={courseHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-(--light-blue)"
                          >
                            {headerContent}
                          </a>
                        ) : (
                          headerContent
                        )}
                      </h2>
                    )}
                    {sub ? (
                      <p className="mt-1 text-sm text-(--light-blue) opacity-95">
                        {sub}
                      </p>
                    ) : null}
                  </div>
                  <dl className="flex-1 px-5 py-4 space-y-3.5">
                    {detailSegments.length === 0 ? (
                      <div className="text-sm text-[#64748b]">
                        No additional notes provided.
                      </div>
                    ) : detailSegments.map((seg) =>
                      seg.kind === "professor-quality" ? (
                        <div
                          key={`pair-${seg.professor.key}-${seg.quality.key}`}
                          className="border-b border-[#f1f5f9] last:border-0 pb-3 last:pb-0"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 items-start">
                            <div className="min-w-0">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-1">
                                {formatFieldLabel(seg.professor.label)}
                              </dt>
                              <dd className="text-(--navy) text-sm leading-relaxed">
                                {formatCatalogVisualText(
                                  entry[seg.professor.key]?.trim() ?? ""
                                )}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-1">
                                {formatFieldLabel(seg.quality.label)}
                              </dt>
                              <dd className="text-(--navy) text-sm leading-relaxed flex items-center min-h-5">
                                <StarRating
                                  raw={entry[seg.quality.key]?.trim() ?? ""}
                                />
                              </dd>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={seg.col.key}
                          className="border-b border-[#f1f5f9] last:border-0 pb-3 last:pb-0"
                        >
                          <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-1">
                            {formatFieldLabel(seg.col.label)}
                          </dt>
                          <dd className="text-(--navy) text-sm leading-relaxed">
                            {renderFieldValue(seg.col, entry)}
                          </dd>
                        </div>
                      )
                    )}
                  </dl>
                </article>
              </li>
            );
          })}
          </ul>
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {hasMore || isLoadingMore ? (
              <div className="h-8 w-8 border-2 border-(--blue) border-t-transparent rounded-full animate-spin" />
            ) : null}
          </div>
        </>
      )}
      <ReviewModal
        open={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmitted={() => mutate()}
      />
    </>
  );
}
