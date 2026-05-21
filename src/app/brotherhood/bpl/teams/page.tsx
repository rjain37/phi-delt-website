import type { Metadata } from "next";
import Teams from "./Teams";

export const metadata: Metadata = {
  title: "BPL - Teams",
};

export default function TeamsPage() {
  return (
    <Teams />
  );
}
