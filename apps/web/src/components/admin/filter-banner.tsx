import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function FilterBanner({
  label,
  description,
  clearHref,
}: {
  label: string;
  description: string;
  clearHref: string;
}) {
  return (
    <Card className="rounded-[1.75rem] border-[#d8ccb7] bg-[#f7f1e5] shadow-[0_18px_40px_rgba(31,41,55,0.06)]">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">{label}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={clearHref}>Effacer le filtre</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
