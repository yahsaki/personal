const fs = require('fs')

const data = fs.readFileSync('test.txtd')
if (data) {
  console.log(Buffer.from(data).toString('utf8'))
}

