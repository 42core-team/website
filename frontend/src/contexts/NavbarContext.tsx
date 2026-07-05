import React, { createContext, useContext, useState } from 'react'

interface NavbarContextType {
  isBasicNavbarMenuOpen: boolean
  setIsBasicNavbarMenuOpen: (isOpen: boolean) => void
}

const NavbarContext = createContext<NavbarContextType | undefined>(undefined)

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [isBasicNavbarMenuOpen, setIsBasicNavbarMenuOpen] = useState(false)

  return (
    <NavbarContext.Provider
      value={{
        isBasicNavbarMenuOpen,
        setIsBasicNavbarMenuOpen,
      }}
    >
      {children}
    </NavbarContext.Provider>
  )
}

export function useNavbar() {
  const context = useContext(NavbarContext)
  if (context === undefined) {
    throw new Error('useNavbar must be used within a NavbarProvider')
  }
  return context
}
