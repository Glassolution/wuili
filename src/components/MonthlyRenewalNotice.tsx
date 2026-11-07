import { monthlyRenewalDisclosure } from "../../supabase/functions/_shared/monthlyRenewal";
import { Button } from "@/components/ui/button";

export function MonthlyRenewalNotice({ cycle }: { cycle: string }) {
  const disclosure = monthlyRenewalDisclosure(cycle);
  if (!disclosure) return null;
  return (
    <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
      <p>{disclosure.text}</p>
      <Button variant="link" asChild className="h-auto px-0 py-1 text-xs text-primary underline underline-offset-2">
        <a href={disclosure.cancelPath} target="_blank" rel="noopener noreferrer">Como cancelar</a>
      </Button>
    </div>
  );
}