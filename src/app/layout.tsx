import "./globals.css";

import { AuthProvider } from "../components/AuthProvider";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export const metadata = { title: "Bots" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
