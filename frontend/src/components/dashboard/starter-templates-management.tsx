import type { EventStarterTemplate } from '@/app/actions/event'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import * as z from 'zod'
import {
  createStarterTemplate,
  deleteStarterTemplate,
  getStarterTemplates,
  updateStarterTemplate,
} from '@/app/actions/event'
import { Button } from '@/components/ui/8bit/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/8bit/card'
import { Input } from '@/components/ui/8bit/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/8bit/table'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  basePath: z.string().min(1, 'Base path is required'),
  myCoreBotDockerImage: z.string().min(1, 'Bot docker image is required'),
})

type StarterTemplateFormValues = z.infer<typeof formSchema>

interface StarterTemplatesManagementProps {
  eventId: string
}

export function StarterTemplatesManagement({
  eventId,
}: StarterTemplatesManagementProps) {
  const queryClient = useQueryClient()
  const [editingTemplate, setEditingTemplate] =
    useState<EventStarterTemplate | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['event', eventId, 'templates'],
    queryFn: () => getStarterTemplates(eventId),
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      basePath: string
      myCoreBotDockerImage: string
    }) => createStarterTemplate(eventId, data),
    onSuccess: async () => {
      toast.success('Template created')
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'templates'],
      })
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Failed to create template.')),
  })

  const form = useForm({
    defaultValues: {
      name: '',
      basePath: '',
      myCoreBotDockerImage: '',
    } satisfies StarterTemplateFormValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value)
      form.reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string
      name: string
      basePath: string
      myCoreBotDockerImage: string
    }) =>
      updateStarterTemplate(eventId, data.id, {
        name: data.name,
        basePath: data.basePath,
        myCoreBotDockerImage: data.myCoreBotDockerImage,
      }),
    onSuccess: async () => {
      toast.success('Template updated')
      setEditingTemplate(null)
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'templates'],
      })
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Failed to update template.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      deleteStarterTemplate(eventId, templateId),
    onSuccess: async () => {
      toast.success('Template deleted')
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'templates'],
      })
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Failed to delete template.')),
  })

  function TemplateField({
    name,
    placeholder,
  }: {
    name: 'name' | 'basePath' | 'myCoreBotDockerImage'
    placeholder: string
  }) {
    return (
      <TableCell className="align-top">
        <form.Field
          name={name}
          children={(field) => (
            <div className="space-y-1">
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={placeholder}
                className={`h-8 bg-background ${
                  field.state.meta.errors.length > 0
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-[10px] font-medium text-destructive">
                  {field.state.meta.errors
                    .map((error) =>
                      typeof error === 'object' && 'message' in error
                        ? String(error.message)
                        : String(error),
                    )
                    .join(', ')}
                </p>
              )}
            </div>
          )}
        />
      </TableCell>
    )
  }

  const templates = templatesQuery.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Starter Templates</CardTitle>
        <CardDescription>Manage starter templates for teams.</CardDescription>
      </CardHeader>
      <CardContent>
        {templatesQuery.isPending ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Base Path</TableHead>
                <TableHead>Bot Image</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="p-8 text-center text-xs text-muted-foreground italic"
                  >
                    No templates found. Enter details below to create your first
                    template.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    {editingTemplate?.id === template.id ? (
                      <>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          {template.id}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingTemplate.name}
                            onChange={(event) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                name: event.target.value,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingTemplate.basePath}
                            onChange={(event) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                basePath: event.target.value,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingTemplate.myCoreBotDockerImage}
                            onChange={(event) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                myCoreBotDockerImage: event.target.value,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Button
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateMutation.mutate(editingTemplate)
                              }
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => setEditingTemplate(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          {template.id}
                        </TableCell>
                        <TableCell>{template.name}</TableCell>
                        <TableCell>{template.basePath}</TableCell>
                        <TableCell
                          className="max-w-[200px] truncate"
                          title={template.myCoreBotDockerImage}
                        >
                          {template.myCoreBotDockerImage}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingTemplate(template)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => deleteMutation.mutate(template.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}

              <TableRow className="border-t-2 bg-muted/30">
                <TableCell className="align-top" />
                <TemplateField name="name" placeholder="New Template Name..." />
                <TemplateField name="basePath" placeholder="bots/c/softcore" />
                <TemplateField
                  name="myCoreBotDockerImage"
                  placeholder="ghcr.io/42core-team/my-core-bot:dev"
                />
                <TableCell className="text-right align-top">
                  <form.Subscribe
                    selector={(state) => [state.canSubmit, state.isSubmitting]}
                    children={([canSubmit, isSubmitting]) => (
                      <Button
                        size="sm"
                        variant={!canSubmit ? 'destructive' : 'default'}
                        className="h-8"
                        onClick={() => form.handleSubmit()}
                        disabled={
                          !canSubmit || isSubmitting || createMutation.isPending
                        }
                      >
                        {(createMutation.isPending || isSubmitting) && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Create
                      </Button>
                    )}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
