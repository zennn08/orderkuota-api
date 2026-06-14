export interface Config {
  port: number;
  apiKey: string;
  dbPath: string;
  docsPublic: boolean;
}

export function loadConfig(env: Record<string, string | undefined> = Bun.env): Config {
  const apiKey = env.API_KEY?.trim();
  if (!apiKey) {
    throw new Error('API_KEY is required (set it in .env). See .env.example.');
  }
  return {
    apiKey,
    port: env.PORT ? parseInt(env.PORT, 10) : 3000,
    dbPath: env.DB_PATH?.trim() || './data/orkut.db',
    docsPublic: (env.DOCS_PUBLIC ?? 'true').toLowerCase() !== 'false',
  };
}
