import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod/v3";

const traitsSchema = z.object({
  humor: z.number().min(0).max(100),
  curiosity: z.number().min(0).max(100),
  adventure: z.number().min(0).max(100),
  calm: z.number().min(0).max(100),
  planning: z.number().min(0).max(100),
});

const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  tagline: z.string().min(1),
  ageRange: z.string().min(1),
  city: z.string().min(1),
  interests: z.array(z.string().min(1)).min(1),
  values: z.array(z.string().min(1)).min(1),
  communicationStyle: z.string().min(1),
  lifestyle: z.string().min(1),
  relationshipIntent: z.string().min(1),
  dealBreakers: z.array(z.string().min(1)),
  traits: traitsSchema,
});

const profilesSchema = z.array(profileSchema).min(5);

const userMapSchema = z.object({
  defaultViewerProfileId: z.string().min(1),
  aliases: z.record(z.string(), z.string().min(1)).default({}),
});

const acceptedMatchSchema = z.object({
  matchSessionId: z.string().min(1),
  viewerProfileId: z.string().min(1),
  selectedProfileId: z.string().min(1),
  acceptedAt: z.string().min(1),
  acceptedPlanTitle: z.string().min(1),
});

const acceptedMatchesSchema = z.array(acceptedMatchSchema);

export type Profile = z.infer<typeof profileSchema>;
export type Traits = z.infer<typeof traitsSchema>;
export type AcceptedMatch = z.infer<typeof acceptedMatchSchema>;

type UserMap = z.infer<typeof userMapSchema>;

const utilsDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(utilsDir, "..", "data");

const profilesPath = path.join(dataDir, "profiles.json");
const userMapPath = path.join(dataDir, "user-map.json");
const acceptedMatchesPath = path.join(dataDir, "accepted-matches.json");

function readJsonFile<T>(filePath: string, schema: z.ZodType<T>): T {
  const contents = fs.readFileSync(filePath, "utf8");
  return schema.parse(JSON.parse(contents));
}

export function readProfiles(): Profile[] {
  return readJsonFile(profilesPath, profilesSchema);
}

function readUserMap(): UserMap {
  const parsed = readJsonFile(userMapPath, userMapSchema);
  return {
    defaultViewerProfileId: parsed.defaultViewerProfileId,
    aliases: parsed.aliases ?? {},
  };
}

function readAcceptedMatches(): AcceptedMatch[] {
  if (!fs.existsSync(acceptedMatchesPath)) {
    return [];
  }

  return readJsonFile(acceptedMatchesPath, acceptedMatchesSchema);
}

export function findProfileById(profiles: Profile[], profileId: string): Profile | undefined {
  return profiles.find((profile) => profile.id === profileId);
}

export function resolveViewerProfile(profiles: Profile[], explicitViewerId?: string): Profile {
  const userMap = readUserMap();

  if (explicitViewerId) {
    const directProfile = findProfileById(profiles, explicitViewerId);
    if (directProfile) {
      return directProfile;
    }

    const aliasTarget = userMap.aliases[explicitViewerId.toLowerCase()];
    if (aliasTarget) {
      const aliasProfile = findProfileById(profiles, aliasTarget);
      if (aliasProfile) {
        return aliasProfile;
      }
    }
  }

  const defaultProfile = findProfileById(profiles, userMap.defaultViewerProfileId);
  if (!defaultProfile) {
    throw new Error(
      `Default viewer profile "${userMap.defaultViewerProfileId}" is missing from profiles.json.`,
    );
  }

  return defaultProfile;
}

export function writeAcceptedMatch(record: AcceptedMatch): AcceptedMatch[] {
  const currentMatches = readAcceptedMatches();
  const nextMatches = [...currentMatches, record];
  const validated = acceptedMatchesSchema.parse(nextMatches);

  fs.writeFileSync(acceptedMatchesPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");

  return validated;
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function createAcceptedTimestamp(): string {
  return new Date().toISOString();
}
