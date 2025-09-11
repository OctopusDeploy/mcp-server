export interface ResourceWithId<TLinks = {}> {
    Id: string;
    Links: TLinks;
}

export interface NamedResource<TLinks = {}> extends ResourceWithId<TLinks> {
    Name: string;
}

export interface SpaceScopedResource {
    SpaceId: string;
}

export interface ResourceWithSlug {
    Slug?: string;
}