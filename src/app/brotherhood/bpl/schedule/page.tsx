import type { Metadata } from "next";
import Schedule from "./Schedule";

export const metadata: Metadata = {
  title: "BPL - Schedule",
};

export default function SchedulePage() {
  return (
    <Schedule />
  );
}
