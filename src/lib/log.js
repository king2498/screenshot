const fs = require('fs')
const path = require('path')
const dayjs = require('dayjs')

module.exports = {
    write(log) {
        // const fullFileName = path.join(__dirname,'../logs', dayjs().format('YYYY-MM-DD') + '.log.txt') //读取文件名称，目录自行可修改
        // fs.appendFileSync(fullFileName, log + '\n');
    }
}
