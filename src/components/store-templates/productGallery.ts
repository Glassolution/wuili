import { useEffect, useMemo, useState } from "react";

// Galeria de fotos do produto compartilhada pelos templates. Antes cada template
// recebia uma única `image` e repetia a mesma foto nas miniaturas e em todas as
// seções — com o fornecedor entregando várias fotos, dá para mostrar o produto
// de ângulos diferentes.

/** Junta a foto principal com o resto do catálogo, sem vazias nem repetidas. */
export const buildGallery = (images: string[] | undefined, primary: string): string[] => {
  const all = [primary, ...(images ?? [])]
    .map((src) => (typeof src === "string" ? src.trim() : ""))
    .filter((src) => src.length > 0);
  return Array.from(new Set(all));
};

/** Foto para blocos repetidos (seções abaixo da dobra): cicla pela galeria para
 *  a página não ficar com a mesma imagem do topo ao rodapé. */
export const galleryImageAt = (gallery: string[], index: number): string =>
  gallery.length ? gallery[index % gallery.length] : "";

/** Estado da galeria principal: miniatura ativa + navegação pelas setas. */
export const useProductGallery = (images: string[] | undefined, primary: string) => {
  const gallery = useMemo(() => buildGallery(images, primary), [images, primary]);
  const galleryKey = gallery.join("|");
  const [active, setActive] = useState(0);

  // Trocar o produto (ou suas fotos) volta a galeria para a primeira imagem.
  useEffect(() => {
    setActive(0);
  }, [galleryKey]);

  const index = gallery.length ? Math.min(active, gallery.length - 1) : 0;
  const step = (direction: -1 | 1) =>
    setActive((current) => {
      if (gallery.length <= 1) return 0;
      return (current + direction + gallery.length) % gallery.length;
    });

  return {
    gallery,
    /** Índice válido mesmo logo após a galeria encolher. */
    active: index,
    current: gallery[index] ?? "",
    setActive,
    prev: () => step(-1),
    next: () => step(1),
    hasMany: gallery.length > 1,
  };
};
