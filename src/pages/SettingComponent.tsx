import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding,
  IonLabel, IonList,
  IonPage, IonSelect, IonSelectOption,
  IonTitle, IonToggle,
  IonToolbar, useIonAlert, useIonLoading, IonItemGroup, IonItemDivider, IonText, IonNavLink
} from '@ionic/react';
import {settingsOutline, trash, starSharp, scanOutline, arrowBackOutline, chevronForward} from "ionicons/icons";
import { Preferences } from '@capacitor/preferences';
import {useEffect, useState} from "react";
import {EventEmitter} from "ahooks/lib/useEventEmitter";
import {GitOperation} from "../plugins/git-operation";
import {WorkSpaceInfo} from "../ts/server_config";

import {
  BarcodeScanner,
  BarcodeFormat,
  LensFacing,
} from '@capacitor-mlkit/barcode-scanning';
import ToolboxReorder from "./ToolboxReorder";

function SettingComponent(props: {eventBus: EventEmitter<{[key: string]: string}>}) {
  const [theme, setTheme] = useState('auto');
  const [scaning, setScaning] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [workspaces, setWorkSpaces] = useState<WorkSpaceInfo[]>([]);
  const [presentAlert] = useIonAlert();
  const [presentLoading, dismissLoading] = useIonLoading();
  useEffect(() => {
    Preferences.get({ key: 'theme' }).then((result => {
      setTheme(result.value ?? 'auto');
    }));
    Preferences.get({ key: 'auto_update' }).then((result => {
      setAutoUpdate(result.value === 'off' ? false : true);
    }));
    Preferences.get({ key: 'workspaces' }).then((result => {
      if (result.value) {
        setWorkSpaces(JSON.parse(result.value));
      }
    }));
  }, []);

  const scanSingleBarcode = async () => {
    await Preferences.set({key: 'theme', value: 'Default'}).then(() => props.eventBus.emit({action: 'theme_change'}));
    return new Promise<string>(async resolve => {
      document.querySelector('body')?.classList.add('barcode-scanner-active');
  
      const listener = await BarcodeScanner.addListener(
        'barcodeScanned',
        async result => {
          await listener.remove();
          await Preferences.set({key: 'theme', value: theme}).then(() => props.eventBus.emit({action: 'theme_change'}));
          document
            .querySelector('body')
            ?.classList.remove('barcode-scanner-active');
          await BarcodeScanner.stopScan();
          resolve(result.barcode.rawValue);
        },
      );
  
      await BarcodeScanner.startScan();
    });
  };

  const persistWorkSpaces = (newWorkspaces: WorkSpaceInfo[]) => {
    const activeWorkspace = newWorkspaces.filter(w => w.active).pop()
    Preferences.set({
      key: 'workspaces',
      value: JSON.stringify(newWorkspaces)
    }).then(() => {
      setWorkSpaces(newWorkspaces);
      if (newWorkspaces.length > 0 && activeWorkspace) {
        Preferences.set({
          key: 'workspace',
          value: activeWorkspace.gitLocalDir!
        }).then(() => {
          props.eventBus.emit({action: 'update_docs'})
          dismissLoading();
        });
      }
    })
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className={'qrcode-scan-cancel'} onClick={() => {
              Preferences.set({key: 'theme', value: theme}).then(() => props.eventBus.emit({action: 'theme_change'})).then(() => {
                BarcodeScanner.stopScan().then(() => {
                  setScaning(false);
                  document
                      .querySelector('body')
                      ?.classList.remove('barcode-scanner-active');
                })
              });
            }}>
              <IonIcon aria-hidden="true" icon={scaning ? arrowBackOutline : settingsOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Settings</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => {
              setScaning(true);
              scanSingleBarcode().then((rawUrl: string) => {
                const url = new URL(rawUrl);
                const gitLocalDir = url.searchParams.get('gitLocalDir');
                const gitRemote = url.searchParams.get('gitRemote');
                const gitUsername = url.searchParams.get('gitUsername');
                const gitPassword = url.searchParams.get('gitPassword');
                if (gitLocalDir === null || gitRemote === null ||
                  gitUsername === null || gitPassword === null) {
                  presentAlert({
                    header: '二维码不合法',
                    buttons: [{text: '确认', role: 'cancel'}],
                  });
                } else {
                  presentLoading({
                    message: '正在执行git clone...'
                  }).then(() => {
                    setTimeout(() => {
                      GitOperation.gitClone({gitLocalDir, gitRemote, gitUsername, gitPassword}).then(() => {
                        workspaces.forEach(w => w.active = false);
                        const newWorkspace: WorkSpaceInfo = {
                          gitLocalDir, gitRemote, gitUsername, gitPassword, active: true
                        }
                        const newWorkspaces = workspaces.concat([newWorkspace]);
                        persistWorkSpaces(newWorkspaces);
                      })
                    }, 1000);
                  })
                }
              })
            }}>
              <IonIcon aria-hidden="true" icon={scanOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonItemGroup>
          <IonItemDivider>
            <IonLabel>工作空间</IonLabel>
          </IonItemDivider>
          {
            workspaces.length == 0 &&
            <IonItem>
              <IonLabel color={"medium"}>右上角扫描二维码，以添加工作空间</IonLabel>
            </IonItem>
          }
          {
            workspaces.length == 0 &&
            <IonItem>
              <IonText color={"warning"}>移动版依赖于桌面版，请先下载桌面版，并按帮助文档配置工作空间后再进行扫码</IonText>
            </IonItem>
          }
          {
            workspaces.length > 0 &&
            workspaces.map(workspace => {
              return (
                <IonItemSliding>
                  <IonItem button={true} detail={true}>
                    <IonLabel>{workspace.gitLocalDir}</IonLabel>
                    {
                      workspace.active &&
                      <IonIcon icon={starSharp}></IonIcon>
                    }
                  </IonItem>
                  <IonItemOptions slot="end">
                    <IonItemOption color="tertiary" onClick={() => {
                       const newWorkspaces = [...workspaces.map(i => {
                          i.active = i.gitLocalDir === workspace.gitLocalDir
                          return i
                        })];
                       persistWorkSpaces(newWorkspaces);
                    }}>
                      <IonIcon slot="icon-only" icon={starSharp}></IonIcon>
                    </IonItemOption>
                    <IonItemOption color="danger" onClick={() => {
                      const newWorkspaces = [...workspaces.filter(i => i.gitLocalDir !== workspace.gitLocalDir)];
                      if (newWorkspaces.length > 0 && newWorkspaces.every(w => !w.active)) {
                        newWorkspaces[0].active = true;
                      }
                      persistWorkSpaces(newWorkspaces);
                    }} expandable={true}>
                      <IonIcon slot="icon-only" icon={trash}></IonIcon>
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })
          }
        </IonItemGroup>
        <IonItemGroup>
          <IonItemDivider>
            <IonLabel>偏好</IonLabel>
          </IonItemDivider>
          <IonItem>
            <IonSelect label="样式主题" value={theme} onIonChange={(e) => {
              setTheme(e.detail.value);
              Preferences.set({
                key: 'theme',
                value: e.detail.value
              }).then(() => props.eventBus.emit({action: 'theme_change'}));
            }}>
              <IonSelectOption value="auto">跟随系统</IonSelectOption>
              <IonSelectOption value="Dark">深色</IonSelectOption>
              <IonSelectOption value="Default">浅色</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonToggle checked={autoUpdate} onIonChange={(e) => {
              setAutoUpdate(!autoUpdate);
              Preferences.set({
                key: 'auto_update',
                value: autoUpdate ? "off" : "on"
              }).then(() => {
                if (!autoUpdate) {
                  props.eventBus.emit({action: 'update_docs'});
                }
              });
            }}>开启自动同步</IonToggle>
          </IonItem>
          <IonNavLink routerDirection="forward" component={() => <ToolboxReorder eventBus={props.eventBus} />}>
            <IonItem>
                <IonLabel>定制工具栏顺序</IonLabel>
                  <IonIcon color={'medium'} icon={chevronForward}></IonIcon>
            </IonItem>
          </IonNavLink>
        </IonItemGroup>
      </IonContent>
    </IonPage>
  );
};

export default SettingComponent;
