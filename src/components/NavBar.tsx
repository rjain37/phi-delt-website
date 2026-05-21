"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import clsx from "clsx";
import LoadingSpinner from "./LoadingSpinner";

function NavLink({
  href,
  onClick,
  children,
  className,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "drop-shadow-sm drop-shadow-black/50 transition-colors",
        "block rounded-md px-3 py-2 font-medium text-foreground hover:bg-(--light-blue)/20",
        "md:inline-block md:rounded-none md:px-0 md:py-0 md:font-normal md:text-foreground/80 md:hover:bg-transparent md:hover:text-foreground md:animated-underline!",
        className
      )}
    >
      {children}
    </Link>
  );
}

function AuthButton({ onClick }: { onClick?: () => void }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <LoadingSpinner className="py-0!" size="sm" />;
  }

  return session ? (
    <button
      onClick={() => {
        onClick?.();
        signOut({ callbackUrl: "/" });
      }}
      className="bg-(--blue) text-white px-3 py-1 rounded-md font-medium hover:bg-[#4A85B0] transition-colors"
    >
      {session.user?.image && (
        <Image
          src={session.user.image}
          alt="User profile picture"
          width={24}
          height={24}
          className="rounded-full inline mr-3"
        />
      )}
      Sign out
    </button>
  ) : (
    <button
      onClick={() => {
        onClick?.();
        signIn("google");
      }}
      className="bg-(--blue) text-white px-3 py-1 rounded-md font-medium hover:bg-[#4A85B0] transition-colors"
    >
      Brother Login
    </button>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const classRegistryNav = pathname.startsWith("/brotherhood/classes");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav
      className={clsx(
        "fixed top-0 left-0 w-full z-50 transition-all duration-300",
        classRegistryNav
          ? clsx(
              "bg-(--navy) border-b border-white/10 text-(--white)",
              (isScrolled || isMenuOpen) && "shadow-md backdrop-blur-sm"
            )
          : {
              "bg-(--background)/50": isScrolled && !isMenuOpen,
              "bg-(--background)/75": isMenuOpen,
              "backdrop-blur-sm shadow-sm": isScrolled || isMenuOpen,
              "bg-none": !(isScrolled || isMenuOpen),
            }
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex min-w-0 items-center">
              <Image
                src="/sword_and_shield.webp"
                alt="Phi Delta Theta Crest"
                width={32}
                height={32}
                className="rounded-full inline mr-3 drop-shadow-sm drop-shadow-black/50"
              />
              <span className="truncate text-foreground font-semibold text-lg drop-shadow-sm drop-shadow-black/50">
                Carnegie Mellon Phi Delta Theta
              </span>
            </Link>

            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-foreground hover:bg-(--light-blue)/20 focus:outline-none drop-shadow-sm drop-shadow-black/50"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Open main menu</span>

              <svg
                className={clsx("h-6 w-6", isMenuOpen ? "hidden" : "block")}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>

              <svg
                className={clsx("h-6 w-6", isMenuOpen ? "block" : "hidden")}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div
            className={clsx(
              "pb-3 md:pb-0",
              "md:flex md:items-center md:space-x-8",
              isMenuOpen ? "block" : "hidden md:flex"
            )}
          >
            <NavLink href="/" onClick={closeMenu}>
              Home
            </NavLink>

            <NavLink href="/about" onClick={closeMenu}>
              About
            </NavLink>

            <NavLink href="/philanthropy" onClick={closeMenu}>
              Philanthropy
            </NavLink>

            <NavLink href="/rush" onClick={closeMenu}>
              Rush
            </NavLink>

            {session && (
              <NavLink
                href="/brotherhood"
                onClick={closeMenu}
                className="blue-shine"
              >
                Brotherhood Hub
              </NavLink>
            )}

            <div className="mt-2 flex items-center gap-4 px-3 shadow-md md:mt-0 md:ml-4 md:px-0">
              <AuthButton onClick={closeMenu} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
