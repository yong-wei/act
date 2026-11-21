// Run with node --conditions=react-server --require tsx/cjs --test <this file>.
const assert = require('node:assert/strict');
const { AsyncLocalStorage } = require('node:async_hooks');
const Module = require('node:module');
const { test } = require('node:test');
const React = require('react');
const { renderToReadableStream } = require('next/dist/compiled/react-server-dom-webpack/server.node');

test('a layout and classroom share one check, including concurrent renders and later revocation', async () => {
  const requests = new AsyncLocalStorage();
  const authPath = require.resolve('../auth.ts');
  const original = require.cache[authPath];
  const auth = new Module(authPath);
  auth.exports = { getServerAuthSession: async () => {
    const request = requests.getStore();
    request.checks++;
    await new Promise(resolve => setImmediate(resolve));
    return request.identity;
  } };
  require.cache[authPath] = auth;
  try {
    const { getRenderAuthSession } = require('../render-auth-session.ts');
    const Classroom = async () => React.createElement('span', null, await getRenderAuthSession());
    const Layout = async () => React.createElement('main', { title: await getRenderAuthSession() }, React.createElement(Classroom));
    const render = identity => requests.run({ identity, checks: 0 }, async () => {
      const stream = renderToReadableStream(React.createElement(Layout), {});
      const output = await new Response(stream).text();
      assert.equal(requests.getStore().checks, 1);
      assert.ok(output.includes(identity));
      return output;
    });
    const [first, second] = await Promise.all([render('student-alpha'), render('student-beta')]);
    assert.ok(!first.includes('student-beta'));
    assert.ok(!second.includes('student-alpha'));
    assert.ok(!(await render('access-revoked')).includes('student-alpha'));
  } finally {
    if (original) require.cache[authPath] = original;
    else delete require.cache[authPath];
  }
});
