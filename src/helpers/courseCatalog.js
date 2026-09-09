import { sheets } from "@/lib/google";
import { google } from "@/lib/google";

const SHEET_RANGE = "'Course Catalog'!A1:ZZ";
const SHEET_APPEND_RANGE = "'Course Catalog'!A:ZZ";

function isHiddenCatalogColumn(column) {
  const label = column.label.toLowerCase();
  const key = column.key.toLowerCase();
  return (
    /^timestamp$|^timestamp_|_timestamp$|time_stamp|date_submitted|submitted_at/.test(key) ||
    /\btimestamp\b|time stamp|date submitted|submitted at/.test(label) ||
    /^email$|_email$|^e_mail$|email_address/.test(key) ||
    /\be-?mail\b|email address/.test(label)
  );
}

function normalizeSearchText(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function entryMatchesQuery(entry, query, searchableKeys) {
  if (!query) return true;
  const normalizedQuery = normalizeSearchText(query);
  return searchableKeys.some((key) =>
    normalizeSearchText(entry[key]).includes(normalizedQuery)
  );
}

function entryInformationScore(entry, searchableKeys) {
  let filledFields = 0;
  let textLength = 0;

  for (const key of searchableKeys) {
    const value = entry[key]?.trim();
    if (!value) continue;
    filledFields += 1;
    textLength += value.length;
  }

  return filledFields * 1000 + Math.min(textLength, 999);
}

function entryQueryMatchScore(entry, query, searchableKeys) {
  if (!query) return 0;
  const normalizedQuery = normalizeSearchText(query);
  let score = 0;

  for (const key of searchableKeys) {
    const value = entry[key];
    if (!value) continue;
    const text = normalizeSearchText(value);
    if (text === normalizedQuery) score += 100;
    else if (text.startsWith(normalizedQuery)) score += 50;
    else if (text.includes(normalizedQuery)) score += 10;
  }

  return score;
}

function serviceAccountCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  }

  const clientEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    return {
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  return null;
}

function writableSheetsClient() {
  const credentials = serviceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: credentials ?? undefined,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function slugifyHeader(h, used) {
  let base = String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!base) base = "column";

  let key = base;
  let n = 1;
  while (used.has(key)) {
    key = `${base}_${n}`;
    n += 1;
  }
  used.add(key);
  return key;
}

/**
 * Reads the "Course Catalog" tab from the website config spreadsheet.
 * Row 1 = headers; each subsequent row is one form submission.
 */
export async function getCourseCatalogFromSheet(options = {}) {
  const {
    query = "",
    semester = "all",
    offset = 0,
    limit = null,
  } = options;
  const spreadsheetId = process.env.CONFIG_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error("CONFIG_SHEET_ID is not set");
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: SHEET_RANGE,
  });

  const rows = res.data.values ?? [];
  if (rows.length < 1) {
    return {
      columns: [],
      entries: [],
      total: 0,
      allTotal: 0,
      offset: 0,
      limit,
      nextOffset: null,
      hasMore: false,
      semesterOptions: [],
    };
  }

  const headerRow = rows[0];
  const used = new Set();
  const columns = headerRow.map((label) => ({
    key: slugifyHeader(label, used),
    label: String(label ?? "").trim() || "Field",
  }));

  const allEntries = [];

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    const obj = {};

    let any = false;
    for (let c = 0; c < columns.length; c += 1) {
      const val = row?.[c];
      const text = val !== undefined && val !== null ? String(val).trim() : "";
      obj[columns[c].key] = text;
      if (text) any = true;
    }

    if (any) allEntries.push(obj);
  }

  const searchableKeys = columns
    .filter((column) => !isHiddenCatalogColumn(column))
    .map((column) => column.key);
  const semesterColumn = columns.find((column) => {
    const label = column.label.toLowerCase();
    const key = column.key.toLowerCase();
    return (
      /semester|term|reporting|when.*took/.test(label) ||
      /semester|term|season/.test(key)
    );
  });
  const semesterOptions = semesterColumn
    ? [...new Set(allEntries.map((entry) => entry[semesterColumn.key]?.trim()).filter(Boolean))].sort()
    : [];

  const filteredEntries = allEntries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (!entryMatchesQuery(entry, query, searchableKeys)) return false;
      if (
        semesterColumn &&
        semester !== "all" &&
        entry[semesterColumn.key]?.trim() !== semester
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const infoDelta =
        entryInformationScore(b.entry, searchableKeys) -
        entryInformationScore(a.entry, searchableKeys);
      if (infoDelta !== 0) return infoDelta;

      const matchDelta =
        entryQueryMatchScore(b.entry, query, searchableKeys) -
        entryQueryMatchScore(a.entry, query, searchableKeys);
      if (matchDelta !== 0) return matchDelta;

      return a.index - b.index;
    })
    .map(({ entry }) => entry);

  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit =
    limit === null ? null : Math.max(1, Math.min(100, Number(limit) || 25));
  const entries =
    safeLimit === null
      ? filteredEntries
      : filteredEntries.slice(safeOffset, safeOffset + safeLimit);

  return {
    columns,
    entries,
    total: filteredEntries.length,
    allTotal: allEntries.length,
    offset: safeOffset,
    limit: safeLimit,
    nextOffset:
      safeLimit !== null && safeOffset + safeLimit < filteredEntries.length
        ? safeOffset + safeLimit
        : null,
    hasMore:
      safeLimit !== null && safeOffset + safeLimit < filteredEntries.length,
    semesterOptions,
  };
}

function normalizedLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedColumnText(column) {
  return `${column.label} ${column.key}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findColumn(columns, patterns, usedKeys, rejectedPatterns = []) {
  return columns.find((column) => {
    if (usedKeys.has(column.key)) return false;
    const label = normalizedLabel(column.label);
    const combined = normalizedColumnText(column);
    if (rejectedPatterns.some((pattern) => pattern.test(combined))) return false;
    return patterns.some((pattern) => pattern.test(label) || pattern.test(combined));
  });
}

function applyIfMatched(values, columns, patterns, value, usedKeys, rejectedPatterns = []) {
  const column = findColumn(columns, patterns, usedKeys, rejectedPatterns);
  if (!column) return false;
  const idx = columns.findIndex((c) => c.key === column.key);
  values[idx] = value ?? "";
  usedKeys.add(column.key);
  return true;
}

function courseCodePatterns() {
  return [
    /\bcourse\b.*\b(code|number|num|#)\b/,
    /\bclass\b.*\b(code|number|num|#)\b/,
    /\bcode\b/,
    /\bnumber\b/,
  ];
}

function courseNamePatterns() {
  return [
    /\bcourse\b.*\b(name|title)\b/,
    /\bclass\b.*\b(name|title)\b/,
    /\btitle\b/,
  ];
}

function semesterPatterns() {
  return [
    /\bsemester\b/,
    /\bterm\b/,
    /\bwhen\b.*\btook\b/,
    /\breporting\b/,
  ];
}

function reviewerNamePatterns() {
  return [
    /\byour\b.*\bname\b/,
    /\bbrother\b.*\bname\b/,
    /\bsubmitter\b.*\bname\b/,
    /\breviewer\b.*\bname\b/,
    /^name$/,
  ];
}

/**
 * Appends one course review to the Course Catalog tab. The sheet keeps the
 * source of truth for column order; missing optional fields are written blank.
 */
export async function appendCourseCatalogReview(review, sessionUser) {
  const spreadsheetId = process.env.CONFIG_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error("CONFIG_SHEET_ID is not set");
  }

  const { columns } = await getCourseCatalogFromSheet();
  if (!columns.length) {
    throw new Error("Course Catalog sheet must have a header row before submitting");
  }

  const values = Array.from({ length: columns.length }, () => "");
  const usedKeys = new Set();
  const submitterName = sessionUser?.name?.trim() || review.submitterName?.trim();

  const mandatory = [
    applyIfMatched(values, columns, courseCodePatterns(), review.courseCode, usedKeys),
    applyIfMatched(values, columns, courseNamePatterns(), review.courseName, usedKeys),
    applyIfMatched(values, columns, semesterPatterns(), review.semester, usedKeys),
    applyIfMatched(values, columns, reviewerNamePatterns(), submitterName, usedKeys),
  ];

  if (mandatory.some((matched) => !matched)) {
    throw new Error(
      "Course Catalog sheet is missing a recognizable course code, course name, semester, or reviewer name column"
    );
  }

  applyIfMatched(values, columns, [/\btimestamp\b/, /\bsubmitted\b.*\bat\b/], new Date().toISOString(), usedKeys);
  applyIfMatched(values, columns, [/\bemail\b/, /\be mail\b/], sessionUser?.email ?? "", usedKeys);
  applyIfMatched(values, columns, [/\bprofessor\b.*\bquality\b/], review.professorQuality ?? "", usedKeys);
  applyIfMatched(values, columns, [/\boverall\b.*\bquality\b/, /\bcourse\b.*\bquality\b/, /\brating\b/], review.courseQuality ?? "", usedKeys);
  applyIfMatched(values, columns, [/\bprofessor\b/, /\binstructor\b/], review.professor ?? "", usedKeys, [/\bquality\b/, /\brating\b/]);
  applyIfMatched(values, columns, [/\bdifficult/, /\bhow hard\b/], review.difficulty ?? "", usedKeys);
  applyIfMatched(values, columns, [/\bcommitment\b/, /\bhours\b/], review.commitment ?? "", usedKeys);
  applyIfMatched(values, columns, [/\bcomment/, /\btips?\b/, /\bnotes?\b/, /\bthoughts?\b/], review.comments ?? "", usedKeys);

  const writeClient = writableSheetsClient();
  await writeClient.spreadsheets.values.append({
    spreadsheetId,
    range: SHEET_APPEND_RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [values],
    },
  });
}
