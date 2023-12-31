import { Theme } from './themes';

// server-side configuration of client code
export type ServerConfig = {
  socketserver?: boolean,
  workspaces?: WorkSpaceInfo[],
  themes?: {[key: string]: Theme},
};
export type WorkSpaceInfo = {
  active?: boolean,
  gitRemote?: string,
  gitLocalDir?: string,
  gitUsername?: string,
  gitDepth?: number,
  gitPassword?: string,
  sycType?: string
};

export const EMPTY_WORKSPACE_INFO: WorkSpaceInfo = {
  active: false,
  gitRemote: 'https://gitee.com/xxx/xxx',
  sycType: 'never',
  gitLocalDir: '未配置',
  gitUsername: '未配置',
  gitDepth: 100,
  gitPassword: '未配置'
};
