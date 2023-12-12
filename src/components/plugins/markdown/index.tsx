import * as React from 'react'; // tslint:disable-line no-unused-variable
import {registerPlugin} from '../../../ts/plugins';
import {LinksPlugin, linksPluginName} from '../links';
import Vditor from 'vditor';
import $ from 'jquery';

registerPlugin(
  {
    name: 'Markdown',
    author: 'Jeff Wu',
    description: 'Lets you inline markdown content',
    dependencies: [linksPluginName],
  },
  function(api) {
    const linksPlugin = api.getPlugin(linksPluginName) as LinksPlugin;
    api.registerHook('session', 'renderAfterLine', (elements, {path, line, pluginData}) => {
      if (pluginData.links?.md) {
        const id = `vditor-${path.row}`;
        const vditorDiv = (
            <div id={id} className={'node-markdown'} key={id}/>
        );
        setTimeout(() => {
          const divs = $(`#${id}`).get();
          const mode = api.session.clientStore.getClientSetting('curTheme').includes('Dark') ? 'dark' : 'light';
          if (divs.length > 0) {
            Vditor.preview(divs[0] as HTMLDivElement, pluginData.links.md, {mode,
              hljs: {
                lineNumber: true
              },
              transform: (html: string) => {
                return html.replace('<a ', '<a target="_blank" ');
              },
              theme : {
                current: mode,
                path: 'content-theme'
              }});
          }
        }, 100);
        elements.push(vditorDiv);
      }
      return elements;
    });
  },
  (api => api.deregisterAll()),
);
