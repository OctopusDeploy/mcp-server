export function getPublicUrl(template: string, parameters: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (_, key) => parameters[key] || `{${key}}`);
}