import type * as React from 'react'
import { forwardRef } from 'react'

import * as StandardAccordion from '#/components/ui/accordion.tsx'
import * as RetroAccordion from '#/components/ui/8bit/accordion.tsx'
import * as RetroAlert from '#/components/ui/8bit/alert.tsx'
import * as RetroAvatar from '#/components/ui/8bit/avatar.tsx'
import * as RetroBadge from '#/components/ui/8bit/badge.tsx'
import * as RetroButton from '#/components/ui/8bit/button.tsx'
import * as RetroCalendar from '#/components/ui/8bit/calendar.tsx'
import * as RetroCard from '#/components/ui/8bit/card.tsx'
import * as RetroCheckbox from '#/components/ui/8bit/checkbox.tsx'
import * as RetroDialog from '#/components/ui/8bit/dialog.tsx'
import * as RetroDropdownMenu from '#/components/ui/8bit/dropdown-menu.tsx'
import * as RetroInput from '#/components/ui/8bit/input.tsx'
import * as RetroLabel from '#/components/ui/8bit/label.tsx'
import * as RetroNavigationMenu from '#/components/ui/8bit/navigation-menu.tsx'
import * as RetroPopover from '#/components/ui/8bit/popover.tsx'
import * as RetroSelect from '#/components/ui/8bit/select.tsx'
import * as RetroSkeleton from '#/components/ui/8bit/skeleton.tsx'
import * as RetroSlider from '#/components/ui/8bit/slider.tsx'
import * as RetroSpinner from '#/components/ui/8bit/spinner.tsx'
import * as RetroSwitch from '#/components/ui/8bit/switch.tsx'
import * as RetroTable from '#/components/ui/8bit/table.tsx'
import * as RetroTabs from '#/components/ui/8bit/tabs.tsx'
import * as RetroTextarea from '#/components/ui/8bit/textarea.tsx'
import * as RetroTooltip from '#/components/ui/8bit/tooltip.tsx'
import * as StandardAlert from '#/components/ui/alert.tsx'
import * as StandardAvatar from '#/components/ui/avatar.tsx'
import * as StandardBadge from '#/components/ui/badge.tsx'
import * as StandardButton from '#/components/ui/button.tsx'
import * as StandardCalendar from '#/components/ui/calendar.tsx'
import * as StandardCard from '#/components/ui/card.tsx'
import * as StandardCheckbox from '#/components/ui/checkbox.tsx'
import * as StandardDialog from '#/components/ui/dialog.tsx'
import * as StandardDropdownMenu from '#/components/ui/dropdown-menu.tsx'
import * as StandardInput from '#/components/ui/input.tsx'
import * as StandardLabel from '#/components/ui/label.tsx'
import * as StandardNavigationMenu from '#/components/ui/navigation-menu.tsx'
import * as StandardPopover from '#/components/ui/popover.tsx'
import * as StandardSelect from '#/components/ui/select.tsx'
import * as StandardSkeleton from '#/components/ui/skeleton.tsx'
import * as StandardSlider from '#/components/ui/slider.tsx'
import * as StandardSpinner from '#/components/ui/spinner.tsx'
import * as StandardSwitch from '#/components/ui/switch.tsx'
import * as StandardTable from '#/components/ui/table.tsx'
import * as StandardTabs from '#/components/ui/tabs.tsx'
import * as StandardTextarea from '#/components/ui/textarea.tsx'
import * as StandardTooltip from '#/components/ui/tooltip.tsx'
import { useOptionalTheme } from '#/lib/theme.tsx'

function createThemedComponent<
  TStandard extends React.ElementType,
  TRetro extends React.ElementType,
>(StandardComponent: TStandard, RetroComponent: TRetro) {
  type Props = React.ComponentPropsWithoutRef<TRetro>

  const ThemedComponent = forwardRef<unknown, Props>((props, ref) => {
    const theme = useOptionalTheme()?.theme ?? 'light'
    const Component: React.ElementType =
      theme === '8bit' ? RetroComponent : StandardComponent

    return <Component {...props} ref={ref} />
  })

  ThemedComponent.displayName = `Themed(${
    typeof RetroComponent === 'string'
      ? RetroComponent
      : RetroComponent.displayName || RetroComponent.name || 'Component'
  })`

  return ThemedComponent
}

