import { type Client } from "@octopusdeploy/api-client";

export interface CurrentUser {
  Id: string;
  Username: string;
  DisplayName: string;
  IsActive: boolean;
  IsService: boolean;
  EmailAddress: string;
  CanPasswordBeEdited: boolean;
  IsRequestor: boolean;
}

const CACHE_TTL = 3600000;

let cached: { user: CurrentUser; timestamp: number } | undefined;

export async function getCurrentUserCached(client: Client): Promise<CurrentUser> {
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }

  const user = await client.get<CurrentUser>("~/api/users/me");
  cached = { user, timestamp: now };
  return user;
}

export function clearUserCache(): void {
  cached = undefined;
}
