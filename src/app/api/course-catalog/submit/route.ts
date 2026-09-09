import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appendCourseCatalogReview } from "@/helpers/courseCatalog";

export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRating(value: string) {
  return value === "" || /^[1-5]$/.test(value);
}

function normalizeSemester(value: string) {
  const match = value.match(/^(fall|spring)\s+(\d{2}|\d{4})$/i);
  if (!match) return null;

  const season = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const year = match[2].slice(-2);
  return `${season} ${year}`;
}

function normalizeCourseCode(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 5) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

const commitmentOptions = new Set([
  "<2 hours per week",
  "2 to 5 hours per week",
  "5 to 8 hours per week",
  "8 to 12 hours per week",
  ">12 hours per week",
]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const submitterName =
    session?.user?.name?.trim() || session?.user?.email?.split("@")[0]?.trim();

  if (!session || !submitterName) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const review = {
      courseCode: cleanString(body.courseCode),
      courseName: cleanString(body.courseName),
      semester: cleanString(body.semester),
      submitterName,
      professor: cleanString(body.professor),
      professorQuality: cleanString(body.professorQuality),
      courseQuality: cleanString(body.courseQuality),
      difficulty: cleanString(body.difficulty),
      commitment: cleanString(body.commitment),
      comments: cleanString(body.comments),
    };
    const normalizedCourseCode = normalizeCourseCode(review.courseCode);
    const normalizedSemester = normalizeSemester(review.semester);

    if (!review.courseCode || !review.courseName || !review.semester) {
      return NextResponse.json(
        { error: "Course code, course name, and semester are required" },
        { status: 400 }
      );
    }

    if (!normalizedCourseCode) {
      return NextResponse.json(
        { error: "Course code must include 5 digits, e.g. 15-112" },
        { status: 400 }
      );
    }

    if (!normalizedSemester) {
      return NextResponse.json(
        { error: "Semester must be Fall or Spring followed by a 2- or 4-digit year" },
        { status: 400 }
      );
    }

    if (review.commitment && !commitmentOptions.has(review.commitment)) {
      return NextResponse.json(
        { error: "Time commitment must be one of the provided options" },
        { status: 400 }
      );
    }

    if (
      !isRating(review.professorQuality) ||
      !isRating(review.courseQuality) ||
      !isRating(review.difficulty)
    ) {
      return NextResponse.json(
        { error: "Ratings must be blank or a whole number from 1 to 5" },
        { status: 400 }
      );
    }

    await appendCourseCatalogReview(
      {
        ...review,
        courseCode: normalizedCourseCode,
        semester: normalizedSemester,
      },
      { ...session.user, name: submitterName }
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit course review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
