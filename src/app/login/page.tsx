import { Metadata } from "next";
import LoginPageContent from "./LoginPageContent";
import SvgTiltBackground from "@/components/SVGTiltBackground";

export const metadata: Metadata = {
  title: "Sign In | Phi Delta Theta PA Rho"
}

export default function LoginPage() {
  return (
    <SvgTiltBackground
          svgUrl="/svg/PDT_Swords.svg"
          className="min-h-screen bg-linear-to-b from-(--navy) via-[#14244E] to-(--navy)"
          svgClassName="text-(--light-blue)/15 drop-shadow-md drop-shadow-black"
          fullPage
          fadeIn={false}
    >
      <main className="flex min-h-screen flex-col items-center justify-center">
        <LoginPageContent />
      </main>
    </SvgTiltBackground>
  );
}
