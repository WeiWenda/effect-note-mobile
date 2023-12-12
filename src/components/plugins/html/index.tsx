import * as React from 'react'; // tslint:disable-line no-unused-variable

import {Token, RegexTokenizerSplitter, EmitFn, Tokenizer, Session, Path} from '../../../ts';
import { registerPlugin } from '../../../ts/plugins';
import Highlight from 'react-highlight';
import {EditOutlined} from '@ant-design/icons';
import {htmlRegex, htmlTypes} from '../../../ts/utils/util';
import {LinksPlugin, linksPluginName} from '../links';

export function htmlHook(tokenizer: any, info: { session: Session, editDisable: boolean, path: Path }) {
  // if (info.has_cursor && !info.lockEdit) {
  //   return tokenizer;
  // }
  // if (info.has_highlight && !info.lockEdit) {
  //   return tokenizer;
  // }
  const session: Session = info.session;
  return tokenizer.then(RegexTokenizerSplitter(
    new RegExp(htmlRegex),
    (token: Token, emit: EmitFn<React.ReactNode>, wrapped: Tokenizer) => {
      try {
        const textContent = new RegExp(htmlRegex).exec(token.text);
        if (textContent && textContent[4] && !info.editDisable) {
          emit(
            <span key={`html-${token.index}`}
              dangerouslySetInnerHTML={{__html: token.text}}
            />
          );
        } else if (textContent && textContent[9] && !info.editDisable) {
          emit(
            <span key={`html-${token.index}`}
              dangerouslySetInnerHTML={{__html: token.text}}
            />
          );
        } else {
          emit(<span
            key={`html-${token.index}`}
            className={'node-html'}
            dangerouslySetInnerHTML={{__html: token.text}}
          />);
        }
      } catch (e: any) {
        session.showMessage(e.message, { text_class: 'error' });
        emit(...wrapped.unfold(token));
      }
    }
  ));
};

registerPlugin(
  {
    name: 'HTML',
    author: 'Jeff Wu',
    description: `
      Lets you inline the following html tags:
        ${ htmlTypes.map((htmltype) => '<' + htmltype + '>').join(' ') }
    `,
    dependencies: [linksPluginName],
  },
  function(api) {
    api.registerHook('session', 'renderLineTokenHook', htmlHook);
    api.registerHook('session', 'renderAfterLine', (elements, {path, pluginData, line, session}) => {
      if (pluginData.links?.rtf) {
        const htmlContent = pluginData.links?.rtf;
        elements.push(
          <Highlight key={`html-${path.row}`} innerHTML={true}>
            {htmlContent}
          </Highlight>
        );
      }
      return elements;
    });
  },
  (api => api.deregisterAll()),
);
