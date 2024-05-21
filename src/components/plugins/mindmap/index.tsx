import * as React from 'react'; // tslint:disable-line no-unused-variable
import {PluginApi, registerPlugin} from '../../../ts/plugins';
import {linksPluginName} from '../links';
import {Document, Session} from '../../../ts';
import {Logger} from '../../../ts/logger';

export class MindMapPlugin {
  private api: PluginApi;
  private logger: Logger;
  private session: Session;
  private document: Document;

  constructor(api: PluginApi) {
    this.api = api;
    this.logger = this.api.logger;
    this.session = this.api.session;
    this.document = this.api.session.document;
    // NOTE: this may not be initialized correctly at first
    // this only affects rendering @taglinks for now
  }

  public async enable() {
    this.api.registerHook('session', 'renderAfterLine', (elements, {path, line, pluginData}) => {
      if (pluginData.links?.png != null) {
        elements.push(
            <img
              src={pluginData.links.png.src.startsWith('<svg ') ? `data:image/svg+xml;utf8,${encodeURIComponent(pluginData.links.png.src)}` : pluginData.links.png.src}
            />
        );
      }
      return elements;
    });
  }
}

registerPlugin(
  {
    name: 'MindMap',
    author: 'Jeff Wu',
    description: 'Lets you inline markdown content',
    dependencies: [linksPluginName],
  },
  async (api) => {
    const mindMapPlugin = new MindMapPlugin(api);
    await mindMapPlugin.enable();
    return mindMapPlugin;
  },
  (api => api.deregisterAll()),
);
