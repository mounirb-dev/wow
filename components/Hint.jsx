import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Label with an (i) icon that explains the term in plain language.
export default function Hint({ children, tip, className = "" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help items-center gap-1 ${className}`}>
          {children}
          <Info className="size-3 opacity-60" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-xs leading-snug">{tip}</TooltipContent>
    </Tooltip>
  );
}
