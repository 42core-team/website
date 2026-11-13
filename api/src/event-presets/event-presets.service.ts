import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  QueryFailedError,
} from "typeorm";
import { CreateEventDto } from "../event/dtos/createEventDto";
import { EventEntity } from "../event/entities/event.entity";
import { CreateEventInput, normalizeStreamUrl } from "../event/event.service";
import { assertImageExists } from "../event/image.util";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import { isSharedInstallation } from "../github-api/installation-sharing";
import type { PresetSettingsDto } from "./dtos/preset-settings.dto";
import {
  CreatePresetDto,
  PRESET_NAME_MAX_LENGTH,
  UpdatePresetDto,
} from "./dtos/save-preset.dto";
import {
  EventPresetEntity,
  PresetStarterTemplate,
} from "./entities/event-preset.entity";
import { mergeEventSettings } from "./preset-merge";
import {
  ResolvedPresetValues,
  resolvePresetSettings,
  scheduleHours,
} from "./preset-resolver";

export const PRESET_CHANGED_MESSAGE = "Preset was changed by someone else";

type UserSummary = { id: string; username: string } | null;
type InstallationSummary = { id: string; accountLogin: string } | null;

/** A preset organizers can pick. */
export interface PresetOption {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  version: number;
  updatedAt: Date;
}

/** What a create form starts from: the preset's values for an event created now. */
export interface ResolvedPreset {
  presetId: string;
  presetVersion: number;
  values: ResolvedPresetValues;
  starterTemplates: PresetStarterTemplate[];
  /** Null when the preset has none, or it is no longer shared. */
  githubInstallation: InstallationSummary;
}

/** A preset as the admin list shows it. */
export interface AdminPresetRow {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  archivedAt: Date | null;
  version: number;
  updatedAt: Date;
  updatedBy: UserSummary;
  /** Events created from the preset. */
  eventCount: number;
}

/** A preset with everything the admin editor needs. */
export interface PresetDetail {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  archivedAt: Date | null;
  version: number;
  settings: PresetSettingsDto;
  starterTemplates: PresetStarterTemplate[];
  githubInstallation: InstallationSummary;
  createdAt: Date;
  updatedAt: Date;
}

export function presetNotFound() {
  return new NotFoundException("Preset not found");
}

/** Unique violations raced past the checks, as 409s. */
function presetConflict(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const { code, constraint } = error.driverError as {
      code?: string;
      constraint?: string;
    };
    if (code === "23505" && constraint === "UQ_event_presets_name")
      throw new ConflictException("A preset with this name already exists");
    if (code === "23505" && constraint === "UQ_event_presets_default")
      throw new ConflictException(
        "Another preset became the default at the same time. Reload and try again.",
      );
  }
  throw error;
}

function toTemplates(
  templates: readonly PresetStarterTemplate[],
): PresetStarterTemplate[] {
  return templates.map(({ name, basePath, myCoreBotDockerImage }) => ({
    name,
    basePath,
    myCoreBotDockerImage,
  }));
}

/** The validated settings as plain JSON, without undefined fields. */
function toStoredSettings(settings: PresetSettingsDto): PresetSettingsDto {
  return JSON.parse(JSON.stringify(settings)) as PresetSettingsDto;
}

/** "<name> (copy)", or "(copy 2)" and up when taken, within the name limit. */
export function copyName(name: string, taken: ReadonlySet<string>) {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const base = name
      .slice(0, PRESET_NAME_MAX_LENGTH - suffix.length)
      .trimEnd();
    if (!taken.has(base + suffix)) return base + suffix;
  }
}

@Injectable()
export class EventPresetsService {
  private readonly logger = new Logger(EventPresetsService.name);

  constructor(private readonly dataSource: DataSource) {}

  private get presets() {
    return this.dataSource.getRepository(EventPresetEntity);
  }

