export class ExtensionManifest {
    /**@type {string}*/ displayName;
    set display_name(value) { this.displayName = value; }
    /**@type {number}*/ loadingOrder;
    set loading_order(value) { this.loadingOrder = value; }
    /**@type {string[]}*/ requires;
    /**@type {string[]}*/ optional;
    /**@type {string}*/ js;
    /**@type {string}*/ css;
    /**@type {string}*/ author;
    /**@type {string}*/ version;
    /**@type {string}*/ homePage;
}
