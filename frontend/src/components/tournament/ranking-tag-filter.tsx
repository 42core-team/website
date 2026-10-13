'use client'

import type { Team } from '@/app/actions/team'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_TAGS_VALUE = '__all-ranking-tags__'

export function getRankingTags(teams: Pick<Team, 'tags'>[]) {
  return [...new Set(teams.flatMap((team) => team.tags))].sort((a, b) =>
    a.localeCompare(b),
  )
}

interface RankingTagFilterProps {
  tags: string[]
  selectedTag: string | null
  onSelectedTagChange: (tag: string | null) => void
}

export function RankingTagFilter({
  tags,
  selectedTag,
  onSelectedTagChange,
}: RankingTagFilterProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-sm text-muted-foreground">Filter by tag</span>
      <Select
        value={selectedTag ?? ALL_TAGS_VALUE}
        onValueChange={(value) =>
          onSelectedTagChange(value === ALL_TAGS_VALUE ? null : value)
        }
      >
        <SelectTrigger
          aria-label="Filter ranking by tag"
          className="w-[180px] bg-background"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={ALL_TAGS_VALUE}>All tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