export const Accordion = createThemedComponent(
  StandardAccordion.Accordion,
  RetroAccordion.Accordion,
)
export const AccordionItem = createThemedComponent(
  StandardAccordion.AccordionItem,
  RetroAccordion.AccordionItem,
)
export const AccordionTrigger = createThemedComponent(
  StandardAccordion.AccordionTrigger,
  RetroAccordion.AccordionTrigger,
)
export const AccordionContent = createThemedComponent(
  StandardAccordion.AccordionContent,
  RetroAccordion.AccordionContent,
)

export const Alert = createThemedComponent(
  StandardAlert.Alert,
  RetroAlert.Alert,
)
export const AlertTitle = createThemedComponent(
  StandardAlert.AlertTitle,
  RetroAlert.AlertTitle,
)
export const AlertDescription = createThemedComponent(
  StandardAlert.AlertDescription,
  RetroAlert.AlertDescription,
)

export const Avatar = createThemedComponent(
  StandardAvatar.Avatar,
  RetroAvatar.Avatar,
)
export const AvatarImage = createThemedComponent(
  StandardAvatar.AvatarImage,
  RetroAvatar.AvatarImage,
)
export const AvatarFallback = createThemedComponent(
  StandardAvatar.AvatarFallback,
  RetroAvatar.AvatarFallback,
)

export const Badge = createThemedComponent(
  StandardBadge.Badge,
  RetroBadge.Badge,
)
export const Button = createThemedComponent(
  StandardButton.Button,
  RetroButton.Button,
)
export const Calendar = createThemedComponent(
  StandardCalendar.Calendar,
  RetroCalendar.Calendar,
)

export const Card = createThemedComponent(StandardCard.Card, RetroCard.Card)
export const CardHeader = createThemedComponent(
  StandardCard.CardHeader,
  RetroCard.CardHeader,
)
export const CardFooter = createThemedComponent(
  StandardCard.CardFooter,
  RetroCard.CardFooter,
)
export const CardTitle = createThemedComponent(
  StandardCard.CardTitle,
  RetroCard.CardTitle,
)
export const CardAction = createThemedComponent(
  StandardCard.CardAction,
  RetroCard.CardAction,
)
export const CardDescription = createThemedComponent(
  StandardCard.CardDescription,
  RetroCard.CardDescription,
)
export const CardContent = createThemedComponent(
  StandardCard.CardContent,
  RetroCard.CardContent,
)

export const Checkbox = createThemedComponent(
  StandardCheckbox.Checkbox,
  RetroCheckbox.Checkbox,
)

export const Dialog = createThemedComponent(
  StandardDialog.Dialog,
  RetroDialog.Dialog,
)
export const DialogTrigger = createThemedComponent(
  StandardDialog.DialogTrigger,
  RetroDialog.DialogTrigger,
)
export const DialogHeader = createThemedComponent(
  StandardDialog.DialogHeader,
  RetroDialog.DialogHeader,
)
export const DialogFooter = createThemedComponent(
  StandardDialog.DialogFooter,
  RetroDialog.DialogFooter,
)
export const DialogDescription = createThemedComponent(
  StandardDialog.DialogDescription,
  RetroDialog.DialogDescription,
)
export const DialogTitle = createThemedComponent(
  StandardDialog.DialogTitle,
  RetroDialog.DialogTitle,
)
export const DialogContent = createThemedComponent(
  StandardDialog.DialogContent,
  RetroDialog.DialogContent,
)
export const DialogClose = createThemedComponent(
  StandardDialog.DialogClose,
  RetroDialog.DialogClose,
)

