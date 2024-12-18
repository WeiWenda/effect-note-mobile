import * as React from 'react'; // tslint:disable-line no-unused-variable
import {PluginApi, registerPlugin} from '../../../ts/plugins';
import {Document, EmitFn, Mutation, PartialUnfolder, Row, Session, Token, Tokenizer} from '../../../ts';
import {Dropdown, Image, Menu, MenuProps, message, Modal, Popover, Space, Tag } from 'antd';
import {LinkOutlined, CheckSquareOutlined, BorderOutlined, ArrowRightOutlined, ArrowLeftOutlined} from '@ant-design/icons';
import {Logger} from '../../../ts/logger';
import {getStyles} from '../../../ts/themes';
import {pluginName as tagsPluginName, TagsPlugin} from '../tags';
import {DrawioViewer} from '../../drawioViewer';
import {getTaskStatus} from './dropdownMenu';
import {MarksPlugin, pluginName} from '../marks';
import Moment from 'moment/moment';

export class LinksPlugin {
    public api: PluginApi;
    private logger: Logger;
    private session: Session;
    private document: Document;
    private tagsPlugin: TagsPlugin;
    private markPlugin: MarksPlugin;
    public SetCollapse!: new(row: Row, collpase: boolean) => Mutation;
    constructor(api: PluginApi) {
        this.api = api;
        this.logger = this.api.logger;
        this.session = this.api.session;
        this.document = this.session.document;
        this.tagsPlugin = this.api.getPlugin(tagsPluginName) as TagsPlugin;
        this.markPlugin = this.api.getPlugin(pluginName) as MarksPlugin;
    }
    public async enable() {
        const that = this;
        class SetCollapse extends Mutation {
            private row: Row;
            private collapse: boolean;

            constructor(row: Row, collapse: boolean) {
                super();
                this.row = row;
                this.collapse = collapse;
            }
            public str() {
                return `row ${this.row}, collapse ${this.collapse}`;
            }
            public async mutate(/* session */) {
                await that._setCollapse(this.row, this.collapse);
                await that.api.updatedDataForRender(this.row);
            }
            public async rewind(/* session */) {
                return [
                    new SetCollapse(this.row, !this.collapse),
                ];
            }
        }
        this.SetCollapse = SetCollapse;
        const onCheckChange = (tags: string[], prefix: string, row: number) => {
            const dateString = Moment().format('yyyy-MM-DD HH:mm:ss');
            let filteredTags = tags?.filter(t => !t.startsWith(prefix))
              .filter(t => !['Delay', 'Done', 'Todo', 'Doing'].includes(t)) || [];
            filteredTags = [prefix + dateString,  ...filteredTags];
            const newStatus = getTaskStatus(filteredTags);
            if (newStatus) {
                filteredTags = [newStatus, ...filteredTags];
            }
            return this.tagsPlugin.setTags(row, filteredTags);
        };
        const onInsertDrawio = (row: Row) => {
            that.getXml(row).then(drawio => {
                that.session.emit('openModal', 'drawio', {xml: drawio ? drawio.xml : undefined});
            });
            that.session.drawioOnSave = (xml: string) => {
                that.setXml(row, xml).then(() => {
                    that.session.emit('updateInner');
                });
            };
        };
        this.api.registerListener('session', 'setBlockCollapse', async (row: Row, collapse: boolean) => {
           await this.setBlockCollapse(row, collapse);
        });
        this.api.registerListener('session', 'clearPluginStatus', async () => {
            await this.clearLinks();
        });
        this.api.registerListener('session', 'setBoardWidth', async (row: Row, width: number) => {
            await this.setWidth(row, width);
        });
        this.api.registerListener('session', 'setMindmap', async (row: Row, img_src: string, img_json: string) => {
            await this.setPng(row, img_src, img_json);
        });
        this.api.registerListener('session', 'setDrawio',  (row: Row) => {
            onInsertDrawio(row);
        });
        this.api.registerListener('session', 'setCode', async (row: Row, code: string, language: string, wrap: boolean) => {
            await this.setCode(row, code, language, wrap);
        });
        this.api.registerListener('session', 'setDataLoom', async (row: Row, state: string, setting: string) => {
            await this.setDataLoom(row, state, setting);
        });
        this.api.registerListener('session', 'setRTF', async (row: Row, html: string) => {
            await this.setRTF(row, html);
        });
        this.api.registerListener('session', 'setSoftLink', async (row: Row, targetRow: Row) => {
            await this.setSoftLink(row, targetRow);
        });
        this.api.registerListener('session', 'setMarkdown', async (row: Row, markdown: string) => {
            await this.setMarkdown(row, markdown);
        });
        this.api.registerListener('session', 'toggleBoard', async (row: Row) => {
            const isBoardNow = await this.getIsBoard(row);
            if (isBoardNow) {
                await this.setIsBoard(row, false);
            } else {
                await this.setIsBoard(row, true);
            }
        });
        this.api.registerListener('session', 'toggleCallout', async (row: Row) => {
            const isCalloutNow = await this.getIsCallout(row);
            if (isCalloutNow) {
                await this.setIsCallout(row, false);
            } else {
                await this.setIsCallout(row, true);
            }
        });
        this.api.registerListener('session', 'toggleOrder', async (row: Row) => {
            const isOrderNow = await this.getIsOrder(row);
            if (isOrderNow) {
                await this.setIsOrder(row, false);
            } else {
                await this.setIsOrder(row, true);
            }
        });
        this.api.registerListener('session', 'toggleCheck', async (row: Row) => {
            const isCheckNow = await this.getIsCheck(row);
            if (isCheckNow === null) {
                await this.setIsCheck(row, false);
                const tags = await this.tagsPlugin.getTags(row) || [];
                await onCheckChange(tags, 'create: ', row);
            } else {
                await this.unsetIsCheck(row);
            }
        });
        this.api.registerHook('session', 'renderBullet', function(bullet, {path, rowInfo}) {
            if (rowInfo.pluginData?.links?.soft_link) {
                return (
                  <LinkOutlined className={'bullet'}
                                onClick={() => {
                                    that.session.document.canonicalPath(rowInfo.pluginData.links.soft_link).then((targetPath) => {
                                        if (targetPath) {
                                            that.session.zoomInto(targetPath).then(() => {
                                                that.session.emit('updateInner');
                                            });
                                        }
                                    });
                                }}/>
                );
            } else {
                return bullet;
            }
        });
        this.api.registerHook('document', 'pluginRowContents', async (obj, { row }) => {
            const is_board = await this.getIsBoard(row);
            const is_callout = await this.getIsCallout(row);
            const is_order = await this.getIsOrder(row);
            const is_check = await this.getIsCheck(row);
            const soft_link = await this.getSoftLink(row);
            const collapse = await this.getCollapse(row);
            const ids_to_pngs = await this.api.getData('ids_to_pngs', {});
            const png = ids_to_pngs[row] || null;
            const xml = await this.getXml(row);
            const md = await this.getMarkdown(row);
            const code = await this.getCode(row);
            const dataloom = await this.getDataLoom(row);
            const rtf = await this.getRTF(row);
            const width = await this.getWidth(row);
            obj.links = { is_callout, is_order, is_board, is_check, soft_link, collapse, png, drawio: xml, md, code, rtf, dataloom, width,
                is_special: code || xml ||  png || md || rtf || dataloom};
            return obj;
        });
        this.api.registerHook('document', 'serializeRow', async (struct, info) => {
            const collapse = await this.getCollapse(info.row);
            if (collapse !== null) {
                struct.collapse = collapse;
            }
            const isBoard = await this.getIsBoard(info.row);
            if (isBoard) {
                struct.is_board = isBoard;
            }
            const isCallout = await this.getIsCallout(info.row);
            if (isCallout) {
                struct.is_callout = isCallout;
            }
            const isOrder = await this.getIsOrder(info.row);
            if (isOrder) {
                struct.is_order = isOrder;
            }
            const isCheck = await this.getIsCheck(info.row);
            if (isCheck !== null) {
                struct.is_check = isCheck;
            }
            const softLink = await this.getSoftLink(info.row);
            if (softLink !== null) {
                struct.soft_link = softLink;
            }
            const ids_to_pngs = await this.api.getData('ids_to_pngs', {});
            if (ids_to_pngs[info.row] != null) {
                struct.png = ids_to_pngs[info.row];
            }
            const xml = await this.getXml(info.row);
            if (xml !== null) {
                struct.drawio = xml;
            }
            const md = await this.getMarkdown(info.row);
            if (md != null) {
                struct.md = md;
            }
            const rtf = await this.getRTF(info.row);
            if (rtf != null) {
                struct.rtf = rtf;
            }
            const code = await this.getCode(info.row);
            if (code != null) {
                struct.code = code;
            }
            const dataloom = await this.getDataLoom(info.row);
            if (dataloom != null) {
                struct.dataloom = dataloom;
            }
            const width = await this.getWidth(info.row);
            if (width != null) {
                struct.width = width;
            }
            return struct;
        });
        this.api.registerListener('document', 'loadRow', async (path, serialized) => {
            if (serialized.collapse) {
                await this._setCollapse(path.row, true);
            }
            if (serialized.is_board) {
                await this._setIsBoard(path.row, true);
            }
            if (serialized.width) {
                await this._setWidth(path.row, serialized.width);
            }
            if (serialized.is_callout) {
                await this._setIsCallout(path.row, true);
            }
            if (serialized.is_order) {
                await this._setIsOrder(path.row, true);
            }
            if (serialized.soft_link) {
                await this._setSoftLink(path.row, serialized.soft_link);
            }
            if (serialized.is_check !== undefined) {
                await this._setIsCheck(path.row, serialized.is_check);
            } else {
                const cursorIsCheck = await this.getIsCheck(this.session.cursor.path.row);
                if (cursorIsCheck !== null) {
                    await this._setIsCheck(path.row, false);
                    const tags: string[] = [];
                    await onCheckChange(tags, 'create: ', path.row);
                }
            }
            if (serialized.code) {
                await this._setCode(path.row, serialized.code.content, serialized.code.language, serialized.code.wrap || true);
            }
            if (serialized.dataloom) {
                await this._setDataLoom(path.row, serialized.dataloom.content, serialized.dataloom.setting);
            }
            if (serialized.rtf) {
                await this._setRTF(path.row, serialized.rtf);
            }
            if (serialized.png?.src && serialized.png?.json) {
                await this._setPng(path.row, serialized.png.src, serialized.png.json);
            }
            if (serialized.drawio) {
                if (serialized.drawio.xml) {
                    await this._setXml(path.row, serialized.drawio.xml);
                    await this._setXmlZoom(path.row, serialized.drawio.zoom);
                } else {
                    // 兼容老数据
                    await this._setXml(path.row, serialized.drawio);
                }
            }
            if (serialized.md) {
                await this._setMarkdown(path.row, serialized.md);
            }
            await this.api.updatedDataForRender(path.row);
        });
        async function addStrikeThrough(session: Session, row: Row) {
            await session.addChars(row, -1, ['~', '~']);
            await session.addChars(row, 0, ['~', '~']);
        }

        async function removeStrikeThrough(session: Session, row: Row) {
            await session.delChars(row, -2, 2);
            await session.delChars(row, 0, 2);
        }
        this.api.registerHook('session', 'renderLineContents', (lineContents, info) => {
            const { path, pluginData, parentBoard, indexInParent } = info;
            let tags: string[] = pluginData.tags?.tags || [];
            if (indexInParent) {
                lineContents.unshift(<span key={'row-number'}>{indexInParent}. </span>);
            }
            if (parentBoard) {
                lineContents.unshift(<ArrowRightOutlined key='board-right-arrow' className={'header-icon-left'}/>);
                lineContents.push(<ArrowLeftOutlined key='board-left-arrow' className={'header-icon-right'}/>);
            }
            if (pluginData.links && pluginData.links.is_check !== null) {
                lineContents.unshift(
                    pluginData.links.is_check ? <CheckSquareOutlined key={'check-icon'} className={'check-icon'} onClick={() => {
                        this.setIsCheck(path.row, false).then(() => {
                            removeStrikeThrough(this.session, path.row).then(() => {
                                this.session.emit('updateInner');
                            });
                        });
                    }} /> : <BorderOutlined key={'check-icon'} className={'check-icon'} onClick={() => {
                        onCheckChange(tags, 'end: ', path.row).then(() => {
                            this.setIsCheck(path.row, true).then(() => {
                                addStrikeThrough(this.session, path.row).then(() => {
                                    this.session.emit('updateInner');
                                });
                            });
                        });
                    }}/>
                );
            }
            return lineContents;
        });
        this.api.registerHook('session', 'renderAfterLine', (elements, {path, line, pluginData}) => {
            if (pluginData.links?.drawio != null) {
                elements.push(
                    <DrawioViewer key={'drawio'} session={that.session} row={path.row}
                                  content={pluginData.links.drawio.xml}
                                  zoom={pluginData.links.drawio.zoom}/>
                );
            }
            return elements;
        });
    }