  /** Presets that are not archived, the default first. */
  async listForOrganizers(): Promise<PresetOption[]> {
    const presets = await this.presets.find({
      where: { archivedAt: IsNull() },
      order: { isDefault: "DESC", name: "ASC" },
    });
    return presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      isDefault: preset.isDefault,
      version: preset.version,
      updatedAt: preset.updatedAt,
    }));
  }

  /** An archived preset answers 404, as for an unknown one. */
  async getResolved(id: string, now?: Date): Promise<ResolvedPreset> {
    const preset = await this.presets.findOne({
      where: { id, archivedAt: IsNull() },
      relations: { githubInstallation: true },
    });
    if (!preset) throw presetNotFound();
    return this.resolve(preset, now);
  }

  /**
   * The input for EventService.createEvent: the request merged onto the
   * named preset, or the default one, resolved for an event created now.
   * The request's starter templates and installation replace the preset's.
   */
  async prepareEvent(
    dto: CreateEventDto,
    now?: Date,
  ): Promise<Omit<CreateEventInput, "userId">> {
    const preset = await this.presets.findOne({
      where: dto.presetId
        ? { id: dto.presetId, archivedAt: IsNull() }
        : { isDefault: true },
      relations: { githubInstallation: true },
    });
    if (!preset) {
      if (dto.presetId) throw presetNotFound();
      throw new BadRequestException(
        "There is no default preset. Choose a preset.",
      );
    }
    const resolved = this.resolve(preset, now);
    return {
      settings: await mergeEventSettings(resolved.values, dto),
      presetId: preset.id,
      presetVersion: preset.version,
      starterTemplates: dto.starterTemplates ?? resolved.starterTemplates,
      githubInstallationId:
        dto.githubInstallationId !== undefined
          ? dto.githubInstallationId
          : (resolved.githubInstallation?.id ?? null),
    };
  }

  private resolve(preset: EventPresetEntity, now?: Date): ResolvedPreset {
    const installation = preset.githubInstallation;
    return {
      presetId: preset.id,
      presetVersion: preset.version,
      values: resolvePresetSettings(preset.settings, now),
      starterTemplates: toTemplates(preset.starterTemplates),
      githubInstallation: isSharedInstallation(installation)
        ? { id: installation.id, accountLogin: installation.accountLogin }
        : null,
    };
  }

  async listForAdmin(includeArchived: boolean): Promise<AdminPresetRow[]> {
    const presets = await this.presets.find({
      where: includeArchived ? {} : { archivedAt: IsNull() },
      relations: { updatedBy: true },
      order: { isDefault: "DESC", name: "ASC" },
    });
    const counts = presets.length
      ? await this.dataSource
          .getRepository(EventEntity)
          .createQueryBuilder("event")
          .select('event."presetId"', "id")
          .addSelect("COUNT(*)::int", "count")
          .where({ presetId: In(presets.map((preset) => preset.id)) })
          .groupBy('event."presetId"')
          .getRawMany<{ id: string; count: number }>()
      : [];
    const eventCounts = new Map(counts.map(({ id, count }) => [id, count]));
    return presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      isDefault: preset.isDefault,
      archivedAt: preset.archivedAt,
      version: preset.version,
      updatedAt: preset.updatedAt,
      updatedBy: preset.updatedBy && {
        id: preset.updatedBy.id,
        username: preset.updatedBy.username,
      },
      eventCount: eventCounts.get(preset.id) ?? 0,
    }));
  }

  async getDetail(id: string): Promise<PresetDetail> {
    const preset = await this.presets.findOne({
      where: { id },
      relations: { githubInstallation: true },
    });
    if (!preset) throw presetNotFound();
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      isDefault: preset.isDefault,
      archivedAt: preset.archivedAt,
      version: preset.version,
      settings: preset.settings,
      starterTemplates: preset.starterTemplates,
      githubInstallation: preset.githubInstallation && {
        id: preset.githubInstallation.id,
        accountLogin: preset.githubInstallation.accountLogin,
      },
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    };
  }

  async create(dto: CreatePresetDto, userId: string): Promise<PresetDetail> {
    await this.assertUsable(dto);
    const id = await this.dataSource
      .transaction(async (manager) => {
        await this.assertLinkable(manager, dto.githubInstallationId ?? null);
        if (dto.isDefault) await this.clearDefault(manager, userId);
        const { identifiers } = await manager
          .getRepository(EventPresetEntity)
          .insert({
            name: dto.name,
            description: dto.description ?? null,
            isDefault: dto.isDefault ?? false,
            settings: toStoredSettings(dto.settings),
            starterTemplates: toTemplates(dto.starterTemplates ?? []),
            githubInstallationId: dto.githubInstallationId ?? null,
            createdById: userId,
            updatedById: userId,
          });
        return identifiers[0].id as string;
      })
      .catch(presetConflict);
    this.logger.log({ action: "create_event_preset", userId, presetId: id });
    return this.getDetail(id);
  }

  /** Replaces the preset if `dto.version` is still current, and bumps it. */
  async update(
    id: string,
    dto: UpdatePresetDto,
    userId: string,
  ): Promise<PresetDetail> {
    await this.assertUsable(dto);
    await this.dataSource
      .transaction(async (manager) => {
        const current = await this.lockPreset(manager, id);
        if (current.version !== dto.version)
          throw new ConflictException(PRESET_CHANGED_MESSAGE);
        const isDefault = dto.isDefault ?? current.isDefault;
        if (isDefault && current.archivedAt)
          throw new ConflictException(
            "An archived preset cannot be the default. Unarchive it first.",
          );
        if (dto.githubInstallationId !== undefined)
          await this.assertLinkable(manager, dto.githubInstallationId);
        if (isDefault && !current.isDefault)
          await this.clearDefault(manager, userId, id);
        await manager.getRepository(EventPresetEntity).update(id, {
          name: dto.name,
          description:
            dto.description !== undefined
              ? dto.description
              : current.description,
          isDefault,
          settings: toStoredSettings(dto.settings),
          starterTemplates: dto.starterTemplates
            ? toTemplates(dto.starterTemplates)
            : current.starterTemplates,
          githubInstallationId:
            dto.githubInstallationId !== undefined
              ? dto.githubInstallationId
              : current.githubInstallationId,
          version: current.version + 1,
          updatedById: userId,
        });
      })
      .catch(presetConflict);
    this.logger.log({ action: "update_event_preset", userId, presetId: id });
    return this.getDetail(id);
  }

  /** A copy that is not the default, named after the original. */
  async duplicate(id: string, userId: string): Promise<PresetDetail> {
    const source = await this.presets.findOneBy({ id });
    if (!source) throw presetNotFound();
    const taken = new Set(
      (await this.presets.find({ select: { name: true } })).map(
        ({ name }) => name,
      ),
    );
    const { identifiers } = await this.presets
      .insert({
        name: copyName(source.name, taken),
        description: source.description,
        isDefault: false,
        settings: source.settings,
        starterTemplates: source.starterTemplates,
        githubInstallationId: source.githubInstallationId,
        createdById: userId,
        updatedById: userId,
      })
      .catch(presetConflict);
    const copyId = identifiers[0].id as string;
    this.logger.log({
      action: "duplicate_event_preset",
      userId,
      presetId: id,
      copyId,
    });
    return this.getDetail(copyId);
  }

  /** Hides the preset from organizers; the default cannot be archived. */
  archive(id: string, userId: string) {
    return this.setArchived(id, userId, true);
  }

  unarchive(id: string, userId: string) {
    return this.setArchived(id, userId, false);
  }

  private async setArchived(id: string, userId: string, archived: boolean) {
    await this.dataSource.transaction(async (manager) => {
      const current = await this.lockPreset(manager, id);
      if (!!current.archivedAt === archived) return;
      if (archived && current.isDefault)
        throw new ConflictException(
          "The default preset cannot be archived. Make another preset the default first.",
        );
      await manager.getRepository(EventPresetEntity).update(id, {
        archivedAt: archived ? new Date() : null,
        version: current.version + 1,
        updatedById: userId,
      });
      this.logger.log({
        action: archived ? "archive_event_preset" : "unarchive_event_preset",
        userId,
        presetId: id,
      });
    });
    return this.getDetail(id);
  }

  private async lockPreset(manager: EntityManager, id: string) {
    const preset = await manager.getRepository(EventPresetEntity).findOne({
      where: { id },
      lock: { mode: "pessimistic_write" },
    });
    if (!preset) throw presetNotFound();
    return preset;
  }

  /** Unsets the current default (other than `exceptId`), bumping its version. */
  private async clearDefault(
    manager: EntityManager,
    userId: string,
    exceptId?: string,
  ) {
    const update = manager
      .createQueryBuilder()
      .update(EventPresetEntity)
      .set({
        isDefault: false,
        version: () => '"version" + 1',
        updatedById: userId,
      })
      .where(`"isDefault"`);
    if (exceptId) update.andWhere("id <> :exceptId", { exceptId });
    await update.execute();
  }

  /** A preset may only link an installation that is shared. */
  private async assertLinkable(
    manager: EntityManager,
    installationId: string | null,
  ) {
    if (!installationId) return;
    const installation = await manager
      .getRepository(GithubInstallationEntity)
      .findOne({
        where: { id: installationId },
        lock: { mode: "pessimistic_read" },
      });
    if (!isSharedInstallation(installation))
      throw new BadRequestException(
        "A preset can only use a GitHub installation that a global admin shared.",
      );
  }

  /**
   * Checks what the DTO validators cannot: events created from the preset
   * must pass the create checks, so a preset that always fails is refused.
   */
  private async assertUsable(dto: CreatePresetDto) {
    const { settings } = dto;
    if (scheduleHours(settings.schedule).submissionDeadline <= 0)
      throw new BadRequestException(
        "The submission deadline must be after the start.",
      );
    normalizeStreamUrl(settings.streamUrl ?? undefined);
    normalizeStreamUrl(
      settings.showtimeStreamUrl ?? undefined,
      "showtimeStreamUrl",
    );
    const images = new Set([
      settings.gameServerDockerImage,
      settings.myCoreBotDockerImage,
      settings.visualizerDockerImage,
      ...(dto.starterTemplates ?? []).map(
        (template) => template.myCoreBotDockerImage,
      ),
    ]);
    await Promise.all([...images].map(assertImageExists));
  }
}
