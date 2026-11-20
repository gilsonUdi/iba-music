import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "IBA Music",
  description: "Gestão do ministério de louvor da sua igreja",
};

export const viewport: Viewport = {
  themeColor: "#0b0718",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors theme="dark" toastOptions={{ style: { borderRadius: 16 } }} />
        </AuthProvider>
      </body>
    </html>
  );
}
