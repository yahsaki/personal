const https = require('https');
const http = require('http');

const api = (type, request, payload = false) =>
  new Promise((resolve, reject) => {
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
  });

module.exports = api;
