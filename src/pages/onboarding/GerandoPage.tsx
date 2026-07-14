import { Navigate } from "react-router-dom";

// Fluxo novo redireciona para o fluxo existente de criação de loja.
export default function GerandoPage() {
  return <Navigate to="/comecar" replace />;
}
