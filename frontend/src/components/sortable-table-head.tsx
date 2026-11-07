import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'

export type SortDirection = 'asc' | 'desc'

interface SortableTableHeadProps<TColumn extends string> {
  children: string
  column: TColumn
  sortColumn: TColumn
  sortDirection: SortDirection
  onSort: (column: TColumn) => void
}

export function SortableTableHead<TColumn extends string>({
  children,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: SortableTableHeadProps<TColumn>) {
  const isSorted = sortColumn === column
  const SortIcon = isSorted
    ? sortDirection === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  const ariaSort = isSorted
    ? sortDirection === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'

  return (
    <TableHead aria-sort={ariaSort}>
      <Button
        aria-label={`Sort by ${children}`}
        className="-ml-3 h-8 px-3"
        onClick={() => onSort(column)}
        variant="ghost"
      >
        {children}
        <SortIcon className="text-muted-foreground" />
      </Button>
    </TableHead>
  )
}
