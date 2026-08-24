export type InstagramProviderId = "aiograpi-rest" | "official-api" | "connector";

export interface SessionRegistryRecord {
  sessionRef: string;
  accountId: string;
  providerId: InstagramProviderId;
  sessionType: string;
  status: "active" | "disabled" | "expired";
}

export interface AiograpiSession {
  sessionRef: string;
  aiograpiSessionId: string;
  baseUrl?: string;
}

export interface OfficialApiSession {
  sessionRef: string;
  igUserId: string;
  accessTokenCiphertext: string;
  expiresAt?: string;
  scopes?: string;
}

export interface ConnectorRuntimeSession {
  sessionRef: string;
  adbSerial?: string;
  runtimeHost?: string;
  artifactDir?: string;
  deviceLabel?: string;
}

export interface InstagramSessionStore {
  getRegistry(sessionRef: string): Promise<SessionRegistryRecord>;
  resolveAiograpi(sessionRef: string): Promise<AiograpiSession>;
  resolveOfficialApi(sessionRef: string): Promise<OfficialApiSession>;
  resolveConnectorRuntime(sessionRef: string): Promise<ConnectorRuntimeSession>;
}
