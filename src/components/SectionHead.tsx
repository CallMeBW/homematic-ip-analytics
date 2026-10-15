import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionHead({
  title,
  icon: Icon,
  children,
}: {
  title: ReactNode;
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2>
        <Icon className="section-head__icon" aria-hidden size={22} strokeWidth={2} />
        {title}
      </h2>
      {children != null ? <p>{children}</p> : null}
    </div>
  );
}
