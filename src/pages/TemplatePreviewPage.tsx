import { useParams } from "react-router-dom";

import { resolveProductTemplate } from "@/components/store-templates/productTemplateRegistry";
import inspiration1 from "@/assets/store-inspiration-1.jpg";
import inspiration2 from "@/assets/store-inspiration-2.jpg";
import inspiration3 from "@/assets/store-inspiration-3.jpg";
import inspiration4 from "@/assets/store-inspiration-4.jpg";

/**
 * Rota SÓ DE DESENVOLVIMENTO para gerar a miniatura da galeria de modelos.
 *
 * Existe porque o preview do template na galeria é um PNG estático em public/ —
 * sem esta rota, atualizar o template exigia abrir o editor, montar um projeto e
 * printar a tela na mão. Aqui ele renderiza sozinho, com dados de amostra, e
 * `scripts/gerar-previews-templates.mjs` fotografa a página inteira.
 *
 * O conteúdo abaixo é amostra de vitrine (não vai para a interface do usuário
 * final): serve para a miniatura mostrar como o template se comporta cheio.
 */

const amostra = {
  brand: "Nortis",
  title: "Fone Bluetooth com Cancelamento de Ruído",
  // A amostra usa a marcação leve aceita pelo template (**negrito** e
  // __sublinhado__) para a miniatura mostrar o destaque no meio do parágrafo.
  description:
    "Som equilibrado e cancelamento ativo para __focar em qualquer lugar__. São **30 horas de bateria** e conforto do primeiro ao último minuto do dia.",
  price: 299,
  originalPrice: 448.5,
  image: inspiration1,
  images: [inspiration1, inspiration2, inspiration3, inspiration4],
};

const TemplatePreviewPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const { Component } = resolveProductTemplate(templateId);

  return (
  <div className="min-h-screen bg-white">
    <Component
      brand={amostra.brand}
      title={amostra.title}
      description={amostra.description}
      price={amostra.price}
      originalPrice={amostra.originalPrice}
      image={amostra.image}
      images={amostra.images}
      accent="#111111"
      variants={[
        { name: "Cor", options: ["Preto", "Branco", "Azul"] },
        { name: "Tamanho", options: ["P", "M", "G", "GG"] },
      ]}
      relatedProducts={[
        { id: "a", title: "Caixa de som portátil", price: 189, originalPrice: 249, imageUrl: inspiration2 },
        { id: "b", title: "Suporte de mesa para fone", price: 79.9, originalPrice: null, imageUrl: inspiration3 },
        { id: "c", title: "Case rígido de viagem", price: 59, originalPrice: 89, imageUrl: inspiration4 },
        { id: "d", title: "Cabo trançado USB-C", price: 39.9, originalPrice: null, imageUrl: inspiration1 },
      ]}
    />
  </div>
  );
};

export default TemplatePreviewPage;
