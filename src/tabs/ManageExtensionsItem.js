import { executeSlashCommandsWithOptions } from '../../../../../slash-commands.js';
import { SlashCommandParser } from '../../../../../slash-commands/SlashCommandParser.js';
import { ago } from '../../lib/ago.js';
import { Extension } from '../Extension.js';

export class ManageExtensionsItem {
    /**@type {Extension} */ extension;

    dom = {
        /**@type {HTMLElement} */
        root: undefined,
        branch: {
            /**@type {HTMLElement} */
            label: undefined,
            /**@type {HTMLElement} */
            button: undefined,
        },
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
            errorLog: {
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
     * @param {Extension} extension
     */
    constructor(extension) {
        this.extension = extension;
    }




    render() {
        const manifest = this.extension;
        const item = document.createElement('tr'); {
            this.dom.root = item;
            item.classList.add('stem--item');
            if (manifest.isCore) item.classList.add('stem--isCore');
            if (manifest.isDisabled) item.classList.add('stem--isDisabled');
            if (manifest.isModified) item.classList.add('stem--isModified');
            manifest.eventSource.on(Extension.EVENT.BUSY, ()=>{
                item.classList[manifest.isBusy ? 'add' : 'remove']('stem--isBusy');
            });
            manifest.eventSource.on(Extension.EVENT.STATE, ()=>{
                item.classList[manifest.isDisabledNow ? 'add' : 'remove']('stem--isDisabled');
                this.dom.actions.toggle.title = manifest.isDisabledNow ? 'Enable extension' : 'Disable extension';
            });
            manifest.eventSource.on(Extension.EVENT.UNINSTALL, ()=>{
                item.remove();
            });
            manifest.eventSource.on(Extension.EVENT.MODIFIED, ()=>{
                item.classList.add('stem--isModified');
            });
            manifest.eventSource.on(Extension.EVENT.ERROR, ()=>{
                item.classList.add('stem--hasErrors');
            });
            manifest.eventSource.on(Extension.EVENT.GIT_STATUS, ()=>{
                this.updateGitStatus();
            });
            manifest.eventSource.on(Extension.EVENT.GIT_STATUS_CHECK, ()=>{
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
            });
            const name = document.createElement('td'); {
                name.dataset.property = 'Name';
                name.textContent = manifest.displayName;
                item.append(name);
            }
            const source = document.createElement('td'); {
                source.dataset.property = 'Source';
                const icon = document.createElement('div'); {
                    icon.classList.add('stem--source');
                    icon.classList.add('fa-solid', 'fa-fw');
                    if (manifest.isCore) {
                        icon.classList.add('stem--core');
                        source.title = 'Core extension';
                    } else {
                        icon.classList.add('fa-cubes');
                        source.title = 'Third-party extension';
                    }
                    source.append(icon);
                }
                item.append(source);
            }
            const version = document.createElement('td'); {
                version.dataset.property = 'Version';
                version.textContent = manifest.version;
                item.append(version);
            }
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
                            if (this.extension.isSparse) {
                                this.extension.unSparse();
                            } else {
                                const branchList = this.extension.branch?.all
                                    ?.filter(it=>it.startsWith('remotes/'))
                                    ?.map(it=>it.replace(/^remotes\/(?:origin\/)?/, ''))
                                    ?? []
                                ;
                                if (branch?.length == 1) {
                                    toastr.info('No other branches', 'Extension Manager');
                                } else {
                                    const branch = await SlashCommandParser.commands['buttons'].callback({ labels:JSON.stringify(branchList) }, 'Switch Branch');
                                    if (branch?.length) {
                                        this.extension.switchBranch(branch);
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
            const author = document.createElement('td'); {
                author.dataset.property = 'Author';
                author.textContent = manifest.author;
                item.append(author);
            }
            const url = document.createElement('td'); {
                url.dataset.property = 'URL';
                if (!manifest.isCore) {
                    const wrap = document.createElement('span'); {
                        wrap.classList.add('stem--urlWrap');
                        const a = document.createElement('a'); {
                            a.href = manifest.homePage;
                            a.target = '_blank';
                            a.textContent = manifest.homePage;
                            a.title = `Open link in new tab\n${manifest.homePage}`;
                            wrap.append(a);
                        }
                        url.append(wrap);
                    }
                }
                item.append(url);
            }
            const actions = document.createElement('td'); {
                actions.dataset.property = 'Actions';
                const wrap = document.createElement('div'); {
                    wrap.classList.add('stem--actions');
                    actions.append(wrap);
                    const toggle = document.createElement('div'); {
                        this.dom.actions.toggle.button = toggle;
                        this.dom.actions.toggle.icon = toggle;
                        toggle.classList.add('stem--toggle');
                        toggle.classList.add('stem--action');
                        toggle.classList.add('menu_button');
                        toggle.classList.add('fa-solid', 'fa-fw', 'fa-power-off');
                        toggle.title = manifest.isDisabledNow ? 'Enable extension' : 'Disable extension';
                        toggle.addEventListener('click', async(evt)=>{
                            manifest.toggleState();
                        });
                        wrap.append(toggle);
                    }
                    if (!manifest.isCore) {
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
                                manifest.update();
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
                                manifest.checkForUpdate();
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
                                manifest.showLog();
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
                                manifest.showReadme();
                            });
                            wrap.append(readme);
                            fetch(`/scripts/extensions/${manifest.name}/README.md`, { method:'HEAD' }).then((res)=>{
                                if (res.ok) {
                                    this.dom.root?.classList.add('stem--hasReadme');
                                }
                            });
                        }
                        const errorLog = document.createElement('div'); {
                            this.dom.actions.errorLog.button = errorLog;
                            this.dom.actions.errorLog.icon = errorLog;
                            errorLog.classList.add('stem--action');
                            errorLog.classList.add('stem--errorLog');
                            errorLog.classList.add('menu_button');
                            errorLog.classList.add('fa-stack', 'fa-fw');
                            errorLog.title = 'Errors';
                            errorLog.addEventListener('click', async()=>{
                                manifest.showErrors();
                            });
                            const iconFile = document.createElement('i'); {
                                iconFile.classList.add('fa-solid', 'fa-stack-1x', 'fa-file');
                                errorLog.append(iconFile);
                            }
                            const iconExclamation = document.createElement('i'); {
                                iconExclamation.classList.add('fa-solid', 'fa-stack-1x', 'fa-exclamation');
                                errorLog.append(iconExclamation);
                            }
                            wrap.append(errorLog);
                        }
                        const remove = document.createElement('div'); {
                            this.dom.actions.remove.button = remove;
                            this.dom.actions.remove.icon = remove;
                            remove.classList.add('stem--action');
                            remove.classList.add('menu_button');
                            remove.classList.add('fa-solid', 'fa-fw', 'fa-trash-can');
                            remove.title = 'Remove extension';
                            remove.addEventListener('click', async()=>{
                                manifest.uninstall();
                            });
                            wrap.append(remove);
                        }
                    }
                    actions.append(wrap);
                }
                item.append(actions);
            }
        }
        this.updateGitStatus();
        return item;
    }

    updateGitStatus() {
        if (this.extension.isCore) return;
        const manifest = this.extension;
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
        if (manifest.isRepo === false) {
            this.dom.root.classList.add(
                'stem--noRepo',
            );
            this.dom.actions.update.button.title = 'Not a Git repository';
            this.dom.actions.update.icon.classList.add(
                'fa-triangle-exclamation',
            );
            this.dom.branch.label.textContent = '';
            this.dom.branch.button.title = '';
        } else if (manifest.isRepo === true) {
            this.dom.root.classList.add(
                'stem--isRepo',
            );
            if (manifest.isSparse) {
                this.dom.root.classList.add(
                    'stem--isSparse',
                );
            }
            this.dom.branch.label.textContent = manifest.branch?.current ?? '';
            this.dom.branch.button.title = '';
            const branchList = manifest.branch?.all
                ?.filter(it=>it.startsWith('remotes/'))
                ?.map(it=>`• ${it.replace(/^remotes\/(?:origin\/)?/, '')}`)
                ?? []
            ;
            this.dom.branch.button.title = [
                ...(manifest.isSparse ? [
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
            if (manifest.isUpToDate) {
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
                    `v${manifest.version ?? '??'}`,
                    '---',
                    (manifest.updateLog?.all ?? []).map(it=>`• ${it.message}`).join('\n'),
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
        const manifest = this.extension;
        const checkUpdate = this.dom.actions.checkUpdate.button;
        if (!checkUpdate) return;
        checkUpdate.title = [
            'Check for updates',
            '---',
            `last checked: ${manifest.checkedOn ? ago(manifest.checkedOn) : 'never'}`,
            manifest.checkedOn ? new Date(manifest.checkedOn).toLocaleString() : null,
        ].filter(it=>it).join('\n');
    }
}
