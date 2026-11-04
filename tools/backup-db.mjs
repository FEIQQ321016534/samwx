#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { argumentsFor, createBundle } from './backup-common.mjs';
export async function main(argv = process.argv.slice(2)) {
  const args = argumentsFor(argv);
  if (args.help || !args.database || !args.output) {
    console.log('用法：node tools/backup-db.mjs --database /data/sam.sqlite --media /data/media --output /backups/sam-YYYYMMDD-HHMMSS\n通过SQLite在线backup API创建一致快照，随后复制只追加的媒体并写入SHA-256清单。目标必须是新目录。');
    if (!args.help) process.exitCode = 2;
    return;
  }
  const result = await createBundle({ database: args.database, media: args.media || path.join(path.dirname(args.database), 'media'), output: args.output });
  console.log(JSON.stringify({ ok: true, directory: result.directory, tables: result.database.tables, mediaFiles: result.media.files.length, createdAt: result.createdAt }));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(`备份失败：${error.message}`); process.exitCode = 1; });