    public async setBlockCollapse(row: Row, collapse: boolean) {
        await this.session.do(new this.SetCollapse(row, collapse));
        return null;
    }

    public async clearLinks() {
        await this.api.setData('ids_to_softlink', {});
        await this.api.setData('ids_to_pngs', {});
        await this.api.setData('ids_to_xmls', {});
        await this.api.setData('ids_to_mds', {});
        await this.api.setData('ids_to_rtfs', {});
        await this.api.setData('ids_to_codes', {});
        await this.api.setData('ids_to_collapses', {});
        await this.api.setData('ids_to_board', {});
        await this.api.setData('ids_to_order', {});
        await this.api.setData('ids_to_check', {});
        await this.api.setData('ids_to_callout', {});
        await this.api.setData('ids_to_datalooms', {});
        await this.api.setData('ids_to_width', {});
    }

    public async getPng(row: Row): Promise<any> {
        const ids_to_pngs = await this.api.getData('ids_to_pngs', {});
        return ids_to_pngs[row].json;
    }
    public async getMarkdown(row: Row): Promise<any> {
        const ids_to_mds = await this.api.getData('ids_to_mds', {});
        if (ids_to_mds[row]) {
            const markdown = await this.api.getData(row + ':md', '');
            return markdown;
        } else {
            return null;
        }
    }

