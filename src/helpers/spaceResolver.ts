import { Client, SpaceRepository } from "@octopusdeploy/api-client";

const spaceCache = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export async function resolveSpaceNameFromId(
  client: Client,
  spaceId: string
): Promise<string> {
  const cached = spaceCache.get(spaceId);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.name;
  }

  const spaceRepository = new SpaceRepository(client);
  const space = await spaceRepository.get(spaceId);

  spaceCache.set(spaceId, { name: space.Name, timestamp: now });

  return space.Name;
}

export function clearSpaceCache(): void {
  spaceCache.clear();
}
