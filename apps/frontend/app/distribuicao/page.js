import { BudgetEntry } from "../route-entry";

export const metadata = {
  title: "Distribuição — Cifro",
  description: "Distribua sua renda mensal entre as categorias que importam para você.",
};

export default function BudgetPage() {
  return <BudgetEntry />;
}