    public async setMarkdown(row: Row, md: String): Promise<void> {
        await this._setMarkdown(row, md);
        await this.api.updatedDataForRender(row);
    }

    public async getCode(row: Row): Promise<any> {
        const ids_to_mds = await this.api.getData('ids_to_codes', {});
        if (ids_to_mds[row]) {
            const markdown = await this.api.getData(row + ':code', {});
            return markdown;
        } else {
            return null;
        }
    }

    public async getDataLoom(row: Row): Promise<any> {
        const ids_to_datalooms = await this.api.getData('ids_to_datalooms', {});
        if (ids_to_datalooms[row]) {
            const dataloom = await this.api.getData(row + ':dataloom', {});
            return dataloom;
        } else {
            return null;
        }
    }

    public async setCode(row: Row, content: string, language: string, wrap: boolean): Promise<void> {
        await this._setCode(row, content, language, wrap);
        await this.api.updatedDataForRender(row);
    }

    public async setDataLoom(row: Row, content: string, setting: string): Promise<void> {
        await this._setDataLoom(row, content, setting);
        await this.api.updatedDataForRender(row);
    }

    public async getRTF(row: Row): Promise<any> {
        const ids_to_rtfs = await this.api.getData('ids_to_rtfs', {});
        if (ids_to_rtfs[row]) {
            const rtf = await this.api.getData(row + ':rtf', '');
            return rtf;
        } else {
            return null;
        }
    }

