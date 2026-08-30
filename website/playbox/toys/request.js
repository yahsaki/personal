const https = require('https')
const http = require('http')

const retryablePauseAmount = 300000 // 5m
const retryCount = 3

delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms))

const api = async (type, request, payload = false) => {
  let proceed = false
  const rd = {} // request data
  let res
  while (!proceed) {

    try {
      res = await getRequestPromise(type, request, payload)
    } catch(err) {
      let info
      /*
       non retryable: ENOTFOUND

       retryable: ???
       */
      console.log('req err', err)
      if (err.context?.response?.statusCode === 404) {
        proceed = true
      } else if (err.context?.response?.statusCode === 503) {
        const type = '503'
        if (!rd[type]) { rd[type] = {attempts:0,type} }
        info = rd[type]
      } else {
        // I dont remember the fuggin error codes, just toss them under generic
        // TODO: log the errors. steal logging methodology from CIA(lol)
        const type = 'generic'
        if (!rd[type]) { rd[type] = {attempts:0,type} }
        info = rd[type]
      }

      if (info) {
        if (info.attempts > retryCount) {
          // give up
          proceed = true
          rd.error = err
        } else {
          // TODO: add more info to log once playbox'ed
          console.log(`${info.attempts+1}/${retryCount} encountered ${info.type}, retrying in 5 minutes`)
          // TODO: proper delay here(dont forget)
          await delay(retryablePauseAmount)
          info.attempts += 1
        }
      }
    }

    if (res) { proceed = true }
  }

  if (rd.error) { throw Error(rd.error) }
  return res
}

function getRequestPromise(type, request, payload) {
  return new Promise((resolve, reject) => {
    const query = Object.assign({}, request);
    if (payload) {
      query.headers = {
        ...query.headers,
        'Content-Length': Buffer.byteLength(payload),
      };
    }

    if (type === 'https') {
      const req = https.request(query, res => {
        if (res.statusCode < 200 || res.statusCode > 399) {
          reject(Object.assign(new Error(`Failed to load page, status code: ${res.statusCode}`), {
            context: {
              body: payload,
              response: res,
              request,
            },
          }));
        }
        const body = [];
        res.on('data', body.push.bind(body));
        res.on('end', () => resolve(Buffer.concat(body)));
      });
      req.on('error', err => reject(err));
      if (payload) req.write(payload);
      req.end();
    } else {
      const req = http.request(query, res => {
        if (res.statusCode < 200 || res.statusCode > 399) {
          reject(Object.assign(new Error(`Failed to load page, status code: ${res.statusCode}`), {
            context: {
              body: payload,
              request,
            },
          }));
        }
        const body = [];
        res.on('data', body.push.bind(body));
        res.on('end', () => resolve(Buffer.concat(body)));
      });
      req.on('error', err => reject(err));
      req.on('socket', socket => {
        socket.setTimeout(30000);
        socket.on('timeout', () => {
          req.abort();
        });
      });
      if (payload) req.write(payload);
      req.end();
    }
  })
}
module.exports = api;
