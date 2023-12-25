import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact, useIonLoading, useIonToast
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {searchOutline, fileTrayFullOutline, settingsOutline, createOutline, cloudUploadOutline} from 'ionicons/icons';
import DocComponent from './pages/DocComponent';
import SettingComponent from './pages/SettingComponent';
import { App as AppPlugin } from '@capacitor/app';
import { Clipboard } from '@capacitor/clipboard';

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
import {config, KeyBindings, keyDefinitions, Session, KeyHandler, KeyEmitter, Path, RegisterTypes, SerializedBlock} from "./ts";
import {useEffect, useState} from "react";
import {appendStyleScript, Theme, themes} from "./ts/themes";
import {PluginsManager} from "./ts/plugins";
import {Preferences} from "@capacitor/preferences";
import './components/plugins';
import {GitOperation} from "./plugins/git-operation";
import {message} from "antd";

setupIonicReact();

function App (props: {session: Session}) {
  const eventEmitter = useEventEmitter<{[key: string]: string}>()
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(props.session.mode)
  const [present, dismiss] = useIonLoading();
  const [presentMessage] = useIonToast();
  const applyTheme = (themeName: string) => {
    let theme: Theme;
    if (themeName === 'auto') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? themes.Default : themes.Dark;
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.body.classList.toggle('dark', false);
      } else {
        document.body.classList.toggle('dark', true);
      }
    } else {
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
  useEffect(() => {
    Preferences.get({ key: 'theme' }).then(r => applyTheme(r.value ?? 'auto'));
    const mappings = config.defaultMappings;
    const keyBindings = new KeyBindings(keyDefinitions, mappings);
    const pluginManager = new PluginsManager(props.session, config, keyBindings);
    let enabledPlugins = ['Marks', 'Tags', 'Links', 'HTML', 'Todo', 'Markdown', 'CodeSnippet', 'LaTeX', 'DataLoom'];
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
        eventEmitter.emit({action: 'persist_unsave'})
      }
    });
    return () => {
      AppPlugin.removeAllListeners();
    };
  }, []);
  eventEmitter.useSubscription(val => {
    if (val['action'] === 'theme_change') {
      Preferences.get({ key: 'theme' }).then(r => applyTheme(r.value ?? 'auto'));
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
            <IonTabs>
              <IonRouterOutlet>
                <Route exact path="/docs">
                  <DocComponent session={props.session} eventBus={eventEmitter} />
                </Route>
                <Route exact path="/settings">
                  <SettingComponent eventBus={eventEmitter} />
                </Route>
                <Route exact path="/search">
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
                <IonTabButton tab="tab1" href='/search' onClick={(e) => {
                  e.stopPropagation();
                  setTimeout(() => {
                    eventEmitter.emit({action: 'start_search'});
                  }, 200);
                }}>
                  <IonIcon aria-hidden="true" icon={searchOutline} />
                  <IonLabel>Search</IonLabel>
                </IonTabButton>
                {
                  mode === 'INSERT' &&
                  <IonTabButton tab="tab2" href='/save' onClick={(e) => {
                    e.stopPropagation();
                    setTimeout(() => {
                      present({message: '正在保存...'}).then(async () => {
                        const workspace = await Preferences.get({ key: 'workspace' })
                        const openFile = await Preferences.get({ key: 'open_file' })
                        if (workspace.value && openFile.value) {
                          const contentBeforeReplace = await props.session.getCurrentContent(Path.root(), 'application/json', true);
                          const content = contentBeforeReplace.replaceAll(`http://localhost:51223/${workspace.value ?? 'default'}`, 'http://localhost:51223/api');
                          GitOperation.updateContent({workspace: workspace.value!, path: openFile.value!, content}).then(() => {
                            props.session.setMode('NORMAL');
                            dismiss();
                          })
                        } else {
                          dismiss();
                        }
                      })
                    }, 200);
                  }}>
                    <IonIcon aria-hidden="true" icon={cloudUploadOutline} />
                    <IonLabel>Save</IonLabel>
                  </IonTabButton>
                }
                {
                  mode === 'NORMAL' &&
                  <IonTabButton tab="tab3" href='/input' onClick={(e) => {
                    e.stopPropagation();
                    setTimeout(() => {
                      props.session.setMode('INSERT');
                    }, 200);
                  }}>
                    <IonIcon aria-hidden="true" icon={createOutline} />
                    <IonLabel>Edit</IonLabel>
                  </IonTabButton>
                }
                <IonTabButton tab="tab4" href="/docs">
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
