const Koa = require('koa');
const Router = require('@koa/router');
const Pool = require('./lib/pool')
const Website = require('./lib/website')
const app = new Koa();
const router = new Router();
const dayjs = require('dayjs')
const log = require('./lib/log')
// 网站截图使用连接池
const pool = new Pool()
router.get('/', (ctx, next) => {
  ctx.body = '网页截图服务';
});
const recordTime = (website) => {
    return [
      {
          name: '打开Tab',
          value: 'newTabTime'
      },
      {
        name: '加载页面',
        value: 'openPageTime'
      },
      {
        name: '截图',
        value: 'screenshotTime'
      },
      {
        name: '水印',
        value: 'waterMarkTime'
      }
    ].filter(item => website[item.value]).map(item => `${item.name}：${website[item.value]}s`).join('  ')
}
// 普通网站的截图
router.get('/screenshot', async (ctx, next) => {
  let params = ['url', 'htitle', 'hlink'].reduce((result, key) => {
    if (ctx.query[key] !== undefined) {
      result[key] = ctx.query[key]
    }
    return result
  }, {})
  // 验证参数
  if (!params.url) {
    ctx.body = {
      status: 501,
      msg: '缺少参数，必须包含如下参数：\r\n' + JSON.stringify({
        url: '网站地址'
      })
    }
    return
  }

  ctx.set('Access-Control-Allow-Origin', '*')
  ctx.set('Access-Control-Allow-Methods', 'GET')
  let totalTimeStart = Date.now()
  const website = new Website(params.url, pool, params.htitle, params.hlink)
  try {
    let screenshot = await website.screenshot()
    log.write(`【${dayjs().format('MM-DD HH:mm:ss')}】成功 > 总耗时：${(Date.now() - totalTimeStart) / 1000}s ${recordTime(website)}  总Tab数：${pool.pageCount()}  网站：${params.url}  请求：${ctx.url}`)
    ctx.body = {
      status: 200,
      data: screenshot
    }
  } catch (e) {
    const errorMsg = `【${dayjs().format('MM-DD HH:mm:ss')}】！失败 > 总耗时：${(Date.now() - totalTimeStart) / 1000}s ${recordTime(website)}  总Tab数：${pool.pageCount()}  网站：${params.url}  请求：${ctx.url} 错误信息：${e.message}`
    log.write(errorMsg)
    await website.close()
    ctx.body = {
      status: 502,
      msg: '截图超时，请检查参数是否有效' + errorMsg
    }
  }
});

app
  .use(router.routes())
  .use(router.allowedMethods());

const start = async () => {
  const poolAmount = await pool.init();
  console.log(`初始化puppter连接池完成，共 ${poolAmount} 个`)
  app.listen(3000);
  console.log(`服务已启动....`)
}


start()


