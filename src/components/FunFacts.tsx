import { Sparkles } from "lucide-react";
import { SectionHead } from "./SectionHead";
import type { FunFact } from "../lib/types";

const HIDDEN_IDS = new Set(["warmest-room", "coldest-room"]);

export function FunFactsSection({ facts }: { facts: FunFact[] }) {
  const apartment = facts.filter(
    (f) => f.group !== "rooms" && !HIDDEN_IDS.has(f.id)
  );

  return (
    <section className="fun-facts">
      <SectionHead icon={Sparkles} title="Fun facts from your data">
        Apartment-level highlights from the full export
      </SectionHead>

      <div className="fun-facts__grid">
        {apartment.map((f) => (
          <article key={f.id} className="fact">
            <h4>{f.title}</h4>
            <p>{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
