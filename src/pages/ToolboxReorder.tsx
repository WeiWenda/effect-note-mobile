import React, {useEffect, useState} from 'react';
import {
  IonBackButton,
  IonButtons,
  IonButton,
  IonHeader,
  IonContent,
  IonNavLink,
  IonToolbar,
  IonTitle, IonList, IonReorderGroup, IonItem, IonLabel, IonReorder, IonIcon, ItemReorderEventDetail,
} from '@ionic/react';
import {
  arrowRedoOutline,
  arrowUndoOutline,
  checkboxOutline,
  clipboardOutline,
  copyOutline,
  pricetagsOutline
} from "ionicons/icons";
import {OrderedListOutlined} from "@ant-design/icons";
import {Preferences} from "@capacitor/preferences";
import {EventEmitter} from "ahooks/lib/useEventEmitter";

export type ToolBoxElement = {
  key: string,
  icon: JSX.Element,
  label: string
}
export const defaultSeq: ToolBoxElement[] = [
  {
    key: 'copy',
    icon: (
      <IonIcon style={{height: '22px'}} color="dark" icon={copyOutline}></IonIcon>
    ),
    label: '复制'
  },
  {
    key: 'paste',
    icon: (
      <IonIcon style={{height: '22px'}} color="dark" icon={clipboardOutline}></IonIcon>
    ),
    label: '粘贴'
  },
  {
    key: 'mark-task',
    icon: (
      <IonIcon style={{height: '22px'}} color="dark" icon={checkboxOutline}></IonIcon>
    ),
    label: '标记「任务」'
  },
  {
    key: 'mark-order',
    icon: (
      <OrderedListOutlined style={{fontSize: 22}} />
    ),
    label: '标记「自动编号」'
  },
  {
    key: 'mark-board',
    icon: (
      <img className={'toolbar-img'} src={`images/board.png`}/>
    ),
    label: '标记「看板」'
  },
  {
    key: 'mark-tag',
    icon: (
      <IonIcon style={{height: '22px'}} color="dark" icon={pricetagsOutline}></IonIcon>
    ),
    label: '标记「标签」'
  },
  {
    key: 'mark-quote',
    icon: (
      <img className={'toolbar-img'} src={`images/quote.png`}/>
    ),
    label: '标记「引用」'
  },
  {
    key: 'indent',
    icon: (
      <img className={'toolbar-img'} src={`images/left-indent.png`} />
    ),
    label: '向内缩进'
  },
  {
    key: 'unindent',
    icon: (
      <img className={'toolbar-img'} src={`images/right-indent.png`} />
    ),
    label: '向外缩进'
  },
  {
    key: 'move-down',
    icon: (
      <img className={'toolbar-img'} src={`images/move-down.png`} />
    ),
    label: '向下移动'
  },
  {
    key: 'move-up',
    icon: (
      <img className={'toolbar-img'} src={`images/move-up.png`} />
    ),
    label: '向上移动'
  },
  {
    key: 'undo',
    icon: (
      <IonIcon style={{height: '22px'}} color="dark" icon={arrowUndoOutline}></IonIcon>
    ),
    label: '撤销'
  },
  {
    key: 'redo',
    icon: (
      <IonIcon style={{height: '22px'}} color="dark" icon={arrowRedoOutline}></IonIcon>
    ),
    label: '重做'
  },
];
function ToolboxReorder(props: {eventBus: EventEmitter<{[key: string]: string}>}) {
  const [toolSeq, setToolSeq] = useState([...defaultSeq]);
  useEffect(() => {
    Preferences.get({ key: 'toolbox_order'}).then((result) => {
      if (result.value) {
        const keys = JSON.parse(result.value) as string[];
        const persistOrder = [...defaultSeq];
        persistOrder.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key))
        setToolSeq(persistOrder);
      }
    });
  }, []);
  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    console.log('Dragged from index', event.detail.from, 'to', event.detail.to);
    const after = event.detail.complete(toolSeq);
    setToolSeq(after);
    Preferences.set({
      key: 'toolbox_order',
      value: JSON.stringify(after.map(e => e.key))
    }).then(() => {
      props.eventBus.emit({action: 'toolbar_order_change'});
    })
  }
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton></IonBackButton>
          </IonButtons>
          <IonTitle>定制工具栏顺序</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent class="ion-padding">
        <IonList>
           <IonReorderGroup disabled={false} onIonItemReorder={handleReorder}>
             {
               toolSeq.map(ele => {
                 return (
                   <IonItem key={ele.key}>
                     {ele.icon}
                     <IonLabel style={{paddingLeft: '1em'}}>{ele.label}</IonLabel>
                     <IonReorder slot="end"></IonReorder>
                   </IonItem>
                 )
               })
             }
          </IonReorderGroup>
        </IonList>
      </IonContent>
    </>
  );
}

export default ToolboxReorder;
