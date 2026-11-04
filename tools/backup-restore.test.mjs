import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBundle, verifyBundle } from './backup-common.mjs';
import { restoreBundle } from './restore-db.mjs';

function populate(filename) {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE entities(kind TEXT,id TEXT,payload TEXT); CREATE TABLE wallet_accounts(user_id TEXT PRIMARY KEY,balance_cents INTEGER); CREATE TABLE wallet_entries(id INTEGER PRIMARY KEY,amount_cents INTEGER); CREATE TABLE sessions(token TEXT); INSERT INTO sessions VALUES('temporary-fixture-token'); INSERT INTO entities VALUES('merchant','test','{}'); INSERT INTO wallet_accounts VALUES('user',0)");
  return db;
}
test('online backup includes committed WAL rows, preserves wallet invariants and media; restore and rollback snapshot work', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wxsam-backup-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'live.sqlite'), media = path.join(root, 'media');
  await fs.mkdir(media); await fs.writeFile(path.join(media, 'receipt.jpg'), 'private-test-fixture');
  const live = populate(source);
  try {
    for (let i = 0; i < 80; i++) live.exec('BEGIN; INSERT INTO wallet_entries(amount_cents) VALUES(100); UPDATE wallet_accounts SET balance_cents=balance_cents+100; COMMIT;');
    assert.ok((await fs.stat(source + '-wal')).size > 0, 'fixture must have committed WAL data');
    const pending = createBundle({ database: source, media, output: path.join(root, 'bundle') });
    // A second connection writes a complete transaction while online backup runs.
    const writer = new DatabaseSync(source);
    writer.exec('BEGIN; INSERT INTO wallet_entries(amount_cents) VALUES(200); UPDATE wallet_accounts SET balance_cents=balance_cents+200; COMMIT;'); writer.close();
    const bundle = await pending;
    const snapshot = new DatabaseSync(path.join(bundle.directory, 'database.sqlite'), { readOnly: true });
    const balance = snapshot.prepare('SELECT balance_cents AS n FROM wallet_accounts').get().n;
    const total = snapshot.prepare('SELECT sum(amount_cents) AS n FROM wallet_entries').get().n;
    assert.equal(balance, total); assert.ok(balance >= 8000); snapshot.close();
    assert.equal(bundle.media.files.length, 1);
    assert.equal(await fs.readFile(path.join(bundle.directory, 'media/receipt.jpg'), 'utf8'), 'private-test-fixture');
    await assert.rejects(restoreBundle({ bundle: bundle.directory, database: path.join(root, 'refused.sqlite') }), /停止API/);
    const target = path.join(root, 'restored', 'sam.sqlite');
    const restored = await restoreBundle({ bundle: bundle.directory, database: target, offlineConfirmed: true });
    assert.equal(restored.mediaFiles, 1); assert.equal(restored.sessionsInvalidated,1); assert.equal(restored.tables.sessions,0);
    const current = new DatabaseSync(target); current.exec("INSERT INTO entities VALUES('order','new','{}')"); current.close();
    const second = await restoreBundle({ bundle: bundle.directory, database: target, offlineConfirmed: true, safetyOutput: path.join(root, 'before-restore') });
    assert.ok(second.previousDatabase); assert.ok(second.previousMedia);
    const preserved = await verifyBundle(second.safetyBackup);
    assert.equal(preserved.database.tables.entities, 2);
    const checked = new DatabaseSync(target, { readOnly: true }); assert.equal(checked.prepare('SELECT count(*) AS n FROM entities').get().n, 1); checked.close();
    // A corrupt media bundle is rejected before any destination replacement.
    await fs.writeFile(path.join(bundle.directory, 'media/receipt.jpg'), 'tampered');
    await assert.rejects(restoreBundle({ bundle: bundle.directory, database: target, offlineConfirmed: true, safetyOutput: path.join(root, 'should-not-exist') }), /媒体校验失败/);
    assert.equal(await fs.access(path.join(root, 'should-not-exist')).then(() => true, () => false), false);
  } finally { live.close(); }
});
