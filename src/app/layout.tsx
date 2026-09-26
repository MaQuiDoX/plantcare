import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PlantCare · Tu pequeño mundo verde", template: "%s · PlantCare" },
  description: "Un espacio para conocer tus plantas, acompañar su crecimiento y cuidar tu jardín doméstico.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR"><body><a className="skip-link" href="#main">Saltar al contenido</a>{children}</body></html>;
}
