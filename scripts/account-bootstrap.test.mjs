import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const path of ['index.html', ...(existsSync('dist/index.html') ? ['dist/index.html'] : [])]) {
  test(`${path}: explicit account helper loads only on exact production origin`, () => {
    const html = readFileSync(path, 'utf8');
    const match = html.match(/rj-account-bootstrap:start[\s\S]*?<script>([\s\S]*?)<\/script>[\s\S]*?rj-account-bootstrap:end/);
    assert.ok(match, 'Explicit bootstrap exists');
    assert.ok(html.indexOf('rj-account-bootstrap:start') < html.indexOf('id="root"'));
    function execute({origin = 'https://rejson59.github.io', installed = false, tagged = false} = {}) {
      let written = '';
      runInNewContext(match[1], {
        location: { origin }, window: { RejsonAccount: installed ? {} : undefined },
        document: { querySelector: () => tagged, write: text => { written += text; } },
      });
      return written;
    }
    assert.match(execute(), /<script defer src="\/js\/rejson-account\.js\?v=1"/);
    assert.match(execute(), /rj:account-error/);
    for (const origin of ['https://rejson59.github.io.evil.example', 'http://rejson59.github.io', 'https://rejson59.github.io:444', 'https://preview.vercel.app', 'http://localhost:4173', 'null']) assert.equal(execute({origin}), '');
    assert.equal(execute({installed:true}), ''); assert.equal(execute({tagged:true}), '');
    assert.doesNotMatch(execute(), /[?&](token|session)=/i);
  });
}