export const DropdownMenu = createThemedComponent(
  StandardDropdownMenu.DropdownMenu,
  RetroDropdownMenu.DropdownMenu,
)
export const DropdownMenuPortal = createThemedComponent(
  StandardDropdownMenu.DropdownMenuPortal,
  RetroDropdownMenu.DropdownMenuPortal,
)
export const DropdownMenuTrigger = createThemedComponent(
  StandardDropdownMenu.DropdownMenuTrigger,
  RetroDropdownMenu.DropdownMenuTrigger,
)
export const DropdownMenuContent = createThemedComponent(
  StandardDropdownMenu.DropdownMenuContent,
  RetroDropdownMenu.DropdownMenuContent,
)
export const DropdownMenuGroup = createThemedComponent(
  StandardDropdownMenu.DropdownMenuGroup,
  RetroDropdownMenu.DropdownMenuGroup,
)
export const DropdownMenuLabel = createThemedComponent(
  StandardDropdownMenu.DropdownMenuLabel,
  RetroDropdownMenu.DropdownMenuLabel,
)
export const DropdownMenuItem = createThemedComponent(
  StandardDropdownMenu.DropdownMenuItem,
  RetroDropdownMenu.DropdownMenuItem,
)
export const DropdownMenuSeparator = createThemedComponent(
  StandardDropdownMenu.DropdownMenuSeparator,
  RetroDropdownMenu.DropdownMenuSeparator,
)
export const DropdownMenuSubTrigger = createThemedComponent(
  StandardDropdownMenu.DropdownMenuSubTrigger,
  RetroDropdownMenu.DropdownMenuSubTrigger,
)
export const DropdownMenuSubContent = createThemedComponent(
  StandardDropdownMenu.DropdownMenuSubContent,
  RetroDropdownMenu.DropdownMenuSubContent,
)
export const DropdownMenuCheckboxItem = createThemedComponent(
  StandardDropdownMenu.DropdownMenuCheckboxItem,
  RetroDropdownMenu.DropdownMenuCheckboxItem,
)
export const DropdownMenuShortcut = createThemedComponent(
  StandardDropdownMenu.DropdownMenuShortcut,
  RetroDropdownMenu.DropdownMenuShortcut,
)
export const DropdownMenuSub = createThemedComponent(
  StandardDropdownMenu.DropdownMenuSub,
  RetroDropdownMenu.DropdownMenuSub,
)

export const Input = createThemedComponent(
  StandardInput.Input,
  RetroInput.Input,
)
export const Label = createThemedComponent(
  StandardLabel.Label,
  RetroLabel.Label,
)

export const NavigationMenu = createThemedComponent(
  StandardNavigationMenu.NavigationMenu,
  RetroNavigationMenu.NavigationMenu,
)
export const NavigationMenuContent = createThemedComponent(
  StandardNavigationMenu.NavigationMenuContent,
  RetroNavigationMenu.NavigationMenuContent,
)
export const NavigationMenuIndicator = createThemedComponent(
  StandardNavigationMenu.NavigationMenuIndicator,
  RetroNavigationMenu.NavigationMenuIndicator,
)
export const NavigationMenuItem = createThemedComponent(
  StandardNavigationMenu.NavigationMenuItem,
  RetroNavigationMenu.NavigationMenuItem,
)
export const NavigationMenuLink = createThemedComponent(
  StandardNavigationMenu.NavigationMenuLink,
  RetroNavigationMenu.NavigationMenuLink,
)
export const NavigationMenuList = createThemedComponent(
  StandardNavigationMenu.NavigationMenuList,
  RetroNavigationMenu.NavigationMenuList,
)
export const NavigationMenuTrigger = createThemedComponent(
  StandardNavigationMenu.NavigationMenuTrigger,
  RetroNavigationMenu.NavigationMenuTrigger,
)
export const NavigationMenuViewport = createThemedComponent(
  StandardNavigationMenu.NavigationMenuViewport,
  RetroNavigationMenu.NavigationMenuViewport,
)
export const navigationMenuTriggerStyle =
  StandardNavigationMenu.navigationMenuTriggerStyle

export const Popover = createThemedComponent(
  StandardPopover.Popover,
  RetroPopover.Popover,
)
export const PopoverTrigger = createThemedComponent(
  StandardPopover.PopoverTrigger,
  RetroPopover.PopoverTrigger,
)
export const PopoverContent = createThemedComponent(
  StandardPopover.PopoverContent,
  RetroPopover.PopoverContent,
)
export const PopoverAnchor = createThemedComponent(
  StandardPopover.PopoverAnchor,
  RetroPopover.PopoverAnchor,
)

