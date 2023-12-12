/* Utilities for stuff related to being in the browser */
import Session from '../session';
import { DocInfo } from '../types';

export function encodeHtml(content: string) {
    return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

export const htmlTypes: Array<string> = [
    'div',
    'img',
    'table'
];

const htmlRegexParts: Array<string> = [];
htmlRegexParts.push(
  `<span(.|\\n)*?>([^<]*?)</span>`
);
htmlRegexParts.push(
  `<span(.|\\n)*/>`
);
htmlRegexParts.push(
  `<a(.|\\n)*?href="(.*?)">([^<]*?)</a>`
);
htmlTypes.forEach((htmltype) => {
    htmlRegexParts.push(
      `<${htmltype}(.|\\n)*>(.*?)</${htmltype}>`
    );
    // self-closing
    htmlRegexParts.push(
      `<${htmltype}(.|\\n)*/>`
    );
});
export const htmlRegex = '(' + htmlRegexParts.map((part) => '(' + part + ')').join('|') + ')';

export function onlyUnique(value: string, index: number, self: string[]) {
    return self.indexOf(value) === index;
}

export function constructDocInfo(filepath: string): DocInfo {
    const paths = filepath.split('/');
    const nameSplits = paths.pop()!.split(new RegExp('[#\[\\]\.]'));
    const id = Number(nameSplits.shift());
    const name = nameSplits.shift();
    const tag = paths.join('/');
    const otherTags = nameSplits.filter(split => {
        return split && split !== 'json' && split !== 'effect'
    })
    return {name,
        filename: filepath.split('/').pop(),
        tag: tag ? JSON.stringify([tag].concat(otherTags)) : JSON.stringify([]),
        id,
        filepath}
}

export function mimetypeLookup(filename: string): string | undefined {
    const parts = filename.split('.');
    const extension = parts.length > 1 ? parts[parts.length - 1] : '';
    const extensionLookup: {[key: string]: string} = {
        'pdf': 'application/pdf',
        'md': 'text/markdown',
        'opml': 'text/x-opml',
        'json': 'application/json',
        'txt': 'text/plain',
        '': 'text/plain',
    };
    return extensionLookup[extension.toLowerCase()];
}

export function mimetypeLookupByContent(content: string): string | undefined {
    const trimed = content.trim();
    if (trimed.startsWith('<')) {
        return undefined;
    } else if (trimed.startsWith('-')) {
        return 'text/plain';
    } else if (trimed.startsWith('{')) {
        return 'application/json';
    } else {
        return undefined;
    }
}
