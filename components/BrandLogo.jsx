import { cn } from "@/lib/utils";

// Logotipo de wow (public/web.webp, 1774 × 887, fondo transparente). El tamaño se da con la altura
// (`className="h-9"`); el ancho sale solo de la proporción y width/height evitan el salto de maquetación.
// Sobre fondo oscuro el contorno negro se funde con el fondo y queda la burbuja blanca.
export default function BrandLogo({ className }) {
  return <img src="/web.webp" alt="wow" width={1774} height={887} className={cn("w-auto select-none", className)} draggable={false} />;
}
