"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FamilyTree, {
  countPeople,
  getDepth,
  containsName,
  findNode,
  getGeneration,
} from "./FamilyTree";
import type { FamTree } from "./FamilyLineSearch";
import { useRef } from "react";

export default function FamilyLineCarousel({ forest }: { forest: FamTree[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const treeScrollRef = useRef<HTMLDivElement | null>(null);

  const person = searchParams.get("person") ?? "";
  const rootParam = searchParams.get("root") ?? "";

  const selectedIndex =
    findTreeIndexForPerson(forest, person) ??
    forest.findIndex((tree) => tree.root.name === rootParam) ??
    0;

  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const tree = forest[safeIndex];
  if (!tree) return null;

  const selectedNode = person ? findNode(tree.root, person) : null;

  const prevTree = forest[(safeIndex - 1 + forest.length) % forest.length];
  const nextTree = forest[(safeIndex + 1) % forest.length];

  function setRoot(rootName: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("root", rootName);
    params.delete("person");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("person");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <section className="glass-card relative rounded-2xl p-6 shadow-xl">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr) items-start gap-4">
        <button
          type="button"
          onClick={() => setRoot(prevTree.root.name)}
          className="group flex items-center min-w-0 justify-self-start text-left text-white/60 transition hover:text-white"
        >
          <ChevronLeft className="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-1" />
          <div className="max-w-full text-sm md:text-lg group-hover:underline">
            {prevTree.root.name}
          </div>
        </button>

        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">
            Family Line
          </p>

          <h2 className="max-w-48 text-3xl font-bold gradient-text md:max-w-none">{tree.root.name}</h2>

          <div className="mt-2 flex justify-center gap-4 text-sm text-white/60">
            <span>{countPeople(tree.root)} people</span>
            <span>{getDepth(tree.root)} generations</span>
          </div>

        </div>

        <button
          type="button"
          onClick={() => setRoot(nextTree.root.name)}
          className="group flex items-center min-w-0 justify-self-end text-right text-white/60 transition hover:text-white"
        >
          <div className="max-w-full text-sm md:text-lg group-hover:underline">
            {nextTree.root.name}
          </div>
          <ChevronRight className="ml-auto h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </div>

      {selectedNode && (
        <div className="my-4 rounded-xl border border-(--blue)/30 bg-(--blue)/10 px-4 py-3 text-sm text-white">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="text-xl font-semibold blue-shine">
              {selectedNode.name}
            </span>

            <button
              type="button"
              onClick={clearSearch}
              className="rounded-full p-0.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1 text-white/60">
            <span>{selectedNode.littles.length} direct little{selectedNode.littles.length !== 1 ? "s" : ""}</span>
            <span className="hidden md:inline">•</span>
            <span>Generation {getGeneration(tree.root, selectedNode.name)}</span>
            <span className="hidden md:inline">•</span>
            <span>{countPeople(selectedNode)} person subtree</span>
          </div>
        </div>
      )}

      <div
        className="max-h-[70vh] overflow-auto rounded-xl border border-white/10 bg-black/20 p-6"
        ref={treeScrollRef}
      >
        <FamilyTree root={tree.root} highlightName={person} scrollContainerRef={treeScrollRef} />
      </div>
    </section>
  );
}

function findTreeIndexForPerson(forest: FamTree[], person: string) {
  if (!person.trim()) return null;

  const index = forest.findIndex((tree) => containsName(tree.root, person));
  return index === -1 ? null : index;
}
