import { Metadata } from 'next';
import Background from "./Background";
import BplNav from "./BplNav";
import PingPongBackground from "./PingPongBackground";

export const metadata: Metadata = {
  title: "Brotherhood Pong League"
}

export default function BPLLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Background />
      <PingPongBackground
        colorHexes={["#F06400", "#21ABCD"]}
        solidColorFraction={0.8}
        minSpawnDelayMs={300}
        maxSpawnDelayMs={1500}
        minRotationSpeed={0.1}
        maxRotationSpeed={2.5}
        edgePadding={3}
      />
      <BplNav />
      {children}
    </>
  );
}
