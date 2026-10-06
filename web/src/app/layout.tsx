import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getApplicationConfig } from "@/lib/config";

import { EmbedFrameBoundary } from "./embed-bridge";
import "./styles.css";

export const metadata: Metadata = {
  title: "Request a PS1 | Royal Glass",
  description: "Submit a glass balustrade or pool barrier project for Royal Glass PS1 review.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { WORDPRESS_EMBED_ORIGIN } = getApplicationConfig();
  return (
    <html lang="en">
      <body className="rg-ps1-host">
        <EmbedFrameBoundary parentOrigin={WORDPRESS_EMBED_ORIGIN ?? ""}>
          {children}
        </EmbedFrameBoundary>
      </body>
    </html>
  );
}
