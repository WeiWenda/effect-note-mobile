import { Redirect, Route } from 'react-router-dom';
import {
  IonApp, IonContent, IonHeader,
  IonIcon,
  IonLabel, IonMenu, IonMenuButton,
  IonRouterOutlet, IonSearchbar,
  IonTabBar,
  IonTabButton,
  IonTabs, IonTitle, IonToolbar,
  setupIonicReact, useIonLoading, useIonToast
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  searchOutline,
  fileTrayFullOutline,
  settingsOutline,
  createOutline,
  cloudUploadOutline,
  menuOutline
} from 'ionicons/icons';
import { menuController } from '@ionic/core/components';
import DocComponent from './pages/DocComponent';
import SettingComponent from './pages/SettingComponent';
import { App as AppPlugin } from '@capacitor/app';
import { Clipboard } from '@capacitor/clipboard';
import * as ExcalidrawLib from '@excalidraw/excalidraw';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';
import {useEventEmitter} from "ahooks";
import {
  config,
  KeyBindings,
  keyDefinitions,
  Session,
  KeyHandler,
  KeyEmitter,
  Path,
  RegisterTypes,
  SerializedBlock,
  DocInfo
} from "./ts";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {appendStyleScript, getStyles, Theme, themes} from "./ts/themes";
import {PluginsManager} from "./ts/plugins";
import {Preferences} from "@capacitor/preferences";
import './components/plugins';
import {GitOperation} from "./plugins/git-operation";
import {message, Tree} from "antd";
import $ from "jquery";
import {ExcalidrawComponent} from "./pages/ExcalidrawComponent";
import {DataNode} from "antd/es/tree";
import {FileOutlined} from "@ant-design/icons";
import defaultDocs from "./pages/docs.json";
import {constructDocInfo} from "./ts/utils/util";

