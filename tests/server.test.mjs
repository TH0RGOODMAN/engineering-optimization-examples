import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../scripts/serve.mjs';

test('local server serves modules and HEAD, and never exposes repository or filesystem files', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  function request(url, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: url, method }, res => {
        let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject); req.end();
    });
  }
  const root = await request('/'); assert.equal(root.status, 200); assert.match(root.body, /<!doctype html>/i);
  const module = await request('/scheduling.mjs'); assert.equal(module.status, 200); assert.match(module.headers['content-type'], /javascript/);
  const head = await request('/scheduling.mjs', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, '');
  for (const target of ['/.git/config', '/.env', '/package.json', '/scripts/serve.mjs', '/%2e%2e/.env', '/..%5cLICENSE', '/C:%5cWindows%5cwin.ini']) assert.equal((await request(target)).status, 404, target);
  assert.equal((await request('/%ZZ')).status, 400);
  assert.equal((await request('/', 'POST')).status, 405);
});
