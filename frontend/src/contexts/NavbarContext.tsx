import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
} from 'react'

interface NavbarContextType {
  isBasicNavbarMenuOpen: boolean
  setIsBasicNavbarMenuOpen: (isOpen: boolean) => void
  isSiteNavHidden: boolean
  setIsSiteNavHidden: (isHidden: boolean) => void
}

const NavbarContext = createContext<NavbarContextType | undefined>(undefined)

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [isBasicNavbarMenuOpen, setIsBasicNavbarMenuOpen] = useState(false)
  const [isSiteNavHidden, setIsSiteNavHidden] = useState(false)

  return (
    <NavbarContext.Provider
      value={{
        isBasicNavbarMenuOpen,
        setIsBasicNavbarMenuOpen,
        isSiteNavHidden,
        setIsSiteNavHidden,
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

/**
 * Hides the site navbar and the event tabs while `hidden` is true, for a page
 * that renders its own header. Runs before paint so the bars never flash.
 */
export function useHideSiteNav(hidden: boolean) {
  const { setIsSiteNavHidden } = useNavbar()
  useLayoutEffect(() => {
    setIsSiteNavHidden(hidden)
    return () => setIsSiteNavHidden(false)
  }, [hidden, setIsSiteNavHidden])
}
