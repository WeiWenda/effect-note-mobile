import * as React from 'react';

import { Path, Session } from '../ts';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover
} from "@ionic/react";
import {chevronForwardOutline, homeOutline} from "ionicons/icons";
import {useEffect, useRef, useState} from "react";

export default function BreadcrumbsComponent(props: {session: Session}) {
  const breadCrumbPopover = useRef<HTMLIonPopoverElement>(null);
  const [collapsedBreadcrumbs, setCollapsedBreadcrumbs] = useState<HTMLIonBreadcrumbElement[]>([]);
  const [breadCrumbPopoverOpen, setBreadCrumbPopoverOpen] = useState(false);
  const [crumbs, setCrumbs] = useState<Array<{path: Path, label: string}>>([]);

  useEffect(() => {
    reloadCrumbs(props.session.viewRoot);
    props.session.on('changeViewRoot', async (path: Path) => {
      reloadCrumbs(path);
    });
  }, []);

  const reloadCrumbs = (path: Path) => {
    const crumbs: {path: Path, label: string}[]  = [];
    props.session.document.forceLoadPath(path).then(() => {
      let pathTmp = path.parent
      while (pathTmp && pathTmp.parent != null) {
        const cachedRow = props.session.document.cache.get(pathTmp.row);
        crumbs.unshift({label: cachedRow?.line.join('') ?? '', path: pathTmp})
        pathTmp = pathTmp.parent;
      }
      setCrumbs(crumbs);
    });
  }
  const zoomInto = (path: Path) => {
    props.session.zoomInto(path).then(() => {
      props.session.save();
      props.session.emit('updateInner');
    })
  }
  return (
      <>
        <IonBreadcrumbs maxItems={1} itemsAfterCollapse={0} itemsBeforeCollapse={1} onIonCollapsedClick={(e: Event) => {
          e.stopPropagation();
          setCollapsedBreadcrumbs((e as CustomEvent).detail.collapsedBreadcrumbs);
          breadCrumbPopover.current!.event = e;
          setBreadCrumbPopoverOpen(true);
        }}>
          <IonBreadcrumb onClick={(e) => {
            e.stopPropagation();
            zoomInto(Path.root())}
          }>
            <IonButton>
              <IonIcon icon={homeOutline}></IonIcon>
            </IonButton>
            <IonIcon slot="separator" icon={chevronForwardOutline}></IonIcon>
          </IonBreadcrumb>
          {
            crumbs.map(({path, label}, i) => {
              return (
                <IonBreadcrumb key={`crumb-${i}`}>
                  {label}
                  <IonIcon slot="separator" icon={chevronForwardOutline}></IonIcon>
                </IonBreadcrumb>
              );
            })
          }
        </IonBreadcrumbs>
        <IonPopover ref={breadCrumbPopover} isOpen={breadCrumbPopoverOpen} onDidDismiss={() => setBreadCrumbPopoverOpen(false)}>
          <IonContent>
            <IonList>
              {collapsedBreadcrumbs.map((breadcrumb, i) => (
                  <IonItem key={`crumb-${i}`} onClick={(e) => {
                    setBreadCrumbPopoverOpen(false);
                    setCollapsedBreadcrumbs([]);
                    zoomInto(crumbs[i].path);
                    e.stopPropagation();
                  }} lines={i === collapsedBreadcrumbs.length - 1 ? 'none' : undefined}>
                    <IonLabel>{breadcrumb.textContent}</IonLabel>
                  </IonItem>
              ))}
            </IonList>
          </IonContent>
        </IonPopover>
      </>
  );
}
