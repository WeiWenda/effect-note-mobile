import {
  createGesture,
  GestureDetail,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuButton,
  IonPage,
  IonPopover,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  useIonLoading,
  useIonToast,
  useIonAlert, IonFab, IonFabButton, IonFabList
} from '@ionic/react';
import {
  ellipsisVertical,
  chevronCollapseOutline,
  shareSocialOutline
} from "ionicons/icons";
import {menuController} from '@ionic/core/components';
import React, {useEffect, useMemo, useRef, useState} from "react";
import {EventEmitter} from 'ahooks/lib/useEventEmitter';
import {SessionComponent} from "../components";
import {config, DocInfo, IndexedDBBackend, InMemory, Path, Session} from "../ts";
import {Input, Tree} from 'antd';
import {getStyles} from "../ts/themes";
import {GitOperation} from "../plugins/git-operation";
import {constructDocInfo, mimetypeLookup, mimetypeLookupByContent} from "../ts/utils/util";
import BreadcrumbsComponent from "./Breadcrumbs";
import {Preferences} from "@capacitor/preferences";
import ContentEditable from "react-contenteditable";
import {Keyboard} from "@capacitor/keyboard";
import $ from "jquery";
import {Clipboard} from "@capacitor/clipboard";
import {defaultSeq} from "./ToolboxReorder";
import { toPng } from 'html-to-image';
import Moment from 'moment/moment';
import {Directory, Filesystem} from "@capacitor/filesystem";
import {Share} from "@capacitor/share";
import {defaultPreference} from "./PictureShareFooter";

const unfoldMenus = [
  {
    key: 'h1',
    label: '展开至一级子节点',
  }, {
    key: 'h2',
    label: '展开至二级子节点',
  }, {
    key: 'h3',
    label: '展开至三级子节点',
  }, {
    key: 'h100',
    label: '展开全部子节点',
  }];