    public async setRTF(row: Row, content: string): Promise<void> {
        await this._setRTF(row, content);
        await this.api.updatedDataForRender(row);
    }

    public async setSoftLink(row: Row, targetRow: Row): Promise<void> {
        await this._setSoftLink(row, targetRow);
        await this.api.updatedDataForRender(row);
    }

    private async _setCode(row: Row, content: string, language: string, wrap: boolean): Promise<void> {
        await this.api.setData(row + ':code', {content, language, wrap});
        // 不存在的key查询效率较差
        const ids_to_mds = await this.api.getData('ids_to_codes', {});
        ids_to_mds[row] = 1;
        await this.api.setData('ids_to_codes', ids_to_mds);
    }

    private async _setDataLoom(row: Row, content: string, setting: string): Promise<void> {
        await this.api.setData(row + ':dataloom', {content, setting});
        // 不存在的key查询效率较差
        const ids_to_datalooms = await this.api.getData('ids_to_datalooms', {});
        ids_to_datalooms[row] = 1;
        await this.api.setData('ids_to_datalooms', ids_to_datalooms);
    }

    private async _setRTF(row: Row, content: string): Promise<void> {
        await this.api.setData(row + ':rtf', content);
        // 不存在的key查询效率较差
        const ids_to_rtfs = await this.api.getData('ids_to_rtfs', {});
        ids_to_rtfs[row] = 1;
        await this.api.setData('ids_to_rtfs', ids_to_rtfs);
    }

