import type { ReactNode } from "react";
import { Card, CardContent } from "../ui/card";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="border-[#ddd3c3] bg-[#fffdfa]">
      <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:flex-wrap lg:items-center">{children}</CardContent>
    </Card>
  );
}
