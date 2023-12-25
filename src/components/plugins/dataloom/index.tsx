import * as React from 'react'; // tslint:disable-line no-unused-variable
import { registerPlugin } from '../../../ts/plugins';
import {linksPluginName} from '../links';
import {deserializeState, serializeState} from './serialize-state';
import $ from "jquery";
import Vditor from "vditor";
import {exportToMarkdown} from "./export-to-markdown";

registerPlugin(
  {
    name: 'DataLoom',
    author: 'Wei Wenda',
    description: 'Lets you inline dataloom content',
    dependencies: [linksPluginName],
  },
  function(api) {
    api.registerHook('session', 'renderAfterLine', (elements, {path, pluginData, line}) => {
      if (pluginData.links?.dataloom) {
        const pluginVersion = '8.15.10';
        if (pluginData.links.dataloom.content) {
          const loomState = deserializeState(pluginData.links.dataloom.content, pluginVersion);
          const content = exportToMarkdown(loomState, false);
          const id = `dataloom-${path.row}`;
          elements.push(
            <div id={id} className={'node-markdown'} key={id}/>
          );
          setTimeout(() => {
            const divs = $(`#${id}`).get();
            const mode = api.session.clientStore.getClientSetting('curTheme').includes('Dark') ? 'dark' : 'light';
            if (divs.length > 0) {
              Vditor.preview(divs[0] as HTMLDivElement, content, {mode,
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
        }
      }
      return elements;
    });
  },
  (api => api.deregisterAll()),
);
