import { createContext, useContext, useState } from "react";

export type ImportedProduct = {
  id: string;
  name: string;
  image: string;
  source: string;
  sourceColor: string;
  rating: number;
  reviews: string;
  price: string;
  minOrder: string;
  tags: string[];
  supplier: string;
};

type ImportedProductsContextType = {
  importedProducts: ImportedProduct[];
  addProduct: (product: ImportedProduct) => void;
  removeProduct: (id: string) => void;
  isImported: (id: string) => boolean;
};

const ImportedProductsContext = createContext<ImportedProductsContextType>({
  importedProducts: [],
  addProduct: () => {},
  removeProduct: () => {},
  isImported: () => false,
});

export const ImportedProductsProvider = ({ children }: { children: React.ReactNode }) => {
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>([]);

  const addProduct = (product: ImportedProduct) => {
    setImportedProducts(prev => [...prev, product]);
  };

  const removeProduct = (id: string) => {
    setImportedProducts(prev => prev.filter(p => p.id !== id));
  };

  const isImported = (id: string) => importedProducts.some(p => p.id === id);

  return (
    <ImportedProductsContext.Provider value={{ importedProducts, addProduct, removeProduct, isImported }}>
      {children}
    </ImportedProductsContext.Provider>
  );
};

export const useImportedProducts = () => useContext(ImportedProductsContext);
