import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Intelligent Delivery Route Optimizer | AI Search Algorithms',
  description: 'AI Heuristic Search (A*, Greedy Best-First, Hill Climbing) and Delivery Order Optimization on Whole Delhi Road Network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 antialiased selection:bg-blue-100">
        {children}
      </body>
    </html>
  );
}

