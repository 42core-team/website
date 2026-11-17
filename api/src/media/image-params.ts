import { BadRequestException } from "@nestjs/common";
import type { ImageKind } from "./image-processing";

export function imageKind(value: string): ImageKind {
  if (value !== "picture" && value !== "background")
    throw new BadRequestException("Unknown image kind.");
  return value;
}
export function position(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value !== "string" || value.trim() === "")
    throw new BadRequestException("Invalid crop position.");
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100)
    throw new BadRequestException("Invalid crop position.");
  return number;
}
export function cropScale(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestException("Invalid crop size.");
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 1)
    throw new BadRequestException("Crop size must be between 10% and 100%.");
  return scale;
}
