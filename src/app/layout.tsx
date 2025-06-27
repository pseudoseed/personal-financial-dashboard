import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { NavigationMenu } from "@/components/NavigationMenu";
import { AccountConnectionButtons } from "@/components/AccountConnectionButtons";
import { UtilityButtons } from "@/components/UtilityButtons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationProvider } from "@/components/ui/Notification";
import FocusRingKiller from "./FocusRingKiller";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "pseudofi",
  description: "Track all your financial accounts in one place",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} h-full bg-background text-foreground antialiased`}>
        <FocusRingKiller />
        <ErrorBoundary>
          <NotificationProvider>
            <Providers>
              <div className="min-h-full flex flex-col">
                {/* Header */}
                <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="container-responsive">
                    <div className="flex h-16 items-center justify-between">
                      {/* Left side - Navigation */}
                      <div className="flex items-center">
                        <NavigationMenu />
                      </div>

                      {/* Right side - Account Connection & Utility Buttons */}
                      <div className="flex items-center gap-3">
                        <AccountConnectionButtons />
                        <div className="hidden sm:block h-6 w-px bg-border" />
                        <UtilityButtons />
                      </div>
                    </div>
                  </div>
                </header>

                {/* Main content */}
                <main className="flex-1 mt-8">
                  <div className="container-responsive py-12">
                    {children}
                  </div>
                </main>
              </div>
              
              {/* Dialog root for portal rendering */}
              <div id="dialog-root" />
            </Providers>
          </NotificationProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
