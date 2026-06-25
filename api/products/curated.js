// Endpoint desativado — a integração CJ Dropshipping foi descontinuada.
// O catálogo agora é alimentado por scrapers de fornecedores brasileiros
// (C7Drop, e futuramente B2Drop, Imagem Folheados, Village Bijuterias, Atacado.com).
export default function handler(_req, res) {
  res.status(410).json({
    error: "Gone",
    message: "Integração CJ Dropshipping descontinuada. Use o catálogo de scrapers brasileiros.",
  });
}
