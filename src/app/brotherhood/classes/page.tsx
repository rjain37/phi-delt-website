import { Metadata } from "next";
import ClassRegistry from "./ClassRegistry";

export const metadata: Metadata = {
  title: "Class Registry"
}

export default function ClassesPage() {
  return (
    <div className="min-h-screen bg-[#eef2f7] pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 text-center">
          <p className="text-sm font-medium text-(--blue) uppercase tracking-wide mb-2">
            Brotherhood Hub
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-(--navy) mb-3">
            Course Catalog
          </h1>
          <p className="text-[#535B72] max-w-2xl mx-auto text-lg">
            Peer-written notes from the chapter Google Form — find classes
            others have taken and what they thought.
          </p>
        </header>

        <ClassRegistry />
      </div>
    </div>
  );
}
