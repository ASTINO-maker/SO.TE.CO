import { PaymentsPageClient } from "../../../../components/finance/payments-page-client";

interface PaymentsPageProps {
  searchParams?: Promise<{
    action?: string;
    filter?: string;
    id?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = (await searchParams) ?? {};
  return <PaymentsPageClient action={params.action} filter={params.filter} paymentId={params.id} />;
}
