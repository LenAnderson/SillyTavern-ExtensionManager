export class AssetRepository {
    static from(props) {
        return Object.assign(new this(), props);
    }


    /**@type {string}*/ title;
    /**@type {string}*/ url;

    constructor(title, url) {
        this.title = title;
        this.url = url;
    }

    toJSON() {
        return {
            title: this.title,
            url: this.url,
        };
    }
}
