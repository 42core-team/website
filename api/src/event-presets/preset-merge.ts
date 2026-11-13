import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { CreateEventDto } from "../event/dtos/createEventDto";
import {
  EVENT_DATE_FIELDS,
  EventSettingsDto,
  PRESET_SETTING_FIELDS,
} from "../event/dtos/eventSettingsDto";
import type { ResolvedPresetValues } from "./preset-resolver";

/** The fields of a create request that override a preset's values. */
const OVERRIDABLE_FIELDS = [...PRESET_SETTING_FIELDS, ...EVENT_DATE_FIELDS];

function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

/**
 * The settings of a new event: the request's fields over the resolved
 * preset, always private. Fields the request leaves out keep the preset's
 * value; the result must pass every EventSettingsDto validator.
 */
export async function mergeEventSettings(
  resolved: ResolvedPresetValues,
  dto: CreateEventDto,
): Promise<EventSettingsDto> {
  const overrides: Record<string, unknown> = {};
  for (const field of OVERRIDABLE_FIELDS)
    if (dto[field] !== undefined) overrides[field] = dto[field];
  const merged = plainToInstance(EventSettingsDto, {
    ...resolved,
    ...overrides,
    name: dto.name,
    // Publishing is a separate change that needs EventPolicy.publish.
    isPrivate: true,
  });
  const errors = await validate(merged, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) throw new BadRequestException(messages(errors));
  return merged;
}
