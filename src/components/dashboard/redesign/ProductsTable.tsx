import { useState } from "react";
import { Search, Grid3x3 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  subtitle: string;
  channel: string;
  type: string;
  viewed: { value: string; change: string };
  clicked: { value: string; change: string };
  clickPresent: { value: string; change: string };
  cost: { value: string; change: string };
  sale: { value: string; change: string };
}

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Chair Comfort",
    subtitle: "Limitless time",
    channel: "Search",
    type: "Without limit",
    viewed: { value: "2k", change: "-80%" },
    clicked: { value: "88", change: "-80%" },
    clickPresent: { value: "4.45%", change: "+4.1%" },
    cost: { value: "$10", change: "+8%" },
    sale: { value: "$540", change: "+60%" },
  },
  {
    id: "2",
    name: "Chair Labelis",
    subtitle: "Limitless time",
    channel: "Search",
    type: "Without limit",
    viewed: { value: "170", change: "+70%" },
    clicked: { value: "180", change: "+20%" },
    clickPresent: { value: "4.45%", change: "+6.3%" },
    cost: { value: "$15", change: "-80%" },
    sale: { value: "$80", change: "-80%" },
  },
  {
    id: "3",
    name: "Lumini Desk",
    subtitle: "High demand",
    channel: "Social",
    type: "Sponsored",
    viewed: { value: "3.1k", change: "+24%" },
    clicked: { value: "250", change: "+14%" },
    clickPresent: { value: "8.06%", change: "+2.8%" },
    cost: { value: "$18", change: "+4%" },
    sale: { value: "$1.2k", change: "+32%" },
  },
  {
    id: "4",
    name: "Kitchen Pro",
    subtitle: "Organic traffic",
    channel: "Search",
    type: "Without limit",
    viewed: { value: "920", change: "-10%" },
    clicked: { value: "94", change: "+5%" },
    clickPresent: { value: "10.2%", change: "+1.1%" },
    cost: { value: "$9", change: "-3%" },
    sale: { value: "$310", change: "+12%" },
  },
];

export function ProductsTable() {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const toggleRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedRows(
      selectedRows.length === mockProducts.length ? [] : mockProducts.map((p) => p.id)
    );
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-950">All Ads listings</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search"
              className="rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <button className="flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Grid3x3 size={15} />
            Choose Criteria
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.length === mockProducts.length}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left">
                <button className="flex items-center gap-1 font-medium text-slate-600">
                  All <span className="text-slate-400">▼</span>
                </button>
              </th>
              <th className="px-3 py-3 text-left">
                <button className="flex items-center gap-1 font-medium text-slate-600">
                  All <span className="text-slate-400">▼</span>
                </button>
              </th>
              <th className="px-3 py-3 text-left">
                <button className="flex items-center gap-1 font-medium text-slate-600">
                  Modal <span className="text-slate-400">↕</span>
                </button>
              </th>
              <th className="px-3 py-3 text-right">
                <button className="ml-auto flex items-center gap-1 font-medium text-slate-600">
                  Viewed <span className="text-slate-400">↕</span>
                </button>
              </th>
              <th className="px-3 py-3 text-right">
                <button className="ml-auto flex items-center gap-1 font-medium text-slate-600">
                  Clicked <span className="text-slate-400">↕</span>
                </button>
              </th>
              <th className="px-3 py-3 text-right">
                <button className="ml-auto flex items-center gap-1 font-medium text-slate-600">
                  Click Present <span className="text-slate-400">↕</span>
                </button>
              </th>
              <th className="px-3 py-3 text-right">
                <button className="ml-auto flex items-center gap-1 font-medium text-slate-600">
                  Cost <span className="text-slate-400">↕</span>
                </button>
              </th>
              <th className="px-3 py-3 text-right">
                <button className="ml-auto flex items-center gap-1 font-medium text-slate-600">
                  Sale <span className="text-slate-400">↕</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {mockProducts.map((product) => (
              <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(product.id)}
                    onChange={() => toggleRow(product.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-200"></div>
                    <div>
                      <p className="font-semibold text-slate-950">{product.name}</p>
                      <p className="text-slate-500">{product.subtitle}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <p className="text-slate-950">{product.channel}</p>
                  <p className="text-slate-500">Product</p>
                </td>
                <td className="px-3 py-3.5 text-slate-700">{product.type}</td>
                <td className="px-3 py-3.5 text-right">
                  <p className="font-semibold text-slate-950">{product.viewed.value}</p>
                  <p className={product.viewed.change.startsWith("-") ? "text-rose-600" : "text-emerald-600"}>
                    {product.viewed.change}
                  </p>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <p className="font-semibold text-slate-950">{product.clicked.value}</p>
                  <p className={product.clicked.change.startsWith("-") ? "text-rose-600" : "text-emerald-600"}>
                    {product.clicked.change}
                  </p>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <p className="font-semibold text-slate-950">{product.clickPresent.value}</p>
                  <p className="text-emerald-600">{product.clickPresent.change}</p>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <p className="font-semibold text-slate-950">{product.cost.value}</p>
                  <p className={product.cost.change.startsWith("-") ? "text-rose-600" : "text-emerald-600"}>
                    {product.cost.change}
                  </p>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <p className="font-semibold text-slate-950">{product.sale.value}</p>
                  <p className={product.sale.change.startsWith("-") ? "text-rose-600" : "text-emerald-600"}>
                    {product.sale.change}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
