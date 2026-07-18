import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Info, Loader2, Terminal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { getStarterTemplates } from '@/app/actions/event'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TeamCreationSectionProps {
  eventId: string
  newTeamName: string
  setNewTeamName: (name: string) => void
  handleCreateTeam: (starterTemplateId?: string) => Promise<void>
  isLoading: boolean
  errorMessage?: string | null
  validationError?: string | null
}

export function TeamCreationSection({
  eventId,
  newTeamName,
  setNewTeamName,
  handleCreateTeam,
  isLoading,
  errorMessage,
  validationError,
}: TeamCreationSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['event', eventId, 'templates'],
    queryFn: () => getStarterTemplates(eventId),
  })

  const effectiveTemplateId = selectedTemplateId || templates[0]?.id
  const requiresTemplate = templates.length > 0

  return (
    <Card className="mx-auto max-w-4xl overflow-hidden shadow-xl">
      <div className="flex flex-col md:flex-row">
        <div className="border-r border-border/50 bg-muted/30 p-8 md:w-5/12">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Prepare for Battle
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your team is your identity. Choose a name that reflects your
                skill.
              </p>
            </div>

            <div className="space-y-4">
              <Feature
                icon={<Terminal className="h-4 w-4 text-primary" />}
                title="Immediate Git Access"
              >
                Instantly receive a repository with boilerplate code and a
                ready-to-use devcontainer to start your development.
              </Feature>
              <Feature
                icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
                title="Join the Competition"
              >
                Invite your team members, push your changes, and start testing
                your bot's logic in the queue.
              </Feature>
            </div>

            {requiresTemplate && (
              <div className="border-t border-border/50 pt-4">
                <TooltipProvider delayDuration={0}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        className="max-w-62.5 text-xs"
                      >
                        <p>
                          Templates are fixed once selected. However, you can
                          leave your team and create a new one to pick a
                          different foundation.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <span>Templates can't be changed later.</span>
                  </div>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>

        <div className="bg-background p-8 md:w-7/12">
          <div className="mx-auto max-w-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Team Details</h2>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (
                  newTeamName &&
                  !validationError &&
                  !isLoading &&
                  !isLoadingTemplates
                ) {
                  void handleCreateTeam(effectiveTemplateId)
                }
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label
                  htmlFor="team-name"
                  className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                >
                  Name
                </Label>
                <Input
                  id="team-name"
                  placeholder="e.g. MasseIstMacht"
                  className="h-10"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
                {validationError && (
                  <p className="text-xs font-medium text-destructive">
                    {validationError}
                  </p>
                )}
              </div>

              {requiresTemplate && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Starter Template
                  </Label>
                  <Select
                    value={effectiveTemplateId}
                    onValueChange={setSelectedTemplateId}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose your foundation" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-md border border-destructive/10 bg-destructive/5 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                className="w-full shadow-lg shadow-primary/20"
                size="lg"
                disabled={
                  !newTeamName ||
                  !!validationError ||
                  (requiresTemplate && !effectiveTemplateId) ||
                  isLoadingTemplates ||
                  isLoading
                }
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Create My Team'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Card>
  )
}

function Feature({
  children,
  icon,
  title,
}: {
  children: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-fit rounded-full bg-primary/10 p-1.5">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  )
}

export default TeamCreationSection
