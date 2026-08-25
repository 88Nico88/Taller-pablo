import "./globals.css";

export const metadata = {
  title: "Taller Automotriz Pablo",
  description: "Gestion operativa para recepcion, ordenes, historial e inventario."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
