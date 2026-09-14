// Endpoint desativado. O catálogo agora é alimentado exclusivamente pelo scraper C7Drop.
export default function handler(_req, res) {
  res.status(410).json({
    error: "Gone",
    message: "Use exclusivamente o catálogo C7Drop alimentado por scraping.",
  });
}
