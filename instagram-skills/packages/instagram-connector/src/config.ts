export interface InstagramConnectorCliConfig {
  runtimeRoot?: string;
  gradleCommand?: string;
  adbPath?: string;
  adbSerial?: string;
  artifactDir?: string;
  commandTimeoutMs?: number;
  waitTimeoutMs?: number;
  deadlineMs?: number;
  adbKeyboardIme?: string;
  adbKeyboardInputAction?: string;
}

export interface InstagramConnectorCommandConfig {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cleanupPaths?: string[];
}

export const INSTAGRAM_CONNECTOR_GRADLE_TASK = ":instagram-connector:invokeLocalInstagramRuntime";
