import { SlashCommandParser } from '../../../../../slash-commands/SlashCommandParser.js';
import { ago } from '../../lib/ago.js';
import { warn } from '../../lib/console.js';
import { STEM_ITEM_EVENT } from '../STEMItem.js';
/**@typedef {import('../STEMItem.js').STEMItem} STEMItem */

/**
 * @class
 * @template {STEMItem} T
 */
export class ManageItemsItem {
    /**@type {T} */ model;

    dom = {
        /**@type {HTMLElement} */
        root: undefined,
        /**@type {HTMLElement} */
        version: undefined,
        branch: {
            /**@type {HTMLElement} */
            label: undefined,
            /**@type {HTMLElement} */
            button: undefined,
        },
        /**@type {HTMLElement} */
        author: undefined,
        /**@type {HTMLAnchorElement} */
        url: undefined,
        actions: {
            toggle: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
            update: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
            checkUpdate: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
            gitLog: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
            readme: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
            remove: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
        },
    };




    /**
     * @param {T} model
     */
    constructor(model) {
        this.model = model;
    }




    renderItem(item) {
    }
    /**
     * @param {HTMLElement} item
     * @param {string} name
     * @returns {HTMLElement}
     */
    renderColumn(item, name) {
        switch (name) {
            case 'Name': {
                const name = document.createElement('td'); {
                    name.dataset.property = 'Name';
                    name.textContent = this.model.displayName;
                    item.append(name);
                }
                return name;
            }
            case 'Branch': {
                const branch = document.createElement('td'); {
                    branch.dataset.property = 'Branch';
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('stem--actions');
                        const branchLabel = document.createElement('div'); {
                            this.dom.branch.label = branchLabel;
                            branchLabel.classList.add('stem--branchLabel');
                            wrap.append(branchLabel);
                        }
                        const branchBtn = document.createElement('div'); {
                            this.dom.branch.button = branchBtn;
                            branchBtn.classList.add('stem--action');
                            branchBtn.classList.add('stem--branchButton');
                            branchBtn.classList.add('menu_button');
                            branchBtn.classList.add('fa-solid', 'fa-fw', 'fa-code-branch');
                            branchBtn.title = 'Switch to another branch';
                            branchBtn.addEventListener('click', async()=>{
                                if (this.model.isSparse) {
                                    this.model.unSparse();
                                } else {
                                    const branchList = this.model.branch?.all
                                        ?.filter(it=>it.startsWith('remotes/'))
                                        ?.map(it=>it.replace(/^remotes\/(?:origin\/)?/, ''))
                                        ?? []
                                    ;
                                    if (branchList?.length == 1) {
                                        toastr.info('No other branches', 'Extension Manager');
                                    } else {
                                        const branch = /**@type {string}*/(await SlashCommandParser.commands['buttons'].callback({ labels:JSON.stringify(branchList) }, 'Switch Branch'));
                                        if (branch?.length) {
                                            this.model.switchBranch(branch);
                                        }
                                    }
                                }
                            });
                            wrap.append(branchBtn);
                        }
                        branch.append(wrap);
                    }
                    item.append(branch);
                }
                return branch;
            }
            case 'Author': {
                const author = document.createElement('td'); {
                    this.dom.author = author;
                    author.dataset.property = 'Author';
                    author.textContent = this.model.author;
                    item.append(author);
                }
                return author;
            }
            case 'URL': {
                const url = document.createElement('td'); {
                    url.dataset.property = 'URL';
                    const wrap = document.createElement('span'); {
                        wrap.classList.add('stem--urlWrap');
                        const a = document.createElement('a'); {
                            this.dom.url = a;
                            a.target = '_blank';
                            a.href = this.model.homePage;
                            a.textContent = this.model.homePage;
                            a.title = `Open link in new tab\n${this.model.homePage}`;
                            wrap.append(a);
                        }
                        url.append(wrap);
                    }
                    item.append(url);
                }
                return url;
            }
            case 'Actions': {
                const actions = document.createElement('td'); {
                    actions.dataset.property = 'Actions';
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('stem--actions');
                        actions.append(wrap);
                        if (!this.model.isCore) {
                            const update = document.createElement('div'); {
                                this.dom.actions.update.button = update;
                                update.classList.add('stem--action');
                                update.classList.add('stem--update');
                                update.classList.add('menu_button');
                                update.classList.add('fa-fw');
                                const i = document.createElement('i'); {
                                    this.dom.actions.update.icon = i;
                                    i.classList.add('fa-solid', 'fa-fw');
                                    update.append(i);
                                }
                                update.addEventListener('click', async()=>{
                                    this.model.update();
                                });
                                wrap.append(update);
                            }
                            const checkUpdate = document.createElement('div'); {
                                this.dom.actions.checkUpdate.button = checkUpdate;
                                checkUpdate.classList.add('stem--action');
                                checkUpdate.classList.add('stem--checkUpdate');
                                checkUpdate.classList.add('menu_button');
                                checkUpdate.classList.add('fa-fw');
                                this.updateCheckUpdateTimestamp();
                                const i = document.createElement('i'); {
                                    this.dom.actions.checkUpdate.icon = i;
                                    i.classList.add('fa-solid', 'fa-fw', 'fa-rotate');
                                    checkUpdate.append(i);
                                }
                                checkUpdate.addEventListener('click', async()=>{
                                    this.model.checkForUpdate();
                                });
                                wrap.append(checkUpdate);
                            }
                            const gitLog = document.createElement('div'); {
                                this.dom.actions.gitLog.button = gitLog;
                                this.dom.actions.gitLog.icon = gitLog;
                                gitLog.classList.add('stem--action');
                                gitLog.classList.add('stem--gitLog');
                                gitLog.classList.add('menu_button');
                                gitLog.classList.add('fa-solid', 'fa-fw', 'fa-file-lines');
                                gitLog.title = 'Change log';
                                gitLog.addEventListener('click', async()=>{
                                    this.model.showLog();
                                });
                                wrap.append(gitLog);
                            }
                            const readme = document.createElement('div'); {
                                this.dom.actions.readme.button = readme;
                                readme.classList.add('stem--action');
                                readme.classList.add('stem--readme');
                                readme.classList.add('menu_button');
                                readme.classList.add('fa-solid', 'fa-fw', 'fa-circle-question');
                                readme.title = 'Readme';
                                readme.addEventListener('click', async()=>{
                                    this.model.showReadme();
                                });
                                wrap.append(readme);
                            }
                            const remove = document.createElement('div'); {
                                this.dom.actions.remove.button = remove;
                                this.dom.actions.remove.icon = remove;
                                remove.classList.add('stem--action');
                                remove.classList.add('menu_button');
                                remove.classList.add('fa-solid', 'fa-fw', 'fa-trash-can');
                                remove.title = 'Uninstall';
                                remove.addEventListener('click', async()=>{
                                    this.model.uninstall();
                                });
                                wrap.append(remove);
                            }
                        }
                        actions.append(wrap);
                    }
                    item.append(actions);
                }
                return actions;
            }
            case 'Version': {
                const version = document.createElement('td'); {
                    this.dom.version = version;
                    version.dataset.property = 'Version';
                    version.textContent = this.model.version;
                    item.append(version);
                }
                return version;
            }
            default: {
                warn('ManageItemsItem.renderColumn() not implemented for: ', name);
                return null;
            }
        }
    }
    /**
     *
     * @param {string[]} columns
     * @returns {HTMLElement}
     */
    render(columns) {
        const item = document.createElement('tr'); {
            this.dom.root = item;
            item.classList.add('stem--item');
            if (this.model.isModified) item.classList.add('stem--isModified');
            this.model.eventSource.on(STEM_ITEM_EVENT.BUSY, ()=>{
                item.classList[this.model.isBusy ? 'add' : 'remove']('stem--isBusy');
            });
            this.model.eventSource.on(STEM_ITEM_EVENT.UNINSTALL, ()=>{
                item.remove();
            });
            this.model.eventSource.on(STEM_ITEM_EVENT.MODIFIED, ()=>{
                item.classList.add('stem--isModified');
            });
            this.model.eventSource.on(STEM_ITEM_EVENT.ERROR, ()=>{
                item.classList.add('stem--hasErrors');
            });
            this.model.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, ()=>{
                this.updateGitStatus();
            });
            this.model.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS_CHECK, ()=>{
                this.showBusy();
            });
            this.renderItem(item);
            for (const name of columns) {
                this.renderColumn(item, name);
            }
        }
        if (this.model.isBusy) {
            this.showBusy();
            this.model.busyPromise.then(()=>this.updateGitStatus());
        } else {
            this.updateGitStatus();
        }
        return item;
    }

    showBusy() {
        this.dom.actions.update.button.title = 'Checking for updates...';
        this.dom.actions.update.icon.classList.remove(
            'fa-check',
            'fa-download',
            'fa-triangle-exclamation',
            'fa-spinner',
            'fa-bounce',
            'fa-pulse',
        );
        this.dom.actions.update.icon.classList.add(
            'fa-spinner',
            'fa-spin-pulse',
        );
    }

    updateGitStatus() {
        if (this.model.isCore) return;
        this.dom.root.classList.remove(
            'stem--isRepo',
            'stem--noRepo',
            'stem--isSparse',
            'stem--isUpToDate',
        );
        this.dom.actions.update.icon.classList.remove(
            'fa-check',
            'fa-download',
            'fa-triangle-exclamation',
            'fa-spinner',
            'fa-bounce',
            'fa-spin-pulse',
        );
        if (this.model.isRepo === false) {
            this.dom.root.classList.add(
                'stem--noRepo',
            );
            this.dom.actions.update.button.title = 'Not a Git repository';
            this.dom.actions.update.icon.classList.add(
                'fa-triangle-exclamation',
            );
            this.dom.branch.label.textContent = '';
            this.dom.branch.button.title = '';
        } else if (this.model.isRepo === true) {
            this.dom.root.classList.add(
                'stem--isRepo',
            );
            if (this.model.isSparse) {
                this.dom.root.classList.add(
                    'stem--isSparse',
                );
            }
            this.dom.branch.label.textContent = this.model.branch?.current ?? '';
            this.dom.branch.button.title = '';
            const branchList = this.model.branch?.all
                ?.filter(it=>it.startsWith('remotes/'))
                ?.map(it=>`• ${it.replace(/^remotes\/(?:origin\/)?/, '')}`)
                ?? []
            ;
            this.dom.branch.button.title = [
                ...(this.model.isSparse ? [
                    'not a full clone',
                    'Check for other branches',
                ] : [
                    branchList.length == 1 ? 'No other branches' : 'Switch to another branch',
                ]),
                '---',
                'Branches:',
                ...branchList,
            ].filter(Boolean).join('\n');
            this.dom.branch.button.dataset.count = branchList.length.toString();
            if (this.model.isUpToDate) {
                this.dom.root.classList.add(
                    'stem--noUpdate',
                );
                this.dom.actions.update.button.title = 'No update';
                this.dom.actions.update.icon.classList.add(
                    'fa-check',
                );
            } else {
                this.dom.root.classList.add(
                    'stem--hasUpdate',
                );
                this.dom.actions.update.button.title = [
                    'Download update',
                    `v${this.model.version ?? '??'}`,
                    '---',
                    (this.model.updateLog?.all ?? []).map(it=>`• ${it.message}`).join('\n'),
                ].join('\n');
                this.dom.actions.update.icon.classList.add(
                    'fa-download',
                    'fa-bounce',
                );
            }
        } else {
            this.dom.actions.update.icon.classList.add('fa-question');
            this.dom.actions.update.button.title = 'What?';
        }
    }

    updateCheckUpdateTimestamp() {
        const checkUpdate = this.dom.actions.checkUpdate.button;
        if (!checkUpdate) return;
        checkUpdate.title = [
            'Check for updates',
            '---',
            `last checked: ${this.model.checkedOn ? ago(this.model.checkedOn) : 'never'}`,
            this.model.checkedOn ? new Date(this.model.checkedOn).toLocaleString() : null,
        ].filter(it=>it).join('\n');
    }
}
