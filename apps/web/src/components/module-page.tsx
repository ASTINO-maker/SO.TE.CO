import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function ModulePage({
  eyebrow,
  title,
  description,
  focusPoints,
  sampleColumns,
}: {
  eyebrow: string;
  title: string;
  description: string;
  focusPoints: string[];
  sampleColumns: string[];
}) {
  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden rounded-[2rem] bg-card/90 bg-hero-radial">
        <CardHeader className="space-y-4">
          <Badge variant="outline" className="w-fit">
            {eyebrow}
          </Badge>
          <div className="space-y-3">
            <CardTitle className="max-w-[14ch] text-4xl leading-none sm:text-5xl">{title}</CardTitle>
            <CardDescription className="max-w-3xl text-base">{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Operational focus</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 pl-5 text-sm leading-6 text-muted-foreground">
              {focusPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Initial table shape</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sampleColumns.map((column) => (
                <span
                  key={column}
                  className="rounded-full border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                >
                  {column}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
