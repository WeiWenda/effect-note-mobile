import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {
  ClientStore,
  config,
  Document,
  DocumentStore,
  IndexedDBBackend, InMemory,
  Session,
  SynchronousLocalStorageBackend
} from "./ts";
import 'font-awesome/css/font-awesome.min.css';
import './assets/css/index.sass';
import 'vditor/dist/index.css';
import localforage from "localforage";
import $ from 'jquery';

const container = document.getElementById('root');
const root = createRoot(container!);
let clientStore: ClientStore = new ClientStore(new SynchronousLocalStorageBackend());
const docname = clientStore.getClientSetting('curDocId').toString();
let docStore: DocumentStore = new DocumentStore(new InMemory(), docname);
const doc = new Document(docStore, docname);
function getLineHeight() {
  const line_height = $('.node-text').height() || 21;
  return line_height;
}
localforage.setDriver(localforage.LOCALSTORAGE);
const session = new Session(clientStore, doc, {
  initialMode: config.defaultMode,
  showMessage: (() => {
    return (messageContent: string, options: {warning?: boolean, time?: number, text_class?: string} = {}) => {
      if (options.warning) {
        // message.warning(messageContent, options.time || 1);
      } else {
        // message.success(messageContent, options.time || 1);
      }
    };
  })(),
  getLinesPerPage: () => {
    const line_height = getLineHeight();
    const page_height = $(document).height() as number;
    return page_height / line_height;
  },
});
$(document).on('click', function(e) {
  // if settings menu is up, we don't want to blur (the dropdowns need focus)
  if (session.mode !== 'INSERT') { return; }
  if (session.stopMonitor) {return;}
  if (session.cursor.path.isRoot()) {return;}
  console.log('document click', e.pageY);
  $('#input-hack').focus();
  session.emit('scrollTo', e.pageY);
});
root.render(
  // <React.StrictMode>
    <App session={session}/>
  // </React.StrictMode>
);
