import React, {useEffect, useState} from 'react';
import {
  IonBackButton,
  IonButtons,
  IonButton,
  IonHeader,
  IonContent,
  IonNavLink,
  IonToolbar,
  IonTitle,
  IonList,
  IonReorderGroup,
  IonItem,
  IonLabel,
  IonReorder,
  IonIcon,
  ItemReorderEventDetail,
  IonInput,
  IonToggle,
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
import {Session} from "../ts";

export type ShareFooterPrefer = {
  show_software: boolean,
  show_user_info: boolean,
  show_date: boolean,
  user_info: string,
}

export const defaultPreference: ShareFooterPrefer = {
  show_software: true,
  show_user_info: false,
  show_date: true,
  user_info: '',
}

function PictureShareFooter(props: {eventBus: EventEmitter<{[key: string]: string}>, session: Session}) {
  const [showSoftware, setShowSoftware] = useState(false);
  const [userInfo, setUserInfo] = useState('');
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showDate, setShowDate] = useState(false);
  useEffect(() => {
    Preferences.get({ key: 'share_footer'}).then((result) => {
      const prefers = result.value ? JSON.parse(result.value) as ShareFooterPrefer : defaultPreference;
      setShowSoftware(prefers.show_software);
      setShowUserInfo(prefers.show_user_info);
      setShowDate(prefers.show_date);
      setUserInfo(prefers.user_info);
    });
  }, []);
  useEffect(() => {
    Preferences.set({
      key: 'share_footer',
      value: JSON.stringify({
        user_info: userInfo,
        show_software: showSoftware,
        show_user_info: showUserInfo,
        show_date: showDate
      })
    }).then(() => {
      console.log('save share_footer');
      props.eventBus.emit({action: 'share_footer_change'});
    })
  }, [userInfo, showUserInfo, showDate, showSoftware]);
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton></IonBackButton>
          </IonButtons>
          <IonTitle>定制分享页脚</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent class="ion-padding">
        <IonList>
          <IonItem>
            <IonInput label="作者信息" label-placement="fixed" onFocus={() => {
              props.session.stopKeyMonitor('edit-user-info');
            }} onBlur={() => {
              props.session.startKeyMonitor();
            }} onIonChange={(e) => {
              setUserInfo(e.detail.value || '')
            }} value={userInfo}></IonInput>
          </IonItem>
          <IonItem>
            <IonToggle checked={showUserInfo} onIonChange={(e) => {
              setShowUserInfo(!showUserInfo);
            }}>包含作者信息</IonToggle>
          </IonItem>
          <IonItem>
            <IonToggle checked={showSoftware} onIonChange={(e) => {
              setShowSoftware(!showSoftware);
            }}>包含分享来源</IonToggle>
          </IonItem>
          <IonItem>
            <IonToggle checked={showDate} onIonChange={(e) => {
              setShowDate(!showDate);
            }}>包含分享日期</IonToggle>
          </IonItem>
        </IonList>
      </IonContent>
    </>
  );
}

export default PictureShareFooter;
