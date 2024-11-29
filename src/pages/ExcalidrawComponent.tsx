import {Session} from "../ts";
import {EventEmitter} from "ahooks/lib/useEventEmitter";
import {Children, cloneElement, useRef, useState} from "react";
import {ExcalidrawImperativeAPI, ExcalidrawInitialDataState} from "@excalidraw/excalidraw/types/types";
import {resolvablePromise, ResolvablePromise} from "../ts/utils/excalidraw_utils";
import type * as TExcalidraw from '@excalidraw/excalidraw';
import {SessionComponent} from "../components";

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
  const [editingElementText, setEditingElementText] = useState<string>('节点详情');
  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

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
        excalidrawAPI: (api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api),
        initialData: initialStatePromiseRef.current.promise,
        validateEmbeddable: true,
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
            style={{height: '100%'}}
          >
            <SessionComponent session={props.session}/>
          </div>
        </Sidebar>
      </>,
    );
    return newElement;
  };
  return (
    <div className='App' ref={appRef}>
      <div className='excalidraw-wrapper'>
        {renderExcalidraw(props.children)}
      </div>
    </div>
  );
}
