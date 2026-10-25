import { Injectable, PipeTransform } from "@nestjs/common";
import { Transform } from "class-transformer";
import {
  GithubConfigField,
  normalizeGithubConfigBody,
  normalizeGithubConfigValue,
} from "./github-validation";

/**
 * Normalizes a GitHub config field before class-validator checks it.
 *
 * The global ValidationPipe runs without `transform: true`, so it validates
 * the transformed DTO but hands the original body to the handler. Routes that
 * use DTOs with this decorator therefore also need NormalizeGithubConfigPipe
 * on their @Body(), so the handler receives the same normalized values that
 * were validated.
 */
export function NormalizeGithubConfig(field: GithubConfigField) {
  return Transform(({ value }) => normalizeGithubConfigValue(field, value));
}

/**
 * Applies the GitHub config normalization to a request body. Param pipes run
 * after the global ValidationPipe, so the body is already validated (against
 * the normalized values) when this runs.
 */
@Injectable()
export class NormalizeGithubConfigPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return normalizeGithubConfigBody(value);
  }
}
