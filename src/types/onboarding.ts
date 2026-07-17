// Tipo compartilhado de produto usado pelo editor Minha Loja e por telas do
// dashboard. Vivia em StartChoicePage (fluxo de cadastro), que foi removido.
export type ExampleProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
};
