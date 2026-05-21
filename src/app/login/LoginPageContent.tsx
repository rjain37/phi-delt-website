"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const errorMessages: Record<string, string> = {
  AccessDenied: "You do not have access to the brotherhood portal. If are an alumnus or believe this is a mistake, contact our current Alumni Relations Chair or Membership Development Chair.",
  OAuthSignin: "There was a problem starting Google sign-in.",
  OAuthCallback: "There was a problem completing Google sign-in.",
  Configuration: "Authentication is not configured correctly.",
};

export default function LoginPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const error = searchParams.get("error");
  const errorText = error
    ? errorMessages[error] ?? "Sign in failed. Please try again."
    : null;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/brotherhood");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex justify-center space-x-5 items-center h-screen text-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (status === "authenticated") return null;

  return (
    <div className="glass-card rounded-2xl p-6 bg-black/10! max-w-md w-full text-center">
      <h1 className="text-5xl font-bold mb-4 text-foreground">Sign in</h1>

      {errorText && (
        <p className="text-md text-(--red) drop-shadow-sm mb-6">{errorText}</p>
      )}

      <button
        onClick={() => signIn("google", { callbackUrl: "/brotherhood" })}
        className="w-full py-2 px-4 bg-(--blue) text-white rounded-md font-medium hover:bg-[#4A85B0] transition-colors"
      >
        Sign in with Google
      </button>
    </div>
  );
}
