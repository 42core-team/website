"use client";
import React from "react";
import { SessionProvider } from "next-auth/react";
import { NavbarProvider } from "@/contexts/NavbarContext";
import { ThemeProvider } from "./theme-provider";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <NavbarProvider>{children}</NavbarProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