function DocComponent(props: {session: Session, eventBus: EventEmitter<{[key: string]: string}>}) {
  const searchContentRef: React.MutableRefObject<HTMLIonSearchbarElement | null> = useRef(null);
  const contentRef: React.MutableRefObject<any | null> = useRef(null);
  const [contentSearchValue, setContentSearchValue] = useState('');
  const [searching, setSearching] = useState(false);
  const [screenShot, setScreenShot] = useState(false);
  const [present, dismiss] = useIonLoading();
  const [presentMessage] = useIonToast();
  const [presentAlert] = useIonAlert();
  const [inputContent, setInputContent] = useState('');
  const [toolBoxHeight, setToolBoxHeight] = useState(0);
  const [toolBoxElements, setToolBoxElements] = useState(defaultSeq);
  const [sharePreference, setSharePreference] = useState(defaultPreference);
  const onBack = () => {
    if (props.session.jumpIndex === 0) {
      setTimeout(() => {
        menuController.open('docs-menu');
      }, 300);
    } else {
      props.session.jumpPrevious();
    }
  }
  const onMove = (detail: GestureDetail) => {
    if (detail.startX < 50 && detail.deltaX > 30 && detail.deltaY < 30) {
      console.log('gesture swipe');
      onBack();
    }
  }
  const reloadContent = async (docInfo: DocInfo, checkRemoteUpdate: boolean) => {
    const workspace = await Preferences.get({ key: 'workspace' });
    const unSaveKey = `${workspace.value}:${docInfo.filepath!}:unsave`;
    const unSaveContent = await Preferences.get({key: unSaveKey});
    const gitContent = await GitOperation.blobContent({workspace: workspace.value ?? 'default', path: docInfo.filepath!}).then(({data}) => {
      return data.replaceAll('http://localhost:51223/api', `http://localhost:51223/${workspace.value ?? 'default'}`);
    }).catch(e => {
      return config.getDefaultData();
    });
    const doLoad = (contentToLoad: string) => present({
      message: '处理中...',
    }).then(() => {
      loadDoc(docInfo, contentToLoad).then(() => {
        dismiss();
      }).catch((e) => {
        console.error(e)
        dismiss();
      })
    })
    if (checkRemoteUpdate) {
      if (unSaveContent.value && gitContent !== unSaveContent.value) {
        presentAlert({message: '发现云端内容有更新，是否加载？',
        buttons: [{
          text: '不加载',
          role: 'cancel',
          handler: () => {
            doLoad(unSaveContent.value ?? gitContent)
          }
        }, {
          text: '加载并丢弃本地修改',
          role: 'confirm',
          handler: () => {
            Preferences.set({key: unSaveKey, value: gitContent}).then(() => {
              doLoad(gitContent)
            })
          }
        }]})
      } else {
        doLoad(unSaveContent.value ?? gitContent)
      }
    } else {
      doLoad(unSaveContent.value ?? gitContent)
    }
  };

  const refreshToolbarElements = () => {
    Preferences.get({ key: 'toolbox_order'}).then((result) => {
      if (result.value) {
        const keys = JSON.parse(result.value) as string[];
        const persistOrder = [...defaultSeq];
        persistOrder.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key))
        setToolBoxElements(persistOrder);
      }
    });
  }

  const refreshShareFooterPrefer = () => {
    Preferences.get({ key: 'share_footer'}).then((result) => {
      if (result.value) {
        setSharePreference(JSON.parse(result.value));
      }
    });
  }

  useEffect(() => {
    refreshToolbarElements();
    props.session.on('scrollTo', async (clickY) => {
      await contentRef.current?.scrollByPoint(0, clickY - window.innerHeight/2, 100);
      return Promise.resolve()
    });
    const gesture = createGesture({
      el: contentRef.current,
      onEnd: (detail) => onMove(detail),
      gestureName: 'example',
    });
    gesture.enable();
    Keyboard.addListener('keyboardWillShow', info => {
      console.log('keyboard will show with height:', info.keyboardHeight);
      setToolBoxHeight(info.keyboardHeight);
    })
    Keyboard.addListener('keyboardWillHide', () => {
      console.log('keyboard will hide');
      setToolBoxHeight(0);
    });

    return () => {
      Keyboard.removeAllListeners();
    };
  }, []);
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

  const onToolBarClick = (key: string) => {
    switch (key) {
      case 'copy':
        props.session.keyHandler?.queueKey('meta+c');
        break;
      case 'paste':
        Clipboard.read().then(async ({type, value}) => {
          const text = value.replace(/(?:\r)/g, '');  // Remove \r (Carriage Return) from each line
          const mimetype = mimetypeLookupByContent(text);
          if (!mimetype) {
            if (props.session.getAnchor() !== null && props.session.selecting) {
              await props.session.yankDelete();
            }
            await props.session.pasteText(text);
          } else {
            // session.showMessage(`识别到${mimetype}格式，导入中...`);
            await props.session.importContent(text, mimetype, props.session.cursor.path);
          }
          await presentMessage({message: `粘贴成功`, duration: 300})
          props.session.emit('updateInner');
        });
        break;
      case 'mark-task':
        props.session.emitAsync('toggleCheck', props.session.cursor.row).then(() => {
          props.session.emit('updateInner');
        });
        break;
      case 'mark-order':
        props.session.emitAsync('toggleOrder', props.session.cursor.row).then(() => {
          props.session.emit('updateInner');
        });
        break;
      case 'mark-board':
        props.session.emitAsync('toggleBoard', props.session.cursor.row).then(() => {
          props.session.emit('updateInner');
        });
        break;
      case 'mark-tag':
        props.session.emitAsync('startTag', props.session.cursor.path).then(() => {
          props.session.emit('updateInner');
        });
        break;
      case 'mark-quote':
        props.session.emitAsync('toggleCallout', props.session.cursor.row).then(() => {
          props.session.emit('updateInner');
        });
        break;
      case 'indent':
        props.session.keyHandler?.queueKey('shift+tab');
        break;
      case 'unindent':
        props.session.keyHandler?.queueKey('tab');
        break;
      case 'move-down':
        props.session.keyHandler?.queueKey('virtual+down');
        break;
      case 'move-up':
        props.session.keyHandler?.queueKey('virtual+up');
        break;
      case 'undo':
        props.session.keyHandler?.queueKey('meta+z');
        break;
      case 'redo':
        props.session.keyHandler?.queueKey('meta+Z');
        break;
    }
  }
  props.eventBus.useSubscription(val => {
    if (val['action'] === 'open_file') {
      const docInfo = JSON.parse(val['docInfo']) as DocInfo
      if (docInfo.filepath?.endsWith('.effect.json')) {
        reloadContent(docInfo, Boolean(val['checkRemoteUpdate']));
      }
    } else if (val['action'] === 'start_search') {
      setSearching(true);
      setTimeout(() => {
        searchContentRef.current!.setFocus();
      }, 100);
    } else if (val['action'] === 'backButton') {
      onBack()
    } else if (val['action'] === 'toolbar_order_change') {
      refreshToolbarElements()
    } else if (val['action'] === 'share_footer_change') {
      refreshShareFooterPrefer()
    }
  })
  return (
      <>
        <IonPage id="main-content">
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                {
                  !searching &&
                  <BreadcrumbsComponent session={props.session}/>
                }
              </IonButtons>
              {
                searching &&
                <IonSearchbar value={contentSearchValue} ref={searchContentRef}
                              onIonFocus={() => {
                                props.session.stopKeyMonitor('content search');
                              }}
                              onIonBlur={() => {
                                props.session.startKeyMonitor();
                                setSearching(false);
                              }} onIonClear={() => {
                                setContentSearchValue('');
                                props.session.applySearch('');
                              }} onIonChange={(e) => {
                                setContentSearchValue(e.detail.value ?? '');
                                props.session.applySearch(e.detail.value ?? '');
                              }}></IonSearchbar>
              }
              <IonButtons slot="end">
                <IonButton id="tool-trigger">
                  <IonIcon icon={ellipsisVertical}/>
                </IonButton>
              </IonButtons>
              <IonPopover trigger="tool-trigger" dismissOnSelect={true}>
                <IonContent>
                  <IonList>
                    <IonItem button={true} id="expand-trigger">
                      <IonIcon aria-hidden="true" icon={chevronCollapseOutline} slot="start"></IonIcon>
                      <IonLabel>批量展开</IonLabel>
                    </IonItem>
                    <IonItem button={true} detail={false} onClick={(e) => {
                      const sessionDiv = $('.screen-shot-area').get()
                      if (sessionDiv) {
                        $('.screen-shot-area').addClass('screen-shot')
                        setScreenShot(true);
                        const oldCursor = props.session.cursor.clone();
                        props.session.cursor.reset();
                        props.session.emitAsync('updateInner').then(() => {
                          present({message: '正在生成图片...', backdropDismiss: false}).then(() => {
                            toPng(sessionDiv[0]).then(dataUrl => {
                              Filesystem.writeFile({
                                path: 'share-cache.png',
                                data: dataUrl.split(',')[1],
                                directory: Directory.Documents
                              }).then((result) => {
                                $('.screen-shot-area').removeClass('screen-shot')
                                props.session.cursor = oldCursor;
                                dismiss().then(() => {
                                  Share.share({
                                    url: result.uri,
                                  });
                                });
                              });
                            })
                          })
                        })
                      }
                    }}>
                      <IonIcon aria-hidden="true" icon={shareSocialOutline} slot="start"></IonIcon>
                      <IonLabel>长图分享</IonLabel>
                    </IonItem>
                    <IonPopover trigger="expand-trigger" dismissOnSelect={true} side={'start'}>
                      <IonContent>
                        <IonList>
                          {unfoldMenus.map(({key, label}, i) => (
                            <IonItem key={key} onClick={(e) => {
                              e.stopPropagation();
                              const expandLevel = Number(key.substring(1));
                              props.session.foldBlock(props.session.viewRoot, expandLevel, false).then(() => {
                                props.session.emit('updateInner');});
                            }}>
                              <IonLabel>{label}</IonLabel>
                            </IonItem>
                          ))}
                        </IonList>
                      </IonContent>
                    </IonPopover>
                  </IonList>
                </IonContent>
              </IonPopover>
            </IonToolbar>
          </IonHeader>
          <IonContent ref={contentRef} fullscreen>
            {
              toolBoxHeight > 0 &&
                <div
                  onClick={(e) => {
                    const event = $.Event( "click" );
                    event.pageY = 0;
                    $(document).trigger(event);
                    e.stopPropagation();
                  }}
                  style={{display: 'flex', zIndex: 1001, position: 'fixed', bottom: 0, height: '48px', width: '100%', overflowX: 'auto', ...getStyles(props.session.clientStore, ['theme-bg-secondary'])}}>
                  <IonButtons slot="start">
                    {
                      toolBoxElements.map(toolBoxElement => {
                        return (
                          <IonButton key={toolBoxElement.key} onClick={(e) => {onToolBarClick(toolBoxElement.key)}}>
                            {toolBoxElement.icon}
                          </IonButton>
                        )
                      })
                    }
                  </IonButtons>
                </div>
            }
            <ContentEditable id='input-hack'
                             className='input-hack'
                             key='input-hack'
                             html={inputContent}
                             onChange={(e: any) => {
                               const newVal = e.target.value.replace(/&lt;/g, '<')
                                   .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
                               setInputContent(newVal);
                               console.log('inputing', newVal);
                               props.session.addCharsAtCursor(newVal.split('')).then(() => {
                                 props.session.emit('updateInner');
                                 setInputContent('');
                               });
                               // if (! new RegExp('[\u4E00-\u9FA5a-zA-Z0-9 ]').test(newVal.substring(0, 1))) {
                               //   console.log('inputing', newVal);
                               // }
                             }}></ContentEditable>
            <div className={'screen-shot-area'}>
              <SessionComponent session={props.session} />
              {
                screenShot && (sharePreference.show_date || sharePreference.show_software || sharePreference.show_user_info) &&
                <div style={{fontFamily: 'sans-serif', fontStyle: 'italic',
                  textAlign: 'right', paddingRight: '10px', paddingBottom: '10px'}}>Written{
                  sharePreference.show_user_info ? ` By ${sharePreference.user_info}` : ''}{
                   sharePreference.show_software ? ' With EffectNote' : ''}{
                    sharePreference.show_date ? ` At ${Moment().format('yyyy/MM/DD')}` : ''}</div>
              }
            </div>
          </IonContent>
        </IonPage>
      </>
  );
};

export default DocComponent;
