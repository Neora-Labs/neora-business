import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const buttonVariants = cva("inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50", {
  variants: { variant: { default: "bg-emerald-400 text-slate-950 hover:bg-emerald-300", ghost: "hover:bg-white/10 text-slate-100" }, size: { default: "h-10 px-4", sm: "h-8 px-3" } },
  defaultVariants: { variant: "default", size: "default" }
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warning" | "success" }) {
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", tone === "warning" && "border-amber-400/30 bg-amber-400/10 text-amber-200", tone === "success" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", tone === "neutral" && "border-white/10 bg-white/5 text-slate-300")}>{children}</span>;
}
