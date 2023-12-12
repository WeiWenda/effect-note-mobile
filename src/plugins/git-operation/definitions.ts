import type { PluginListenerHandle } from '@capacitor/core';

export interface GitOperationPlugin {
  gitClone(options: {gitLocalDir: string, gitRemote: string, gitUsername: string, gitPassword: string}): Promise<void>;

  listFiles(optoins: {workspace: string}): Promise<{ data: string[] }>;

  blobContent(options: {workspace: string, path: string}): Promise<{data: string}>;

  updateContent(options: {workspace: string, path: string, content: string}): Promise<void>;

  gitPull(options: {workspace: string}): Promise<{ data: number}>;
  /**
   * Removes all listeners
   */
  removeAllListeners(): Promise<void>;
}
