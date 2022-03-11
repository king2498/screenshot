const puppeteer = require('puppeteer');
const { registerFont, createCanvas, Image } = require('canvas');
const dayjs  = require('dayjs')
const path = require('path')

module.exports = class Task {
  constructor(url, pool, htitle, hlink) {
    this.url = url
    this.pool = pool
    this.htitle = htitle
    this.hlink = (hlink || '').replace(/^http[s]?:\/\/[^\/]+\//, '').replace(/\/+$/, '')
  }

  waitForTime = (ms) => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, ms)
    })
  }

  async testNewPage() {
    const browser = await puppeteer.launch({
      ignoreHTTPSErrors: true,
      // headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list'
      ],
      defaultViewport: {
        width: 1200,
        height: 5000
      }
    })

    return await browser.newPage();
  }

  // 针对微博的反爬机制，加入检测 微博有一个跳转，需要等跳转成功之后（拿到正常的某个元素）才算成功加载页面
  isWeibo() {
      return /^(http(s)?:\/\/)?(www\.)?weibo.com/.test(this.url)
  }

  async isWeiboLoaded() {
    if (this.isWeibo()){
        await this.page.waitForSelector('.logo'); // 该元素可能会变，需要维护
    }
  }


  async pageLoad() {
    let start = Date.now()
    this.page = await this.pool.newPage(1600);
    this.newTabTime = (Date.now() - start) / 1000
    // this.page = await this.testNewPage();
    this.page.setDefaultNavigationTimeout(60000);
    start = Date.now()
    await this.page.goto(this.url, {
      timeout: 60000
    });
    await this.isWeiboLoaded()
    await this.waitForTime(3000) // 等待DOM图表渲染完成
    this.openPageTime = (Date.now() - start) / 1000
  }

  async waterMark(bodySize,base64) {
    const canvas = createCanvas(bodySize.width, bodySize.height)
    const ctx = canvas.getContext('2d')
    registerFont(path.resolve(__dirname, '../fonts/msyhbd.ttc'), {family: 'msyhbd'});
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    ctx.drawImage(img,0,0)
    ctx.font = '42px msyhbd';
    ctx.fillStyle = '#000';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    let date = dayjs().format('YYYY-MM-DD HH:mm:ss')
    ctx.fillText(`截图日期：${date}`, 20, 40);
    return canvas.toDataURL('image/jpeg', 0.6).replace('data:image/jpeg;base64,', '');
    
  }

  // 截图之前需要处理某些元素的样式，比如高亮莫个链接
  async hilightLink() {
    const hasHlink = this.hlink && this.hlink.trim().length > 5
    const hasHtitle = this.htitle && this.htitle.trim().length > 1
    if (!hasHlink && !hasHtitle) return

    await this.page.$$eval('a', (links, hlink, htitle, hasHlink, hasHtitle) => {
        const linkMatchs = []
        const titleMatchs = []
        links.forEach(item => {
            // 注意这里 item.href 有可能不是一个字符串 有可能是 {}
            if (item.href && typeof item.href  === 'string' && item.href.trim()) {
                // const distHref = item.href.trim().replace(/^http[s]?:\/\//, '').replace(/\/+$/, '')
                
                // 先用url匹配 如果没有匹配到则改用title做完全匹配
                if(hasHlink && item.href.includes(hlink)) {
                    linkMatchs.push(item)
                }
                
                if (hasHtitle && item.text && htitle.trim() === item.text.trim()) {
                  titleMatchs.push(item)
                }
            }
        })
        const resultLinks = linkMatchs[0] ? linkMatchs : titleMatchs
        resultLinks.forEach(link => {
            link.style.background = 'yellow';
            link.style.border = 'red 2px solid';
        })
        // return links.map(item => item.href).filter(href => typeof href !== 'string')
    }, this.hlink, this.htitle, hasHlink, hasHtitle);
    // console.log('+++', result);
  }

  
  // 微博的整体网页会随着高度一起变高，所以需要拿  main 的高度
  async weiboHeight() {
      const mainHandle = await this.page.$('main');
      const mainSize = await mainHandle.boundingBox()
      return mainSize.height
  }

  // 获取网页实际的内容宽高
  async getBodySize() {
      const bodyHandle = await this.page.$('html');
      const bodySize = await bodyHandle.boundingBox()
      if (this.isWeibo()) {
          bodySize.height = await this.weiboHeight()
      }
      return bodySize
  }

  async screenshot() {
    await this.pageLoad()
    await this.hilightLink();

    // 测试是否有拦截
    // const hanle = await this.page.$('body');
    // const html = await this.page.evaluate(body => body.innerHTML, hanle);
    // console.log('===', html)

    const startTime = Date.now()
    const bodySize = await this.getBodySize();
    const base64 = await this.page.screenshot({ encoding: 'base64', fullPage: true })
    await this.close()
    this.screenshotTime = (Date.now() - startTime) / 1000
    const waterMarkStart = Date.now()
    const result = await this.waterMark(bodySize, base64)
    this.waterMarkTime = (Date.now() - waterMarkStart) / 1000
    return result
  }
  
  async close() {
    try {
      const browser = this.page.browser()
      await this.page.close();
      await this.pool.resetBrowerTabCount(browser)
    } catch (e) {}
  }
}
