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
  useIonAlert
} from '@ionic/react';
import {arrowRedoOutline, arrowUndoOutline, checkboxOutline, copyOutline, filterOutline} from "ionicons/icons";
import {menuController} from '@ionic/core/components';
import React, {useEffect, useMemo, useRef, useState} from "react";
import {EventEmitter} from 'ahooks/lib/useEventEmitter';
import {SessionComponent} from "../components";
import {config, DocInfo, IndexedDBBackend, InMemory, Path, Session} from "../ts";
import {Input, Tree} from 'antd';
import {FileOutlined, OrderedListOutlined} from '@ant-design/icons';
import type {DataNode} from 'antd/es/tree';
import {getStyles} from "../ts/themes";
import {GitOperation} from "../plugins/git-operation";
import {constructDocInfo, mimetypeLookup} from "../ts/utils/util";
import defaultDocs from './docs.json';
import BreadcrumbsComponent from "./Breadcrumbs";
import {Preferences} from "@capacitor/preferences";
import ContentEditable from "react-contenteditable";
import {Keyboard} from "@capacitor/keyboard";

const { Search } = Input;

class TagTree extends Map<string, TagTree | DocInfo> {};
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

function getTagMap(filteredDocs: DocInfo[], recentDocId: number[], dirtyDocId: number[]): TagTree {
  const tagMap: TagTree = new Map();
  filteredDocs.forEach(doc => {
    let menuLabel = doc.name!;
    if (dirtyDocId.indexOf(doc.id!) !== -1) {
      menuLabel = '* ' + menuLabel;
    }
    const tagList: string[] = [];
    if (doc.tag) {
      const jsonArray = JSON.parse(doc.tag);
      if (Array.isArray(jsonArray) && jsonArray.length > 0) {
        jsonArray.map(singleTag => {
          tagList.push((singleTag as string) + '/默认分组');
        });
        tagList.forEach(singleTag => {
          let tagMapTmp: TagTree = tagMap;
          const tags = singleTag.split('/');
          for (let i = 0; i < tags.length; i++) {
            if (!tagMapTmp.has(tags[i])) {
              tagMapTmp.set(tags[i], new Map());
            }
            tagMapTmp = tagMapTmp.get(tags[i]) as TagTree;
          }
          tagMapTmp.set(menuLabel, doc);
        });
      } else {
        tagMap.set(menuLabel, doc);
      }
    }
  });
  return tagMap;
}

