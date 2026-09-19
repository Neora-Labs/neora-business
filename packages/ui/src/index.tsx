import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const buttonVariants = cva("inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3fd0b4] disabled:opacity-50", {
  variants: { variant: { default: "bg-[#087e6b] text-white hover:bg-[#066555]", ghost: "text-[#4b635c] hover:bg-[#e7f7f2] hover:text-[#087e6b]" }, size: { default: "h-10 px-4", sm: "h-8 px-3" } },
  defaultVariants: { variant: "default", size: "default" }
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warning" | "success" }) {
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", tone === "warning" && "border-[#f1d49d] bg-[#fff8e9] text-[#7c5517]", tone === "success" && "border-[#b8e5d8] bg-[#e7f7f2] text-[#087e6b]", tone === "neutral" && "border-[#dfe9e5] bg-[#f5f9f7] text-[#4b635c]")}>{children}</span>;
}