    private async _setMarkdown(row: Row, md: String): Promise<void> {
        await this.api.setData(row + ':md', md);
        // 不存在的key查询效率较差
        const ids_to_mds = await this.api.getData('ids_to_mds', {});
        ids_to_mds[row] = 1;
        await this.api.setData('ids_to_mds', ids_to_mds);
    }

    public async getXml(row: Row): Promise<any> {
        const ids_to_xmls = await this.api.getData('ids_to_xmls', {});
        if (ids_to_xmls[row]) {
            const xml = await this.api.getData(row + ':xml', '');
            return {xml, zoom: ids_to_xmls[row]};
        } else {
            return null;
        }
    }

    public async setXmlZoom(row: Row, zoom: number): Promise<void> {
        await this._setXmlZoom(row, zoom);
        await this.api.updatedDataForRender(row);
    }

    public async setXml(row: Row, xml: String): Promise<void> {
        await this._setXml(row, xml);
        await this.api.updatedDataForRender(row);
    }

    private async _setXml(row: Row, xml: String): Promise<void> {
        await this.api.setData(row + ':xml', xml);
        // 不存在的key查询效率较差
        const ids_to_xmls = await this.api.getData('ids_to_xmls', {});
        if (!ids_to_xmls[row]) {
            ids_to_xmls[row] = 1;
        }
        await this.api.setData('ids_to_xmls', ids_to_xmls);
    }

    private async _setXmlZoom(row: Row, zoom: number): Promise<void> {
        // 不存在的key查询效率较差
        const ids_to_xmls = await this.api.getData('ids_to_xmls', {});
        ids_to_xmls[row] = zoom;
        await this.api.setData('ids_to_xmls', ids_to_xmls);
    }

    public async setPng(row: Row, src: String, json: any): Promise<void> {
        await this._setPng(row, src, json);
        await this.api.updatedDataForRender(row);
    }

    private async _setPng(row: Row, src: String, json: any): Promise<void> {
        const ids_to_pngs = await this.api.getData('ids_to_pngs', {});
        ids_to_pngs[row] = {src: src, json: json};
        await this.api.setData('ids_to_pngs', ids_to_pngs);
    }

    public async getCollapse(row: Row): Promise<boolean | null> {
        const ids_to_collapses = await this.api.getData('ids_to_collapses', {});
        return ids_to_collapses[row] || null;
    }

    private async _setCollapse(row: Row, mark: boolean) {
        const ids_to_collapses = await this.api.getData('ids_to_collapses', {});
        ids_to_collapses[row] = mark;
        await this.api.setData('ids_to_collapses', ids_to_collapses);
    }

    public async getWidth(row: Row): Promise<number | null> {
        const ids_to_width = await this.api.getData('ids_to_width', {});
        return ids_to_width[row] !== undefined ? ids_to_width[row] : null;
    }