function DocComponent(props: {session: Session, eventBus: EventEmitter<{[key: string]: string}>}) {
  const searchContentRef: React.MutableRefObject<HTMLIonSearchbarElement | null> = useRef(null);
  const searchDocumentRef: React.MutableRefObject<HTMLIonSearchbarElement | null> = useRef(null);
  const menuRef: React.MutableRefObject<HTMLIonMenuElement | null> = useRef(null);
  const contentRef: React.MutableRefObject<any | null> = useRef(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectKeys, setSelectKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [contentSearchValue, setContentSearchValue] = useState('');
  const [searching, setSearching] = useState(false);
  const [docs, setDocs] = useState<Array<DocInfo>>([]);
  const [menuItem2DocId, setMenuItem2DocId] = useState(new Array<DocInfo>());
  const [present, dismiss] = useIonLoading();
  const [presentMessage] = useIonToast();
  const [presentAlert] = useIonAlert();
  const foldPopover = useRef<HTMLIonPopoverElement>(null);
  const [foldPopoverOpen, setFoldPopoverOpen] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [toolBoxHeight, setToolBoxHeight] = useState(0);
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
    if (detail.deltaX > 30 && detail.deltaY < 30) {
      console.log('gesture swipe');
      onBack();
    }
  }
  const persistUnSaveContent = async () => {
    const workspace = await Preferences.get({ key: 'workspace' });
    const open_file = await Preferences.get({ key: 'open_file'});
    const unSaveKey = `${workspace.value}:${open_file.value}:unsave`;
    const content = await props.session.getCurrentContent(Path.root(), 'application/json');
    await Preferences.set({key: unSaveKey, value: content});
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

  const refreshDocs = () => {
    Preferences.get({ key: 'workspace' }).then(async (r) => {
      let remoteUpdated = false
      let autoUpdateFlag = await Preferences.get({key: 'auto_update'})
      if (autoUpdateFlag.value !== 'off' && r.value) {
        remoteUpdated = await present({message: '正在检查更新...', backdropDismiss: true}).then(() =>
          GitOperation.gitPull({workspace: r.value ?? 'default'}).then(({data}) =>
            dismiss().then(() => {
              if (data > 0) {
                presentMessage({message: `发现${data}个提交`, duration: 300})
                return true;
              } else {
                presentMessage({message: `未发现更新`, duration: 300})
                return false;
              }
            })
          )
        )
      }
      if (!r.value) {
        setDocs(defaultDocs);
        reloadContent(defaultDocs[0], false);
        return;
      }
      GitOperation.listFiles({workspace: r.value!}).then(files => {
        const newDocs = files.data.filter(file => file.endsWith('.effect.json')).map((file, index) => {
          return constructDocInfo(file);
        });
        setDocs(newDocs);
        Preferences.get({key: 'open_file'}).then(o => {
          newDocs.filter(d => d.filepath === o.value).forEach(d => {
            reloadContent(d, remoteUpdated)
          })
        })
      }).catch(e => {
        console.log(e);
        setDocs(defaultDocs);
      })
    })
  }

  useEffect(() => {
    refreshDocs();
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
  function getDataNode(
      label: string,
      key: React.Key,
      children: DataNode[] | undefined,
      searchValue: string
  ): DataNode {
    let strTitle: string = label;
    let isModified = label.startsWith('* ');
    if (isModified) {
      strTitle = label.slice(2);
    }
    const index = strTitle.indexOf(searchValue);
    const beforeStr = strTitle.substring(0, index);
    const afterStr = strTitle.slice(index + searchValue.length);
    const title =
        index > -1 ? (
            <span>
              {beforeStr}
              <span style={getStyles(props.session.clientStore, ['theme-text-accent'])}>{searchValue}</span>
              {afterStr}
            </span>
        ) : (
            <span>{strTitle}</span>
        );
    return {
      key,
      switcherIcon: children ? undefined : <FileOutlined /> ,
      children,
      title
    } as DataNode;
  }
  const generateList = (data: TagTree, menuID2DocID: Array<DocInfo>, searchValue: string) => {
    const ret: DataNode[] = [];
    data.forEach((value, key) => {
      if (value instanceof Map) {
        const valueMapKeys = Array.from((value as TagTree).keys());
        const onlyDefault = valueMapKeys.length === 1 && valueMapKeys[0] === '默认分组';
        if (onlyDefault) {
          const oldLength = menuID2DocID.length;
          menuID2DocID.push({});
          const childItems = generateList(value.get('默认分组') as TagTree, menuID2DocID, searchValue);
          ret.push(getDataNode(key, oldLength, childItems, searchValue));
        } else {
          const oldLength = menuID2DocID.length;
          menuID2DocID.push({});
          const childItems = generateList(value, menuID2DocID, searchValue);
          ret.push(getDataNode(key, oldLength, childItems, searchValue));
        }
      } else {
        ret.push(getDataNode(key, menuID2DocID.length, undefined, searchValue));
        menuID2DocID.push(value);
      }
    });
    return ret;
  };
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
  const onSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;
    const docInfo = menuItem2DocId[Number(selectedKeys[0])];
    if (!docInfo.filename) {
      if (expandedKeys.includes(selectedKeys[0])) {
        setExpandedKeys([...expandedKeys.filter(k => k !== selectedKeys[0])])
      } else {
        setExpandedKeys([selectedKeys[0], ...expandedKeys])
      }
    } else {
      setSelectKeys(selectedKeys);
      console.log('selected', selectedKeys, docInfo);
      persistUnSaveContent().then(() => {
        Preferences.set({ key: 'open_file', value: docInfo.filepath!}).then(() => {
            reloadContent(docInfo, true);
        })
      });
    }
  };
  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys);
  };

  const treeData = useMemo(() => {
    const loop = (docs: DocInfo[]): DataNode[] => {
      const filterDocs = docs.filter(d => d.name?.includes(searchValue) || d.tag?.includes(searchValue))
      const tagMap = getTagMap(filterDocs, [], []);
      const menuID2DocID: Array<DocInfo> = [];
      const dataNodes = generateList(tagMap, menuID2DocID, searchValue);
      setMenuItem2DocId(menuID2DocID);
      return dataNodes;
    }
    return loop(docs);
  }, [docs, searchValue]);
  props.eventBus.useSubscription(val => {
    if (val['action'] === 'start_search') {
      menuRef.current?.isOpen().then(menuOpen => {
        if (menuOpen) {
          searchDocumentRef.current!.setFocus();
        } else {
          setSearching(true);
          setTimeout(() => {
            searchContentRef.current!.setFocus();
          }, 100);
        }
      })
    } else if (val['action'] === 'update_docs') {
      refreshDocs()
    } else if (val['action'] === 'backButton') {
      onBack()
    } else if (val['action'] === 'persist_unsave') {
      persistUnSaveContent()
    }
  })
  return (
      <>
        <IonMenu ref={menuRef} menuId="docs-menu" contentId="main-content" swipeGesture={false}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>目录</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">

            <IonSearchbar ref={searchDocumentRef}
                          onIonFocus={() => {
                            props.session.stopKeyMonitor('menu search');
                          }}
                          onIonBlur={() => {
                            props.session.startKeyMonitor()
                          }}
                          onIonChange={(e) => {
              setSearchValue(e.detail.value!);
            }} ></IonSearchbar>
            <Tree
                expandedKeys={searchValue ? Array.from(menuItem2DocId.keys()) : expandedKeys}
                onExpand={onExpand}
                showIcon={true}
                onSelect={(keys, info) => {
                  info.nativeEvent.stopPropagation();
                  onSelect(keys);
                }}
                treeData={treeData}
                selectedKeys={selectKeys}
                blockNode
            />
          </IonContent>
        </IonMenu>
        <IonPage id="main-content">
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonMenuButton onClick={(e) => {e.stopPropagation();}}></IonMenuButton>
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
                  <IonButton onClick={(e) => {
                    foldPopover.current!.event = e;
                    setFoldPopoverOpen(true);
                    e.stopPropagation();
                  }}>
                    <IonIcon slot="icon-only" icon={filterOutline}/>
                  </IonButton>
                  <IonPopover ref={foldPopover} isOpen={foldPopoverOpen} onDidDismiss={() => setFoldPopoverOpen(false)}>
                    <IonContent>
                      <IonList>
                        {unfoldMenus.map(({key, label}, i) => (
                            <IonItem key={key} onClick={(e) => {
                              e.stopPropagation();
                              const expandLevel = Number(key.substring(1));
                              props.session.foldBlock(props.session.viewRoot, expandLevel, false).then(() => {
                                props.session.emit('updateInner');
                                setFoldPopoverOpen(false);
                              });
                            }}>
                              <IonLabel>{label}</IonLabel>
                            </IonItem>
                        ))}
                      </IonList>
                    </IonContent>
                  </IonPopover>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent ref={contentRef} fullscreen>
            {
              toolBoxHeight > 0 &&
                <IonToolbar style={{position: 'fixed', bottom: 0}}>
                  <IonButtons slot="start">
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('virtual+copy');
                    }}>
                      <IonIcon color="dark" slot="icon-only" icon={copyOutline}></IonIcon>
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.emitAsync('toggleCheck', props.session.cursor.row).then(() => {
                        props.session.emit('updateInner');
                      });
                    }}>
                      <IonIcon color="dark" slot="icon-only" icon={checkboxOutline}></IonIcon>
                    </IonButton>
                    <IonButton color={"dark"} onClick={() => {
                      props.session.emitAsync('toggleOrder', props.session.cursor.row).then(() => {
                        props.session.emit('updateInner');
                      });
                    }}>
                      <OrderedListOutlined style={{fontSize: 22}} />
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.emitAsync('toggleBoard', props.session.cursor.row).then(() => {
                        props.session.emit('updateInner');
                      });
                    }}>
                      <img src={`images/board.png`} height={22}/>
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('shift+tab');
                    }}>
                      <img src={`images/left-indent.png`} height={22} />
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('tab');
                    }}>
                      <img src={`images/right-indent.png`} height={22} />
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('virtual+down');
                    }}>
                      <img src={`images/move-down.png`} height={22} />
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('virtual+up');
                    }}>
                      <img src={`images/move-up.png`} height={22} />
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('meta+z');
                    }}>
                      <IonIcon color="dark" slot="icon-only" icon={arrowUndoOutline}></IonIcon>
                    </IonButton>
                    <IonButton onClick={() => {
                      props.session.keyHandler?.queueKey('meta+Z');
                    }}>
                      <IonIcon color="dark" slot="icon-only" icon={arrowRedoOutline}></IonIcon>
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
            }
            <ContentEditable id='input-hack'
                             className='input-hack'
                             key='input-hack'
                             html={inputContent}
                             onChange={(e: any) => {
                               const newVal = e.target.value.replace(/&lt;/g, '<')
                                   .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
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
            <SessionComponent session={props.session} />
          </IonContent>
        </IonPage>
      </>
  );
};

export default DocComponent;
