export function getEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

export function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
