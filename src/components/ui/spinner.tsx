import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  /** Render centered in a flex container with min-height. Use for page/section loaders. */
  center?: boolean;
  /** Apply muted color instead of primary. */
  muted?: boolean;
  /** Inline icon only (no wrapping div). Use inside buttons. */
  inline?: boolean;
  /** Override icon classes. */
  iconClassName?: string;
}

/**
 * Standardized loading spinner.
 *
 * Usage guidelines:
 * - In buttons: <Spinner inline size="sm" />
 * - Section loader: <Spinner center size="lg" />
 * - Inline small: <Spinner size="sm" />
 */
export function Spinner({
  size = "md",
  center = false,
  muted = false,
  inline = false,
  className,
  iconClassName,
  ...props
}: SpinnerProps) {
  const iconClasses = cn(
    "animate-spin",
    sizeMap[size],
    muted ? "text-muted-foreground" : "text-primary",
    iconClassName
  );

  if (inline) {
    return <Loader2 className={cn(iconClasses, className)} aria-label="loading" />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center",
        center && "min-h-[200px] w-full",
        className
      )}
      {...props}
    >
      <Loader2 className={iconClasses} aria-label="loading" />
    </div>
  );
}