    public async setWidth(row: Row, width: number): Promise<void> {
        await this._setWidth(row, width);
        await this.api.updatedDataForRender(row);
    }

    private async _setWidth(row: Row, width: number) {
        const ids_to_width = await this.api.getData('ids_to_width', {});
        ids_to_width[row] = width;
        await this.api.setData('ids_to_width', ids_to_width);
    }

    public async getIsCheck(row: Row): Promise<boolean | null> {
        const ids_to_check = await this.api.getData('ids_to_check', {});
        return ids_to_check[row] !== undefined ? ids_to_check[row] : null;
    }
    public async getSoftLink(row: Row): Promise<Row | null> {
        const ids_to_softlink = await this.api.getData('ids_to_softlink', {});
        return ids_to_softlink[row] !== undefined ? ids_to_softlink[row] : null;
    }
    public async setIsCheck(row: Row, is_board: boolean) {
        await this._setIsCheck(row, is_board);
        await this.api.updatedDataForRender(row);
    }
    public async unsetIsCheck(row: Row) {
        const ids_to_check = await this.api.getData('ids_to_check', {});
        delete ids_to_check[row];
        await this.api.setData('ids_to_check', ids_to_check);
        await this.api.updatedDataForRender(row);
    }

    private async _setIsCheck(row: Row, mark: boolean) {
        const ids_to_check = await this.api.getData('ids_to_check', {});
        ids_to_check[row] = mark;
        await this.api.setData('ids_to_check', ids_to_check);
    }

    private async _setSoftLink(row: Row, targetRow: Row) {
        const ids_to_softlink = await this.api.getData('ids_to_softlink', {});
        ids_to_softlink[row] = targetRow;
        await this.api.setData('ids_to_softlink', ids_to_softlink);
    }

    public async getIsBoard(row: Row): Promise<boolean | null> {
        const ids_to_board = await this.api.getData('ids_to_board', {});
        return ids_to_board[row] || null;
    }
    public async setIsBoard(row: Row, is_board: boolean) {
        await this._setIsBoard(row, is_board);
        await this.api.updatedDataForRender(row);
    }
    private async _setIsBoard(row: Row, mark: boolean) {
        const ids_to_board = await this.api.getData('ids_to_board', {});
        ids_to_board[row] = mark;
        await this.api.setData('ids_to_board', ids_to_board);
    }
    public async getIsCallout(row: Row): Promise<boolean | null> {
        const ids_to_callout = await this.api.getData('ids_to_callout', {});
        return ids_to_callout[row] || null;
    }
    public async setIsCallout(row: Row, is_callout: boolean) {
        await this._setIsCallout(row, is_callout);
        await this.api.updatedDataForRender(row);
    }
    private async _setIsCallout(row: Row, is_callout: boolean) {
        const ids_to_callout = await this.api.getData('ids_to_callout', {});
        ids_to_callout[row] = is_callout;
        await this.api.setData('ids_to_callout', ids_to_callout);
    }
    public async getIsOrder(row: Row): Promise<boolean | null> {
        const ids_to_order = await this.api.getData('ids_to_order', {});
        return ids_to_order[row] || null;
    }
    public async setIsOrder(row: Row, is_order: boolean) {
        await this._setIsOrder(row, is_order);
        await this.api.updatedDataForRender(row);
    }
    private async _setIsOrder(row: Row, mark: boolean) {
        const ids_to_order = await this.api.getData('ids_to_order', {});
        ids_to_order[row] = mark;
        await this.api.setData('ids_to_order', ids_to_order);
    }
}
export const linksPluginName = 'Links';
registerPlugin<LinksPlugin>(
    {
        name: linksPluginName,
        author: 'WeiWenda',
        description: (
            <div>
                允许每个节点增加一个http外链，用于提供pdf、ppt、wiki。
            </div>
        ),
        dependencies: [tagsPluginName, pluginName],
    },
    async function(api) {
        const linksPlugin = new LinksPlugin(api);
        await linksPlugin.enable();
        return linksPlugin;
    },
    (api => api.deregisterAll()),
);
