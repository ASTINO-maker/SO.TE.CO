import { ExpensesPageClient } from "../../../../components/finance/expenses-page-client";

interface ExpensesPageProps {
  searchParams?: Promise<{
    action?: string;
    filter?: string;
    id?: string;
  }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = (await searchParams) ?? {};
  return <ExpensesPageClient action={params.action} filter={params.filter} expenseId={params.id} />;
}
