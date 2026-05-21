import { Metadata } from 'next';

// No SEO indexing
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
  title: {
    template: '%s | Phi Delta Theta PA Rho',
    default: 'Brotherhood Hub | Phi Delta Theta PA Rho',
  }
};

// We need to export a component to use a layout file
export default function BrotherhoodLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
