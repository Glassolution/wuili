const stats = [
  { value: "+4.200", label: "produtos" },
  { value: "1 clique", label: "para publicar" },
  { value: "0", label: "estoque necessário" },
  { value: "99.9%", label: "uptime" },
];

const StatsBand = () => (
  <section className="py-16 bg-dark">
    <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <p className="text-3xl lg:text-4xl font-black text-primary-foreground">{s.value}</p>
          <p className="text-sm text-primary-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  </section>
);

export default StatsBand;
