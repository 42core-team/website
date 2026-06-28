import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { NavbarProvider } from "@/contexts/NavbarContext";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavbarProvider>{children}</NavbarProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
