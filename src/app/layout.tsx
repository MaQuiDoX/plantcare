import type { Metadata, Viewport } from "next";
import { PWAProvider } from "@/features/pwa/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PlantCare · Tu pequeño mundo verde", template: "%s · PlantCare" },
  description: "Un espacio para conocer tus plantas, acompañar su crecimiento y cuidar tu jardín doméstico.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PlantCare", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-180.png" },
};
export const viewport: Viewport = { themeColor: "#2f6348" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR"><body><PWAProvider><a className="skip-link" href="#main">Saltar al contenido</a>{children}</PWAProvider></body></html>;
}
