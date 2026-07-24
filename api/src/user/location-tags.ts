import { SocialPlatform } from "./entities/social-account.entity";

export interface LocationTagSource {
  platform: SocialPlatform | string;
  campusName: string | null;
}

export interface OwnedLocationTagSource extends LocationTagSource {
  ownerId: string;
}

function normalizeTagPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createLocationTag({
  platform,
  campusName,
}: LocationTagSource): string | null {
  if (!campusName) return null;

  const source = normalizeTagPart(platform);
  const campus = normalizeTagPart(campusName);
  if (!source || !campus) return null;

  return `${source}-${campus}`;
}

export function getLocationTags(accounts: LocationTagSource[]): string[] {
  return Array.from(
    new Set(
      accounts
        .map(createLocationTag)
        .filter((tag): tag is string => tag !== null),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function groupLocationTagsByOwner(
  ownerIds: string[],
  accounts: OwnedLocationTagSource[],
): Map<string, string[]> {
  const accountsByOwner = new Map<string, LocationTagSource[]>();

  for (const ownerId of ownerIds) accountsByOwner.set(ownerId, []);
  for (const account of accounts) {
    const ownerAccounts = accountsByOwner.get(account.ownerId);
    if (ownerAccounts) ownerAccounts.push(account);
  }

  return new Map(
    Array.from(accountsByOwner, ([ownerId, ownerAccounts]) => [
      ownerId,
      getLocationTags(ownerAccounts),
    ]),
  );
}
