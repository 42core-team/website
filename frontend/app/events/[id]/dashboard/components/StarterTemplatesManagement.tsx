"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import * as z from "zod";
import {
  type EventStarterTemplate,
  createStarterTemplate,
  deleteStarterTemplate,
  getStarterTemplates,
  updateStarterTemplate,
} from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldGroup,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Loader2, Plus, Trash2, Save, X, Check } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  basePath: z.string().min(1, "Base path is required"),
  myCoreBotDockerImage: z.string().min(1, "Bot docker image is required"),
});

interface StarterTemplatesManagementProps {
  eventId: string;
}

export function StarterTemplatesManagement({
  eventId,
}: StarterTemplatesManagementProps) {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] =
    useState<EventStarterTemplate | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      basePath: "",
      myCoreBotDockerImage: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(value);
    },
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["event", eventId, "templates"],
    queryFn: async () => {
      const result = await getStarterTemplates(eventId);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      basePath: string;
      myCoreBotDockerImage: string;
    }) => {
      const result = await createStarterTemplate(eventId, data);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Template created");
      form.reset();
      queryClient.invalidateQueries({
        queryKey: ["event", eventId, "templates"],
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      basePath: string;
      myCoreBotDockerImage: string;
    }) => {
      const result = await updateStarterTemplate(eventId, data.id, {
        name: data.name,
        basePath: data.basePath,
        myCoreBotDockerImage: data.myCoreBotDockerImage,
      });
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Template updated");
      setEditingTemplate(null);
      queryClient.invalidateQueries({
        queryKey: ["event", eventId, "templates"],
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteStarterTemplate(eventId, id);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({
        queryKey: ["event", eventId, "templates"],
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Starter Templates</CardTitle>
            <CardDescription>
              Manage starter templates for teams.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                    colSpan={4}
                    className="text-center p-8 text-muted-foreground italic text-xs"
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
                        <TableCell>
                          <Input
                            value={editingTemplate.name}
                            onChange={(e) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                name: e.target.value,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingTemplate.basePath}
                            onChange={(e) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                basePath: e.target.value,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingTemplate.myCoreBotDockerImage}
                            onChange={(e) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                myCoreBotDockerImage: e.target.value,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Button
                              size="icon"
                              variant="default"
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
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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

              <TableRow className="bg-muted/30 border-t-2">
                <TableCell>
                  <form.Field
                    name="name"
                    children={(field) => (
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="New Template Name..."
                        className="h-8 bg-background"
                      />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <form.Field
                    name="basePath"
                    children={(field) => (
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="bots/c/softcore"
                        className="h-8 bg-background"
                      />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <form.Field
                    name="myCoreBotDockerImage"
                    children={(field) => (
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="ghcr.io/..."
                        className="h-8 bg-background"
                      />
                    )}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8"
                    onClick={() => form.handleSubmit()}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
