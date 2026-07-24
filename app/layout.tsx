import { ClerkProvider } from "@clerk/nextjs";
import "./ui/global.css";
import { Toaster } from "./ui/toaster";
import Header from "./ui/header";

export const metadata = {
  title: "Dynamic Endpoint Hub",
  description: "Create dynamic, fully customizable Webhook endpoints on the fly.",
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
