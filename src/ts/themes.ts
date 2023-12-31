import * as React from 'react';

import { ClientStore } from './datastore';
import $ from 'jquery';

export type Theme = {
  'theme-bg-primary': string,
  'theme-bg-secondary': string,
  'theme-bg-tertiary': string,
  'theme-bg-highlight': string,

  'theme-text-primary': string,
  'theme-text-accent': string,
  'theme-text-link': string,

  'theme-trim': string,
  'theme-trim-accent': string,

  'theme-text-cursor': string,
  'theme-bg-cursor': string,
  'lineHeight': number,
  'fontSize': number,
  'fontFamily': string,
  'fontFamilyZh': string,
  'blockPaddingLeft': number,
};

export type StyleProperty =
  'theme-bg-primary' | 'theme-bg-secondary' | 'theme-bg-tertiary' | 'theme-bg-highlight' |
  'theme-text-primary' | 'theme-text-accent' | 'theme-trim' | 'theme-trim-accent' |
  'theme-link' | 'theme-cursor';

export function getStyles(clientStore: ClientStore, style_props: Array<StyleProperty>) {
  const style: React.CSSProperties = {};
  style_props.forEach((style_prop) => {
    if (style_prop === 'theme-bg-primary') {
      style.backgroundColor = clientStore.getClientSetting('theme-bg-primary');
    } else if (style_prop === 'theme-bg-secondary') {
      style.backgroundColor = clientStore.getClientSetting('theme-bg-secondary');
    } else if (style_prop === 'theme-bg-tertiary') {
      style.backgroundColor = clientStore.getClientSetting('theme-bg-tertiary');
    } else if (style_prop === 'theme-bg-highlight') {
      style.backgroundColor = clientStore.getClientSetting('theme-bg-highlight');
    } else if (style_prop === 'theme-text-primary') {
      style.color = clientStore.getClientSetting('theme-text-primary');
    } else if (style_prop === 'theme-text-accent') {
      style.color = clientStore.getClientSetting('theme-text-accent');
      style.fontWeight = 'bold';
    } else if (style_prop === 'theme-link') {
      style.color = clientStore.getClientSetting('theme-text-link');
      style.cursor = 'pointer';
      style.textDecoration = 'none';
    } else if (style_prop === 'theme-trim') {
      style.border = `1px solid ${clientStore.getClientSetting('theme-trim')}`;
    } else if (style_prop === 'theme-trim-accent') {
      style.border = `2px solid ${clientStore.getClientSetting('theme-trim-accent')}`;
    } else if (style_prop === 'theme-cursor') {
      style.backgroundColor = clientStore.getClientSetting('theme-bg-cursor');
      style.color = clientStore.getClientSetting('theme-text-cursor');
    }
  });
  return style;
}

const colors = {
  black: '#000000',
  white: '#ffffff',
  yellow: '#ffff00',
  solarized: {
    base03: '#002b36',
    base02: '#073642',
    base01: '#586e75',
    base00: '#657b83',
    base0: '#839496',
    base1: '#93a1a1',
    base2: '#eee8d5',
    base3: '#fdf6e3',
    yellow: '#b58900',
    orange: '#cb4b16',
    red: '#dc322f',
    magenta: '#d33682',
    violet: '#6c71c4',
    blue: '#268bd2',
    cyan: '#2aa198',
    green: '#859900',
  },
};

export const themes: {[key: string]: Theme} = {
  'Default': {
    'theme-bg-primary': colors.white,
    'theme-bg-secondary': '#F0F0F0',
    'theme-bg-tertiary': '#e0e0e0',
    'theme-bg-highlight': '#ccc', // '#ffa' for yellowish

    'theme-text-primary': colors.black,
    'theme-text-accent': '#dd3388',
    'theme-text-link': '#8888ff',

    'theme-trim': colors.black,
    'theme-trim-accent': '#dd3388',

    'theme-text-cursor': colors.white,
    'theme-bg-cursor': '#666',
    fontSize: 16,
    lineHeight: 30,
    blockPaddingLeft: 25,
    fontFamily: 'Arial',
    fontFamilyZh: 'PingFang SC',
  },
  'Dark': {
    'theme-bg-primary': '#000000',
    'theme-bg-secondary': '#333333',
    'theme-bg-tertiary': '#404040',
    'theme-bg-highlight': '#555', // '#770' for yellowish

    'theme-text-primary': '#eeeeee',
    'theme-text-accent': '#cccc00',
    'theme-text-link': '#8888ff',

    'theme-trim': '#eeeeee',
    'theme-trim-accent': '#cccc00',

    'theme-text-cursor': colors.black,
    'theme-bg-cursor': '#ccc',
    fontSize: 16,
    lineHeight: 30,
    blockPaddingLeft: 25,
    fontFamily: 'Arial',
    fontFamilyZh: 'PingFang SC',
  },
  'Solarized Light': {
    'theme-bg-primary': colors.solarized.base3,
    'theme-bg-secondary': colors.solarized.base2,
    'theme-bg-tertiary': '#e6dede',
    'theme-bg-highlight': '#e2ebf3',

    'theme-text-primary': colors.solarized.base00,
    'theme-text-accent': colors.solarized.magenta,
    'theme-text-link': colors.solarized.blue,

    'theme-trim': colors.solarized.base01,
    'theme-trim-accent': colors.solarized.magenta,

    'theme-text-cursor': colors.solarized.base3,
    'theme-bg-cursor': colors.solarized.cyan,
    fontSize: 15,
    lineHeight: 27,
    blockPaddingLeft: 36,
    fontFamily: 'Arial',
    fontFamilyZh: 'PingFang SC',
  },
  'Solarized Dark': {
    'theme-bg-primary': colors.solarized.base02,
    'theme-bg-secondary': colors.solarized.base03,
    'theme-bg-tertiary': '#3C4446',
    'theme-bg-highlight': '#384e55',

    'theme-text-primary': colors.solarized.base1,
    'theme-text-accent': colors.solarized.magenta,
    'theme-text-link': colors.solarized.violet,

    'theme-trim': colors.solarized.base1,
    'theme-trim-accent': colors.solarized.yellow,

    'theme-text-cursor': colors.solarized.base02,
    'theme-bg-cursor': colors.solarized.base1,
    fontSize: 15,
    lineHeight: 27,
    blockPaddingLeft: 36,
    fontFamily: 'Arial',
    fontFamilyZh: 'PingFang SC',
  },
};

