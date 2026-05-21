"use client";

import { useCallback, useMemo, useState } from "react";
import { Star } from "lucide-react";
import useSWR from "swr";

type Column = { key: string; label: string };
type Entry = Record<string, string>;

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

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function entryMatchesQuery(
  entry: Entry,
  q: string,
  visibleKeys: Set<string>
) {
  if (!q) return true;
  const n = normalize(q);
  for (const k of visibleKeys) {
    const v = entry[k];
    if (v && normalize(v).includes(n)) return true;
  }
  return false;
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

export default function ClassRegistry() {
  const { data, isLoading, error } = useSWR("/api/course-catalog");
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState<string>("all");

  const visibleColumns = useMemo(
    () => data ? data.columns.filter((c: Column) => !isHiddenCatalogColumn(c)) : [],
    [data]
  );

  const visibleKeySet: Set<string> = useMemo(
    () => new Set(visibleColumns.map((c: Column) => c.key)),
    [visibleColumns]
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
    if (!semesterColumn) return [];
    const uniq = new Set<string>();
    for (const e of data?.entries) {
      const v = e[semesterColumn.key]?.trim();
      if (v) uniq.add(v);
    }
    return [...uniq].sort();
  }, [data?.entries, semesterColumn]);

  const filtered = useMemo(() => {
    return data ? data.entries.filter((entry: Entry) => {
      if (!entryMatchesQuery(entry, query, visibleKeySet)) return false;
      if (
        semesterColumn &&
        semester !== "all" &&
        entry[semesterColumn.key]?.trim() !== semester
      ) {
        return false;
      }
      return true;
    }) : [];
  }, [data, query, semester, semesterColumn, visibleKeySet]);

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
        </div>
        {data && (
          <p className="mt-4 text-sm text-[#64748b]">
            Showing{" "}
            <span className="font-semibold text-(--navy)">
              {filtered.length}
            </span>{" "}
            of {data.entries.length} submissions
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

      {(data && !isLoading) && data.entries.length === 0 ? (
        <div className="rounded-2xl border border-[#dce3ec] bg-white px-6 py-16 text-center text-[#64748b]">
          No rows yet in the &quot;Course Catalog&quot; sheet, or the tab is
          empty.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#dce3ec] bg-white px-6 py-16 text-center text-[#64748b]">
          No submissions match your filters. Try clearing search or semester.
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry: Entry, idx: number) => {
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
                      </h2>
                    )}
                    {sub ? (
                      <p className="mt-1 text-sm text-(--light-blue) opacity-95">
                        {sub}
                      </p>
                    ) : null}
                  </div>
                  <dl className="flex-1 px-5 py-4 space-y-3.5">
                    {detailSegments.map((seg) =>
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
      )}
    </>
  );
}
