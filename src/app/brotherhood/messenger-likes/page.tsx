import { Metadata } from 'next';
import { readFile } from "fs/promises";
import path from "path";
import MessengerLikesDashboard, { WrappedRow } from "./MessengerLikesDashboard";

export const metadata: Metadata = {
  title: "Messenger Stats"
}

async function loadWrappedData(): Promise<WrappedRow[]> {
  const filePath = path.join(
    process.cwd(),
    "src",
    "data",
    "brotherhood",
    "brotherhood_like_data_S26.tsv",
  );
  const tsvContent = await readFile(filePath, "utf-8");
  const [headerLine, ...dataLines] = tsvContent.trim().split("\n");
  if (!headerLine) return [];

  return dataLines
    .map((line) => {
      const [semester, rank, author, likes, messages, likesPerMessage] = line.split("\t");
      return {
        semester: semester ?? "",
        rank: Number(rank),
        author: author ?? "",
        likes: Number(likes),
        messages: Number(messages),
        likesPerMessage: Number(likesPerMessage),
      };
    })
    .filter((row) => row.author && !Number.isNaN(row.rank));
}

export default async function MessengerLikesPage() {
  const wrappedData = await loadWrappedData();

  return (
    <MessengerLikesDashboard wrappedData={wrappedData} />
  );
}