setupIonicReact();
class TagTree extends Map<string, TagTree | DocInfo> {};
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
function App (props: {session: Session}) {
  const menuRef: React.MutableRefObject<HTMLIonMenuElement | null> = useRef(null);
  const searchDocumentRef: React.MutableRefObject<HTMLIonSearchbarElement | null> = useRef(null);
  const [editingExcalidraw, setEditingExcalidraw] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectKeys, setSelectKeys] = useState<React.Key[]>([]);
  const [docs, setDocs] = useState<Array<DocInfo>>([]);
  const [menuItem2DocId, setMenuItem2DocId] = useState(new Array<DocInfo>());
  const eventEmitter = useEventEmitter<{[key: string]: string}>()
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(props.session.mode)
  const [present, dismiss] = useIonLoading();
  const [presentMessage] = useIonToast();
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
        eventEmitter.emit({action: 'open_file', docInfo: JSON.stringify(defaultDocs[0]), checkRemoteUpdate: "false"})
        return;
      }
      GitOperation.listFiles({workspace: r.value!}).then(files => {
        const newDocs = files.data.filter(file => file.endsWith('.effect.json')).map((file, index) => {
          return constructDocInfo(file);
        });
        setDocs(newDocs);
        Preferences.get({key: 'open_file'}).then(o => {
          newDocs.filter(d => d.filepath === o.value).forEach(d => {
            eventEmitter.emit({action: 'open_file', docInfo: JSON.stringify(d), checkRemoteUpdate: remoteUpdated.toString()})
          })
        })
      }).catch(e => {
        console.log(e);
        setDocs(defaultDocs);
      })
    })
  }
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
  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys);
  };

  const treeData = useMemo(() => {
    const loop = (docs: DocInfo[]): DataNode[] => {
      const filterDocs = docs.filter(d => d.name?.toLowerCase().includes(searchValue.toLowerCase()) || d.tag?.toLowerCase().includes(searchValue.toLowerCase()))
      const tagMap = getTagMap(filterDocs, [], []);
      const menuID2DocID: Array<DocInfo> = [];
      const dataNodes = generateList(tagMap, menuID2DocID, searchValue);
      setMenuItem2DocId(menuID2DocID);
      return dataNodes;
    }
    return loop(docs);
  }, [docs, searchValue]);
  const persistUnSaveContent = async () => {
    const workspace = await Preferences.get({ key: 'workspace' });
    const open_file = await Preferences.get({ key: 'open_file'});
    const unSaveKey = `${workspace.value}:${open_file.value}:unsave`;
    const content = await props.session.getCurrentContent(Path.root(), 'application/json', true);
    await Preferences.set({key: unSaveKey, value: content});
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
          eventEmitter.emit({action: 'open_file', docInfo: JSON.stringify(docInfo), checkRemoteUpdate: "true"})
        })
      });
    }
  };
  const applyTheme = (themeName: string) => {
    let theme: Theme;
    if (themeName === 'auto') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? themes.Default : themes.Dark;
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.body.classList.toggle('dark', false);
        props.session.clientStore.setClientSetting('curTheme', 'Default');
      } else {
        document.body.classList.toggle('dark', true);
        props.session.clientStore.setClientSetting('curTheme', 'Dark');
      }
    } else {
      props.session.clientStore.setClientSetting('curTheme', themeName);
      if (themeName === 'Dark') {
        document.body.classList.toggle('dark', true);
      } else {
        document.body.classList.toggle('dark', false);
      }
      theme = themes[themeName]
    }
    Object.keys(theme).forEach((theme_prop: string) => {
      props.session.clientStore.setClientSetting(theme_prop as keyof Theme, theme[theme_prop as keyof Theme]);
    });
    appendStyleScript(props.session.clientStore);
    props.session.emit('updateInner');
  };
  async function openDocsMenu() {
    await menuController.open('docs-menu');
  }
  useEffect(() => {
    refreshDocs();
    Preferences.get({ key: 'theme' }).then(r => applyTheme(r.value ?? 'auto'));
    const mappings = config.defaultMappings;
    const keyBindings = new KeyBindings(keyDefinitions, mappings);
    const pluginManager = new PluginsManager(props.session, config, keyBindings);
    let enabledPlugins = ['Marks', 'Tags', 'Links', 'HTML', 'Todo', 'Markdown', 'CodeSnippet', 'LaTeX', 'Comment', 'DataLoom', 'MindMap'];
    enabledPlugins.reduce((p: Promise<void>, plugin_name) =>
        p.then(() => pluginManager.enable(plugin_name)), Promise.resolve()).then(() => {
          setLoading(false);
    });
    const keyHandler = new KeyHandler(props.session, keyBindings);
    props.session.keyHandler = keyHandler;
    const keyEmitter = new KeyEmitter();
    keyEmitter.listen();
    keyEmitter.on('keydown', (key) => {
      if (!props.session.stopMonitor) {
        keyHandler.queueKey(key);
        // NOTE: this is just a best guess... e.g. the mode could be wrong
        // problem is that we process asynchronously, but need to return synchronously
        return keyBindings.bindings[props.session.mode].getKey(key) != null ||
            (props.session.mode === 'INSERT' && (key === 'space' || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.includes(key)));
      } else {
        return false;
      }
    });
    keyHandler.on('handledKey', () => {
      props.session.emit('updateInner');
    });
    props.session.on('modeChange', (oldMode, newMode) => {
      setMode(newMode)
    });
    props.session.on('yank', (info) => {
      let content: string, richContent: string;
      if (info.type === RegisterTypes.CHARS) {
        content = info.saved.join('');
        richContent = info.saved.join('');
      } else if (info.type === RegisterTypes.SERIALIZED_ROWS) {
        const formatted = props.session.clientStore.getClientSetting('formattedCopy');
        const contents: Array<string> = [];
        const richContents: Array<string> = ['<ul>'];
        const cache: {[id: number]: SerializedBlock} = {};
        const recurse = (p: any, depth: number) => {
          if (typeof p === 'string') { throw new Error('Expected non-pretty serialization');
          } else if (p.clone) { p = cache[p.clone];
          } else { cache[p.id] = p; } // in case it's cloned

          if (formatted) { contents.push(' '.repeat(depth * 4) + (p.collapsed ? '+ ' : '- ') + p.text);
          } else { contents.push(p.text); }
          richContents.push('<li>' + p.text + '</li>');

          if (p.collapsed || !p.children) { return; }
          richContents.push('<ul>');
          p.children.forEach((child: SerializedBlock) => recurse(child, depth + 1));
          richContents.push('</ul>');
        };
        info.saved.forEach((p: SerializedBlock) => recurse(p, 0));
        content = contents.join('\n');
        richContents.push('</ul>');
        if (contents.length <= 1) { richContent = content; } else {
          richContent = richContents.join('\n');
        }
      } else if (info.type === RegisterTypes.CLONED_ROWS) {
        // For now, this does not copy, for efficiency reasons
        return;
      } else {
        throw Error(`Unexpected yank with invalid info ${info}`);
      }

      Clipboard.write({string: content}).then(() => {
        presentMessage({message: '复制成功', duration: 300})
      });
    });
    AppPlugin.addListener('backButton', () => {
      if (window.location.pathname === '/docs') {
        eventEmitter.emit({action: 'backButton'})
      } else {
        console.log('backButton at setting do nothing!', window.location.pathname)
      }
    })
    AppPlugin.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
      if (isActive) {
        Preferences.get({ key: 'theme' }).then(r => applyTheme(r.value ?? 'auto'));
      } else {
        persistUnSaveContent();
      }
    });
    return () => {
      AppPlugin.removeAllListeners();
    };
  }, []);
  eventEmitter.useSubscription(val => {
    if (val['action'] === 'theme_change') {
      Preferences.get({ key: 'theme' }).then(r => applyTheme(r.value ?? 'auto'));
    } else if (val['action'] === 'update_docs') {
      refreshDocs()
    }
  })
  return (
      <IonApp>
        {
          loading &&
            <IonIcon aria-hidden="true" icon={settingsOutline} />
        }
        {
          !loading &&
          <IonReactRouter>
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
            <IonTabs>
              <IonRouterOutlet>
                <Route exact path="/docs">
                  {
                    editingExcalidraw &&
                    <ExcalidrawComponent
                      session={props.session}
                      eventBus={eventEmitter}
                      excalidrawLib={ExcalidrawLib}>
                      <ExcalidrawLib.Excalidraw/>
                    </ExcalidrawComponent>
                  }
                  {
                    !editingExcalidraw &&
                    <DocComponent session={props.session} eventBus={eventEmitter} />
                  }
                </Route>
                <Route exact path="/settings">
                  <SettingComponent session={props.session} eventBus={eventEmitter} />
                </Route>
                <Route exact path="/search">
                  <Redirect to="/docs" />
                </Route>
                <Route exact path="/document">
                  <Redirect to="/docs" />
                </Route>
                <Route exact path={"/input"}>
                  <Redirect to="/docs" />
                </Route>
                <Route exact path={"/save"}>
                  <Redirect to="/docs" />
                </Route>
                <Route exact path="/">
                  <Redirect to="/docs" />
                </Route>
              </IonRouterOutlet>
              <IonTabBar slot="bottom">
                <IonTabButton tab="tab0" href='/document' onClick={(e) => {
                  e.stopPropagation();
                  openDocsMenu();
                }}>
                  <IonIcon  aria-hidden="true" icon={menuOutline}/>
                  <IonLabel>Menu</IonLabel>
                </IonTabButton>
                <IonTabButton tab="tab1" href='/search' onClick={(e) => {
                  e.stopPropagation();
                  setTimeout(() => {
                    eventEmitter.emit({action: 'start_search'});
                  }, 200);
                }}>
                  <IonIcon aria-hidden="true" icon={searchOutline} />
                  <IonLabel>Search</IonLabel>
                </IonTabButton>
                {/*{*/}
                {/*  mode === 'INSERT' &&*/}
                {/*  <IonTabButton tab="tab2" href='/save' onClick={(e) => {*/}
                {/*    e.stopPropagation();*/}
                {/*    setTimeout(() => {*/}
                {/*      present({message: '正在保存...'}).then(async () => {*/}
                {/*        $('#input-hack').blur();*/}
                {/*        const workspace = await Preferences.get({ key: 'workspace' })*/}
                {/*        const openFile = await Preferences.get({ key: 'open_file' })*/}
                {/*        if (workspace.value && openFile.value) {*/}
                {/*          const contentBeforeReplace = await props.session.getCurrentContent(Path.root(), 'application/json', true);*/}
                {/*          const content = contentBeforeReplace.replaceAll(`http://localhost:51223/${workspace.value ?? 'default'}`, 'http://localhost:51223/api');*/}
                {/*          GitOperation.updateContent({workspace: workspace.value!, path: openFile.value!, content}).then(() => {*/}
                {/*            props.session.setMode('NORMAL');*/}
                {/*            dismiss();*/}
                {/*          })*/}
                {/*        } else {*/}
                {/*          dismiss();*/}
                {/*        }*/}
                {/*      })*/}
                {/*    }, 200);*/}
                {/*  }}>*/}
                {/*    <IonIcon aria-hidden="true" icon={cloudUploadOutline} />*/}
                {/*    <IonLabel>Save</IonLabel>*/}
                {/*  </IonTabButton>*/}
                {/*}*/}
                {/*{*/}
                {/*  mode === 'NORMAL' &&*/}
                {/*  <IonTabButton tab="tab3" href='/input' onClick={(e) => {*/}
                {/*    e.stopPropagation();*/}
                {/*    setTimeout(() => {*/}
                {/*      $('#input-hack').focus();*/}
                {/*      props.session.setMode('INSERT');*/}
                {/*    }, 200);*/}
                {/*  }}>*/}
                {/*    <IonIcon aria-hidden="true" icon={createOutline} />*/}
                {/*    <IonLabel>Edit</IonLabel>*/}
                {/*  </IonTabButton>*/}
                {/*}*/}
                <IonTabButton tab="tab4" href="/docs" onClick={(e) => {
                  e.stopPropagation();
                  props.session.setMode('NORMAL');
                }}>
                  <IonIcon aria-hidden="true" icon={fileTrayFullOutline} />
                  <IonLabel>Home</IonLabel>
                </IonTabButton>
                <IonTabButton tab="tab5" href="/settings">
                  <IonIcon aria-hidden="true" icon={settingsOutline} />
                  <IonLabel>Settings</IonLabel>
                </IonTabButton>
              </IonTabBar>
            </IonTabs>
          </IonReactRouter>
        }
      </IonApp>
  );
}

export default App;
