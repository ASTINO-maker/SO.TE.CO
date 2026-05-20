import type { PropsWithChildren } from "react";

export function SectionCard({
  title,
  eyebrow,
  children,
}: PropsWithChildren<{ title: string; eyebrow?: string }>) {
  return (
    <section
      style={{
        border: "1px solid rgba(15, 23, 42, 0.08)",
        borderRadius: 24,
        padding: 24,
        background: "rgba(255,255,255,0.88)",
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
      }}
    >
      {eyebrow ? (
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 style={{ margin: "8px 0 16px", fontSize: 24 }}>{title}</h2>
      {children}
    </section>
  );
}

