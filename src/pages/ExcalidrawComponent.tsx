import {config, DocInfo, InMemory, Path, Session} from "../ts";
import {EventEmitter} from "ahooks/lib/useEventEmitter";
import React, {Children, cloneElement, useCallback, useEffect, useRef, useState} from "react";
import {ExcalidrawImperativeAPI, ExcalidrawInitialDataState} from "@excalidraw/excalidraw/types/types";
import {getBoundTextOrDefault, resolvablePromise, ResolvablePromise} from "../ts/utils/excalidraw_utils";
import type * as TExcalidraw from '@excalidraw/excalidraw';
import {SessionComponent} from "../components";
import '../assets/css/excalidraw.scss';
import defaultDraw from './example.excalidraw.json';
import {ExcalidrawElement, NonDeletedExcalidrawElement} from "@excalidraw/excalidraw/types/element/types";
import {mimetypeLookup} from "../ts/utils/util";
import {IonPage} from "@ionic/react";
import {GitOperation} from "../plugins/git-operation";
import {Preferences} from "@capacitor/preferences";
import {restoreElements} from "@excalidraw/excalidraw";

export function ExcalidrawComponent(props: {
  session: Session,
  eventBus: EventEmitter<{[key: string]: string}>,
  excalidrawLib: typeof TExcalidraw,
  children: React.ReactNode}) {
  const {
    Sidebar,
    WelcomeScreen
  } = props.excalidrawLib;
  const appRef = useRef<any>(null);
  const [selectNodeId, setSelectNodeId] = useState<string>('');
  const [editingDocId, setEditingDocId] = useState<number>(-3);
  const [initialized, setInitialized] = React.useState(false);
  const [editingElementText, setEditingElementText] = useState<string>('节点详情');
  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  const reloadContent = async (docInfo: DocInfo, checkRemoteUpdate: boolean) => {
    const workspace = await Preferences.get({ key: 'workspace' });
    const savedContent = await GitOperation.blobContent({workspace: workspace.value ?? 'default', path: docInfo.filepath!}).then(r => {
      return JSON.parse(r.data)
    }).catch(e => {
      return defaultDraw;
    });
    const elements = savedContent.elements as readonly ExcalidrawElement[];
    const restoreElements1 = restoreElements(elements, null)
    if (!initialized) {
      initialStatePromiseRef.current.promise.resolve({
        libraryItems: [],
        scrollToContent: true,
        appState: {
          activeTool: {lastActiveTool: null, locked: false, type: "hand", customType: null},
          currentItemFontFamily: savedContent.appState?.currentItemFontFamily ?? 2,
          viewBackgroundColor: savedContent.appState?.viewBackgroundColor ?? props.session.clientStore.getClientSetting('theme-bg-primary')
        },
        elements: restoreElements1
      });
      setInitialized(true);
    } else {
      excalidrawAPI?.setActiveTool({ type: "hand" })
      // @ts-ignore
      excalidrawAPI?.updateScene({
        elements: restoreElements1, appState: {
          currentItemFontFamily: savedContent.appState?.currentItemFontFamily ?? 2,
          viewBackgroundColor: savedContent.appState?.viewBackgroundColor ?? props.session.clientStore.getClientSetting('theme-bg-primary')
        }
      });
      setTimeout(() => {
        excalidrawAPI?.scrollToContent(restoreElements1, {fitToContent: true})
      }, 500)
    }
  }
  props.eventBus.useSubscription(val => {
    if (val['action'] === 'open_file') {
      const docInfo = JSON.parse(val['docInfo']) as DocInfo
      if (docInfo.filepath?.endsWith('.excalidraw')) {
        reloadContent(docInfo, true)
      }
    }
  })
  const loadDoc = async (docInfo: DocInfo, docContent: string) => {
    const docID = docInfo.id!;
    const newDocName = docID.toString();
    props.session.clientStore.setClientSetting('curDocId', docID);
    props.session.clientStore.setDocname(docID);
    props.session.document.store.setBackend(new InMemory(), newDocName);
    props.session.document.root = Path.root();
    props.session.cursor.reset();
    props.session.stopAnchor();
    props.session.search = null;
    await props.session.emitAsync('clearPluginStatus');
    await props.session.changeViewRoot(Path.root());
    await props.session.reloadContent(docContent, mimetypeLookup(docInfo.filename!));
    props.session.reset_history();
    props.session.reset_jump_history();
  }
  const handleLinkOpen = useCallback((element: NonDeletedExcalidrawElement) => {
    if (element.link) {
      const link = element.link;
      if (link === '点击查看节点详情' && element.customData && element.customData.detail) {
        loadDoc({id: -3, filename: '1.json'}, element.customData.detail).then(() => {
          props.session.changeViewRoot(Path.root()).then(() => {
            setTimeout(() => {
              setSelectNodeId(element.id);
              setEditingElementText(getBoundTextOrDefault(element,  excalidrawAPI?.getSceneElements(), '节点详情'));
              excalidrawAPI?.updateScene({appState: {openSidebar: { name: 'node-content'}}});
            });
          });
        });
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }, [excalidrawAPI, selectNodeId, editingDocId]);
  const onLinkOpen = (
    element: NonDeletedExcalidrawElement,
    event: CustomEvent<{
      nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement>;
    }>
  ) => {
    const { nativeEvent } = event.detail;
    const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
    const isNewWindow = nativeEvent.shiftKey;
    if (isNewTab || isNewWindow) {
      return;
    }
    if (handleLinkOpen(element)) {
      event.preventDefault();
    }
  };
  const renderExcalidraw = (children: React.ReactNode) => {
    const Excalidraw: any = Children.toArray(children).find(
      (child) =>
        React.isValidElement(child) &&
        typeof child.type !== 'string' &&
        // @ts-ignore
        child.type.displayName === 'Excalidraw',
    );
    if (!Excalidraw) {
      return;
    }
    const newElement = cloneElement(
      Excalidraw,
      {
        theme: props.session.clientStore.getClientSetting('curTheme') === 'Default' ? 'light' : 'dark',
        langCode: 'zh-CN',
        // viewModeEnabled: true,
        excalidrawAPI: (api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api),
        initialData: initialStatePromiseRef.current.promise,
        validateEmbeddable: true,
        onLinkOpen
      },
      <>
        <WelcomeScreen />
        <Sidebar name='node-content' className={'excalidraw-node-content'}>
          <Sidebar.Header >
            <div
              style={{
                color: 'var(--color-primary)',
                fontSize: '1.2em',
                fontWeight: 'bold',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                paddingRight: '1em',
              }}
            >
              {editingElementText}
            </div>
          </Sidebar.Header>
          <div
            style={{height: '100%', overflow: 'auto'}}
          >
            <SessionComponent session={props.session}/>
          </div>
        </Sidebar>
      </>,
    );
    return newElement;
  };
  return (
    <IonPage id="main-content">
      <div className='App' ref={appRef}>
        <div className='excalidraw-wrapper'>
          {renderExcalidraw(props.children)}
        </div>
      </div>
    </IonPage>
  );
}
