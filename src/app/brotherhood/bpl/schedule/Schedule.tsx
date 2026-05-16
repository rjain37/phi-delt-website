"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

function getWeekLabel(offset: number) {
  if (offset === 0) return "This Week";
  if (offset === 1) return "Next Week";
  if (offset === -1) return "Last Week";
  return `${offset > 0 ? "+" : ""}${offset} Weeks`;
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonthName(dateString: string) {
  return parseLocalDate(dateString).toLocaleString("default", {
    month: "long",
  });
}

function shouldShowMonthLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weekData: any[],
  index: number
) {
  if (index === 0) return true;

  const currentDate = parseLocalDate(weekData[index].dateString);
  const previousDate = parseLocalDate(weekData[index - 1].dateString);

  return currentDate.getMonth() !== previousDate.getMonth();
}

export default function ScheduleClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekOffset = Number(searchParams.get("week") ?? 0);
  const weekLabel = getWeekLabel(weekOffset);

  const {
    data: weekData,
    isLoading,
    error,
  } = useSWR(`/api/bpl/schedule?week=${weekOffset}`);

  const setWeek = useCallback(
    (nextWeek: number) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextWeek === 0) {
        params.delete("week");
      } else {
        params.set("week", String(nextWeek));
      }

      const query = params.toString();
      router.push(query ? `?${query}` : "?");
    },
    [router, searchParams]
  );

  return (
    <main className="flex flex-col text-white p-6">
      <div className="w-full mx-auto md:container flex-1 flex flex-col">
        <div className="glass-card p-6 rounded-lg flex-1 flex flex-col">
          <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="text-blue-500 w-8 h-8" />
                <h1 className="text-3xl font-bold gradient-text">Schedule</h1>
              </div>

              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeek(0)}
                  className="text-sm text-white/60 underline underline-offset-4 transition hover:text-white"
                >
                  Go to current week
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-5 text-white/80">
              <WeekNavButton
                ariaLabel="Previous week"
                onClick={() => setWeek(weekOffset - 1)}
              >
                <ChevronLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
              </WeekNavButton>

              <span className="min-w-28 text-center text-lg font-medium text-white">
                {weekLabel}
              </span>

              <WeekNavButton
                ariaLabel="Next week"
                onClick={() => setWeek(weekOffset + 1)}
              >
                <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </WeekNavButton>
            </div>
          </div>

          {isLoading && <LoadingSpinner />}

          {error && (
            <div className="text-center py-8 text-red-500">
              <p>There was an error loading the schedule data.</p>
              <p className="text-sm text-gray-400 mt-2">
                Please try again later.
              </p>
            </div>
          )}

          {weekData && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-7 gap-4 flex-1 overflow-y-auto md:min-h-72">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {weekData.map((day: any, index: number) => {
                const month = getMonthName(day.dateString);
                const showMonthLabel = shouldShowMonthLabel(weekData, index);

                return (
                  <div
                    key={day.dateString ?? index}
                    className="flex flex-col sm:flex-col md:flex-row lg:flex-col h-full"
                  >
                    <div
                      className={clsx(
                        "h-5 text-xs w-full text-gray-400 text-center",
                        !showMonthLabel && "invisible"
                      )}
                    >
                      {month}
                    </div>

                    <div className="flex flex-col items-center md:items-start text-center md:text-center lg:text-center lg:items-center mb-2 md:mb-0 min-w-20">
                      <div className="text-sm w-full text-gray-400">
                        {day.day}
                      </div>
                      <div className="text-lg w-full font-semibold">
                        {day.dayNumber}
                      </div>
                    </div>

                    <div className="bg-secondary/30 rounded-lg p-3 space-y-4 flex-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.matches.map((match: any, matchIndex: number) => {
                        const location = match.location?.trim();
                        const isB2 = location?.toLowerCase() === "b2";
                        const is329 = location === "329";

                        return (
                          <div
                            key={matchIndex}
                            className={clsx("text-sm border rounded p-2", {
                              "border-pink-500/20 bg-pink-500/5": isB2,
                              "border-blue-500/20 bg-blue-500/5": is329,
                              "border-white/20 bg-white/5": !location,
                            })}
                          >
                            <div
                              className={clsx(
                                "font-semibold flex justify-between",
                                {
                                  "text-pink-500": isB2,
                                  "text-blue-500": is329,
                                  "text-white": !location,
                                }
                              )}
                            >
                              <span>{match.time}</span>

                              {location && (
                                <span className="text-white/80">
                                  {location.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-center">
                              <Link
                                href={{
                                  pathname: "/brotherhood/bpl/teams",
                                  query: { team: match.teams[0] },
                                }}
                                className="hover:text-white/80 transition-colors"
                              >
                                {match.teams[0]}
                              </Link>

                              <div className="text-xs">vs</div>

                              <Link
                                href={{
                                  pathname: "/brotherhood/bpl/teams",
                                  query: { team: match.teams[1] },
                                }}
                                className="hover:text-white/80 transition-colors"
                              >
                                {match.teams[1]}
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function WeekNavButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="group relative p-1 text-white/70 transition hover:text-white"
    >
      {children}
      <span className="absolute left-1/2 top-full mt-1 h-0.5 w-0 -translate-x-1/2 rounded-full bg-white/70 transition-all duration-200 group-hover:w-full" />
    </button>
  );
}
