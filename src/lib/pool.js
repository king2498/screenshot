const puppeteer = require('puppeteer');
module.exports = class Pool {
    constructor() {
        this.bsAmount = process.env.CAPTURE_POOL_AMOUNT || 1; // 要启动的浏览器个数
        this.wseps = [];
        this.tabCounts = []
    }

    async init() {
        for(var i = 0; i < this.bsAmount; i++){
            const browser = await puppeteer.launch({
              ignoreHTTPSErrors: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
              ],
              defaultViewport: {
                width: 1200,
                height: 5000,
              }
            });
            this.wseps[i] = await browser.wsEndpoint();
        }
        return this.bsAmount
    }

    async newPage(width) {
        const index = Math.floor(Math.random() * this.bsAmount)
        let browserWSEndpoint = this.wseps[index];
        const browser = await puppeteer.connect({ 
          browserWSEndpoint,
          ignoreHTTPSErrors: true,
          defaultViewport: {
            width: width || 1200,
            height: 5000,
          }
        });
        browser.bindex = index
        const page = await browser.newPage();
        await this.resetBrowerTabCount(browser)
        return page;
    }
    async resetBrowerTabCount(browser) {
        if (!browser || !(browser.bindex >= 0)) return
        this.tabCounts[browser.bindex] = (await browser.pages()).length
    }
    pageCount() {
        return this.tabCounts.reduce((result, item) => result + item, 0)  
    }
}
