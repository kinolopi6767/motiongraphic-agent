import { cn } from "@/lib/cn";

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-ctl px-4 font-medium transition-colors",
        "select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "min-h-[34px] px-3 text-[13px]",
        size === "md" && "min-h-[40px] text-[14px]",
        size === "lg" && "min-h-[48px] px-6 text-[15px]",
        variant === "primary" &&
          "bg-accent text-white hover:bg-accent-strong focus-visible:bg-accent-strong",
        variant === "outline" &&
          "border border-border-subtle bg-transparent text-text-hi hover:bg-surface-2",
        variant === "ghost" && "text-text-med hover:bg-surface-2 hover:text-text-hi",
        variant === "danger" &&
          "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}