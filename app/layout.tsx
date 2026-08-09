import { ClerkProvider } from "@clerk/nextjs";
import "./ui/global.css";
import { Toaster } from "./ui/toaster";
import Header from "./ui/header";

export const metadata = {
  title: "Endpoint Builders",
  description: "Build, inspect, and manage webhook endpoints — unlimited and developer-first.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
        <ClerkProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
