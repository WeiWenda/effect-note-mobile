import { registerPlugin } from '@capacitor/core';

import type { GitOperationPlugin } from './definitions';

const GitOperation = registerPlugin<GitOperationPlugin>(
    'GitOperation',
);

export * from './definitions';
export { GitOperation };
