#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { argumentsFor, createBundle, createSnapshot, copyMedia, verifyBundle, inspectDatabase } from './backup-common.mjs';

export async function restoreBundle({ bundle, database, media, offlineConfirmed, safetyOutput }) {
  if (!offlineConfirmed) throw new Error('恢复前必须停止API及定时任务，并显式传入 --offline-confirm。在线恢复不受支持。');
  const verified = await verifyBundle(bundle);
  const target = path.resolve(database), mediaTarget = path.resolve(media || path.join(path.dirname(target), 'media'));
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const lockPath = target + '.restore.lock';
  const lock = await fs.open(lockPath, 'wx', 0o600).catch(() => { throw new Error('已有恢复锁，请确认没有其他恢复任务；不要在不明原因时删除锁。'); });
  let stagingDb, stagingMedia;
  try {
    // This guard detects ordinary host processes. Docker operators must additionally
    // stop the API container (deploy/restore.sh enforces it across PID namespaces).
    const opened = spawnSync('lsof', ['-t', '--', target, target + '-wal', target + '-shm'], { encoding: 'utf8' });
    if (opened.status === 0 && opened.stdout.trim()) throw new Error('目标数据库仍有进程打开，请先停止业务服务。');
    const targetExists = await fs.lstat(target).then(stat => { if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('目标数据库必须为普通文件'); return true; }, error => { if (error.code === 'ENOENT') return false; throw error; });
    let safetyBackup;
    if (targetExists) {
      if (!safetyOutput) throw new Error('覆盖已有数据库必须指定 --safety-output，先保留当前数据库和媒体的完整快照。');
      safetyBackup = (await createBundle({ database: target, media: mediaTarget, output: safetyOutput })).directory;
    }
    stagingDb = `${target}.restore-${process.pid}.tmp`;
    await createSnapshot(path.join(verified.root, 'database.sqlite'), stagingDb);
    // Restoring old tokens must not resurrect a previously revoked login session.
    let sessionsInvalidated=0;
    const staged=new DatabaseSync(stagingDb);
    try {if(staged.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get()){sessionsInvalidated=staged.prepare('DELETE FROM sessions').run().changes;}} finally {staged.close();}
    await fs.mkdir(path.dirname(mediaTarget), { recursive: true, mode: 0o700 });
    stagingMedia = await fs.mkdtemp(path.join(path.dirname(mediaTarget), '.media-restore-'));
    await copyMedia(path.join(verified.root, 'media'), stagingMedia);
    const oldMedia = `${mediaTarget}.before-restore-${Date.now()}`;
    let movedOldMedia = false;
    try { await fs.rename(mediaTarget, oldMedia); movedOldMedia = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const archivedDatabase = targetExists ? `${target}.before-restore-${Date.now()}` : undefined;
    const movedFiles = [];
    try {
      if (archivedDatabase) {
        await fs.mkdir(archivedDatabase, { mode: 0o700 });
        for (const suffix of ['', '-wal', '-shm']) {
          try { await fs.rename(target + suffix, path.join(archivedDatabase, 'database.sqlite' + suffix)); movedFiles.push(suffix); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
      }
      await fs.rename(stagingMedia, mediaTarget); stagingMedia = undefined;
      await fs.rename(stagingDb, target); stagingDb = undefined;
    } catch (error) {
      for (const suffix of movedFiles.reverse()) await fs.rename(path.join(archivedDatabase, 'database.sqlite' + suffix), target + suffix);
      if (movedOldMedia) { await fs.rm(mediaTarget, { recursive: true, force: true }); await fs.rename(oldMedia, mediaTarget); }
      throw error;
    }
    // Keep previous media until the operator has run health checks. A safety bundle
    // also contains it, but retaining it makes local rollback straightforward.
    return { ok: true, database: target, media: mediaTarget, tables: inspectDatabase(target).tables, sourceTables: verified.database.tables, mediaFiles: verified.manifest.media.files.length, sessionsInvalidated, safetyBackup, previousDatabase: archivedDatabase, previousMedia: movedOldMedia ? oldMedia : undefined };
  } finally {
    await lock.close(); await fs.rm(lockPath, { force: true });
    if (stagingDb) await fs.rm(stagingDb, { force: true });
    if (stagingMedia) await fs.rm(stagingMedia, { recursive: true, force: true });
  }
}
export async function main(argv = process.argv.slice(2)) {
  const args = argumentsFor(argv);
  if (args.help || !args.backup || !args.database) { console.log('用法：停止API后 node tools/restore-db.mjs --backup /backups/sam-... --database /data/sam.sqlite --media /data/media --offline-confirm [--safety-output /backups/before-restore-...]\n已有数据库必须提供新的 safety-output 目录。先校验备份及所有媒体，不通过不会替换目标。'); if (!args.help) process.exitCode = 2; return; }
  console.log(JSON.stringify(await restoreBundle({ bundle: args.backup, database: args.database, media: args.media, offlineConfirmed: args['offline-confirm'] === true, safetyOutput: args['safety-output'] })));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(`恢复失败：${error.message}`); process.exitCode = 1; });