export const Select = createThemedComponent(
  StandardSelect.Select,
  RetroSelect.Select,
)
export const SelectContent = createThemedComponent(
  StandardSelect.SelectContent,
  RetroSelect.SelectContent,
)
export const SelectGroup = createThemedComponent(
  StandardSelect.SelectGroup,
  RetroSelect.SelectGroup,
)
export const SelectItem = createThemedComponent(
  StandardSelect.SelectItem,
  RetroSelect.SelectItem,
)
export const SelectLabel = createThemedComponent(
  StandardSelect.SelectLabel,
  RetroSelect.SelectLabel,
)
export const SelectScrollDownButton = createThemedComponent(
  StandardSelect.SelectScrollDownButton,
  RetroSelect.SelectScrollDownButton,
)
export const SelectScrollUpButton = createThemedComponent(
  StandardSelect.SelectScrollUpButton,
  RetroSelect.SelectScrollUpButton,
)
export const SelectSeparator = createThemedComponent(
  StandardSelect.SelectSeparator,
  RetroSelect.SelectSeparator,
)
export const SelectTrigger = createThemedComponent(
  StandardSelect.SelectTrigger,
  RetroSelect.SelectTrigger,
)
export const SelectValue = createThemedComponent(
  StandardSelect.SelectValue,
  RetroSelect.SelectValue,
)

export const Skeleton = createThemedComponent(
  StandardSkeleton.Skeleton,
  RetroSkeleton.Skeleton,
)
export const Slider = createThemedComponent(
  StandardSlider.Slider,
  RetroSlider.Slider,
)
export const Spinner = createThemedComponent(
  StandardSpinner.Spinner,
  RetroSpinner.Spinner,
)
export const Switch = createThemedComponent(
  StandardSwitch.Switch,
  RetroSwitch.Switch,
)

export const Table = createThemedComponent(
  StandardTable.Table,
  RetroTable.Table,
)
export const TableHeader = createThemedComponent(
  StandardTable.TableHeader,
  RetroTable.TableHeader,
)
export const TableBody = createThemedComponent(
  StandardTable.TableBody,
  RetroTable.TableBody,
)
export const TableFooter = createThemedComponent(
  StandardTable.TableFooter,
  RetroTable.TableFooter,
)
export const TableHead = createThemedComponent(
  StandardTable.TableHead,
  RetroTable.TableHead,
)
export const TableRow = createThemedComponent(
  StandardTable.TableRow,
  RetroTable.TableRow,
)
export const TableCell = createThemedComponent(
  StandardTable.TableCell,
  RetroTable.TableCell,
)
export const TableCaption = createThemedComponent(
  StandardTable.TableCaption,
  RetroTable.TableCaption,
)

export const Tabs = createThemedComponent(StandardTabs.Tabs, RetroTabs.Tabs)
export const TabsList = createThemedComponent(
  StandardTabs.TabsList,
  RetroTabs.TabsList,
)
export const TabsContent = createThemedComponent(
  StandardTabs.TabsContent,
  RetroTabs.TabsContent,
)
export const TabsTrigger = createThemedComponent(
  StandardTabs.TabsTrigger,
  RetroTabs.TabsTrigger,
)

export const Textarea = createThemedComponent(
  StandardTextarea.Textarea,
  RetroTextarea.Textarea,
)

export const Tooltip = createThemedComponent(
  StandardTooltip.Tooltip,
  RetroTooltip.Tooltip,
)
export const TooltipContent = createThemedComponent(
  StandardTooltip.TooltipContent,
  RetroTooltip.TooltipContent,
)
export const TooltipProvider = createThemedComponent(
  StandardTooltip.TooltipProvider,
  RetroTooltip.TooltipProvider,
)
export const TooltipTrigger = createThemedComponent(
  StandardTooltip.TooltipTrigger,
  RetroTooltip.TooltipTrigger,
)
