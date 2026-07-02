import { listarGerentesParaDRE } from "./actions";
import LancarDREForm from "./LancarDREForm";

export const metadata = {
  title: "Lançar DRE Histórico | Coffee++",
  description: "Upload de dados históricos do DRE via arquivo Excel",
};

export default async function LancarDREPage() {
  const gerentes = await listarGerentesParaDRE();
  return <LancarDREForm gerentes={gerentes} />;
}
