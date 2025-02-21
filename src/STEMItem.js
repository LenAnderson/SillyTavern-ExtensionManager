import { EventEmitter } from '../../../../../lib/eventemitter.js';

/**
 * @typedef {Object} STEMItem
 * @property {string} name
 * @property {string} displayName
 * @property {string} version
 * @property {string} author
 * @property {string} homePage
 * @property {boolean} isCore
 *
 * @property {boolean} isUpToDate
 * @property {object[]} updateLog
 * @property {boolean} isUpdated
 * @property {boolean} isModified
 * @property {boolean} isBusy
 * @property {Promise} busyPromise
 * @property {boolean} isRepo
 * @property {boolean} isSparse
 * @property {{current:string, detached:boolean, all:string[], branches:{[name:string]:{}}}} branch
 * @property {number} checkedOn
 *
 * @property {EventEmitter} eventSource
 *
 * @property {()=>Promise} uninstall
 * @property {()=>Promise} checkForUpdate
 * @property {()=>Promise} update
 * @property {()=>Promise} unSparse
 * @property {(branch:string)=>Promise} switchBranch
 * @property {()=>Promise} showLog
 * @property {()=>Promise} showReadme
 */


/** @readonly */
/** @enum {string} */
export const STEM_ITEM_EVENT = {
    /** enabled / disabled (this.isDisabled) */
    STATE: 'state',
    /** item has been installed */
    INSTALL: 'install',
    /** item has been uninstalled */
    UNINSTALL: 'uninstall',
    /** git status is being checked */
    GIT_STATUS_CHECK: 'gitStatusCheck',
    /** git status has been updated */
    GIT_STATUS: 'gitStatus',
    /** async task started or stopped (this.isBusy) */
    BUSY: 'busy',
    /** item requires refresh (this.isModified) */
    MODIFIED: 'modified',
    /** exception from this item has been caught */
    ERROR: 'error',
};
