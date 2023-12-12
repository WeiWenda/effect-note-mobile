import * as React from 'react'; // tslint:disable-line no-unused-variable
import {registerPlugin} from '../../../ts/plugins';
import {LinksPlugin, linksPluginName} from '../links';
import {Input, Select, Space, Tooltip} from 'antd';
import {EmitFn, PartialUnfolder, Token, Tokenizer} from '../../../ts';
import $ from "jquery";
import Vditor from "vditor";

const languages = ['plaintext', 'c', 'java', 'scala', 'shell', 'python', 'json', 'sql',
  'xml', 'yaml', 'go', 'php', 'typescript', 'javascript'];
registerPlugin(
  {
    name: 'CodeSnippet',
    author: 'Jeff Wu',
    description: 'Lets you inline markdown content',
    dependencies: [linksPluginName],
  },
  function(api) {
    const linksPlugin = api.getPlugin(linksPluginName) as LinksPlugin;
    api.registerHook('session', 'renderAfterLine', (elements, {path, pluginData, line}) => {
      if (pluginData.links?.code) {
        const id = `vditor-${path.row}`;
        const mdCode = '```' + pluginData.links.code.language + '\n'
            + pluginData.links.code.content + '\n'
            + '```'
        elements.push(
            <div id={id} className={'node-markdown'} key={id}/>
        );
        setTimeout(() => {
          const divs = $(`#${id}`).get();
          const mode = api.session.clientStore.getClientSetting('curTheme').includes('Dark') ? 'dark' : 'light';
          if (divs.length > 0) {
            Vditor.preview(divs[0] as HTMLDivElement, mdCode, {mode,
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
      return elements;
    });
  },
  (api => api.deregisterAll()),
);
