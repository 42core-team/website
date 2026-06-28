export interface ActionError {
  error: string;
}
export type ServerActionResponse<T = unknown> = ActionError | T;

export function isActionError(response: any): response is ActionError {
  return response && typeof response.error === "string" && "error" in response;
}
