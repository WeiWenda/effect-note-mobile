import { LoomState } from './loom-state';

export const serializeState = (state: LoomState): string => {
  // Filter out any source rows, as these are populated by the plugin
  const filteredRows = state.model.rows.filter(
    (row) => row.sourceId === null
  );
  const filteredState = {
    ...state,
    model: {
      ...state.model,
      rows: filteredRows,
    },
  };
  return JSON.stringify(filteredState, null, 2);
};

export const deserializeState = (
  data: string,
  pluginVersion: string
): LoomState => {
  try {
    const parsedState = JSON.parse(data);
    const state = parsedState as LoomState;
    state.pluginVersion = pluginVersion;
    return state;
  } catch (err: unknown) {
    throw err;
  }
};