export function appendStyleScript(clientStore: ClientStore) {
  const theme: Theme = {} as Theme;
  Object.keys(themes.Default).forEach((theme_property: string) => {
    // @ts-ignore
    theme[theme_property as keyof Theme] = clientStore.getClientSetting(theme_property as keyof Theme);
  });
  document.documentElement.setAttribute('data-theme',
    clientStore.getClientSetting('curTheme').includes('Dark') ? 'dark' : 'light');
  $('.node-dynamic-style').remove();
  $('#app').append(`<style class='node-dynamic-style'>
                    .session-content{padding-left: ${25 - clientStore.getClientSetting('blockPaddingLeft')}px}
                    .node .node-text{line-height: ${clientStore.getClientSetting('lineHeight')}px;min-height: ${clientStore.getClientSetting('lineHeight')}px}
                    .block{padding-left: ${clientStore.getClientSetting('blockPaddingLeft')}px}
                    .node{font-family: "${clientStore.getClientSetting('fontFamily')}","${clientStore.getClientSetting('fontFamilyZh')}",system-ui;font-size: ${clientStore.getClientSetting('fontSize')}px}
                    .rtf-toolbox{background-color: ${theme['theme-bg-primary']};color: ${theme['theme-text-primary']}}
                    </style>
                  `);
  $('.span-selection-background').remove();
  $('#app').append(`<style class='span-selection-background'>
                    .ant-tree{background-color: var(--ion-background-color);;color: ${theme['theme-text-primary']};}       
                    .ant-modal .ant-modal-content{background-color: ${theme['theme-bg-secondary']}}
                    .ant-modal .ant-modal-header{background-color: ${theme['theme-bg-secondary']}}
                    .ant-collapse-borderless > .ant-collapse-item{border-bottom: 2px solid ${theme['theme-bg-secondary']};}
                    .ant-menu:not(.ant-menu-horizontal) .ant-menu-item-selected {background-color:${theme['theme-bg-secondary']}}
                    .bullet-folded {background-color:${theme['theme-bg-tertiary']}}
                    .bullet-fa-circle:hover {background-color: ${theme['theme-bg-highlight']}}
                    .ant-collapse-item-active > .ant-collapse-header {background-color: ${theme['theme-bg-secondary']}}
                    .node-html table th{background-color: ${theme['theme-bg-secondary']}}
                    .node-html code{background-color: ${theme['theme-bg-tertiary']}}
                    .node-html blockquote{border-left-color: ${theme['theme-bg-cursor']};background-color: ${theme['theme-bg-secondary']}}
                    .node-html table tr:hover{background-color: ${theme['theme-bg-secondary']}}
                    .ant-tree .ant-tree-node-content-wrapper.ant-tree-node-selected{background-color: ${theme['theme-bg-secondary']}}
                    span::selection{background:${theme['theme-bg-highlight']}}</style>`);
  $('.span-hover-color').remove();
  $('#app').append(`<style class='span-hover-color'>
                    ion-button{color: ${theme['theme-text-primary']}}
                    .vditor-reset{color: ${theme['theme-text-primary']}}
                    .vditor-reset a{color: ${theme['theme-text-link']}}
                    .vditor-reset blockquote{color: ${theme['theme-text-primary']};border-left-color: ${theme['theme-bg-cursor']};background-color: ${theme['theme-bg-secondary']}}
                    .file-toolbar .ant-btn{color: ${theme['theme-text-primary']}}
                    .node-html a{color: ${theme['theme-text-link']}}`);
}

export const defaultTheme = themes.Default;
