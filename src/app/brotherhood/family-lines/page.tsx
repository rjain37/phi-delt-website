import { Metadata } from 'next';
import SvgTiltBackground from '@/components/SVGTiltBackground';
import FamilyLinesDisplay from './FamilyLinesDisplay';

export const metadata: Metadata = {
  title: "Family Lines"
}

export default function FamilyLines() {
  return (
    <SvgTiltBackground
      svgUrl="/svg/PDT_Stars.svg"
      className="min-h-screen bg-(--navy)"
      svgClassName="text-(--light-blue)/15 !opacity-25 md:!opacity-15 drop-shadow-md drop-shadow-white"
      maxTilt={2}
      glareOpacity={0.1}
      fullPage
    >
      <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24 pt-28">
        <div className="max-w-10xl w-full">
          {/* Hero Section */}
          <div className="mb-16 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-(--white)">Family Lines</h1>
            <p className="text-xl text-(--white)/80 max-w-3xl mx-auto">
              Family lines in Phi Delta Theta represent the mentorship relationships between members.
              Each new member (Little) is paired with a mentor (Big) who guides them through their journey in the fraternity.
              These relationships form the backbone of our brotherhood and create lasting bonds between generations of members.
            </p>
          </div>

          <FamilyLinesDisplay />
        </div>
      </main>
    </SvgTiltBackground>
  );
};
