import { DatabaseSync, backup } from 'node:sqlite';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function argumentsFor(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`无法识别参数：${argv[i]}`);
    const name = argv[i].slice(2);
    values[name] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return values;
}
export async function sha256(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
export async function regularFiles(directory, prefix = '') {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT' && !prefix) return []; throw error; }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`拒绝备份或恢复符号链接：${relative}`);
    if (entry.isDirectory()) files.push(...await regularFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`不支持的文件类型：${relative}`);
  }
  return files;
}
export function inspectDatabase(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const results = db.prepare('PRAGMA integrity_check').all();
    if (results.length !== 1 || Object.values(results[0])[0] !== 'ok') throw new Error('数据库完整性检查失败');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    if (!tables.some(t => t.name === 'entities') || !tables.some(t => t.name === 'wallet_entries')) throw new Error('不是本项目的业务数据库（缺少基础表）');
    const counts = Object.fromEntries(tables.map(({ name }) => [name, db.prepare(`SELECT count(*) AS count FROM "${name.replaceAll('"', '""')}"`).get().count]));
    return { integrity: 'ok', tables: counts, userVersion: db.prepare('PRAGMA user_version').get().user_version };
  } finally { db.close(); }
}
export async function createSnapshot(source, destination) {
  await fs.access(source);
  const db = new DatabaseSync(source, { readOnly: true });
  try { db.exec('PRAGMA busy_timeout=10000'); await backup(db, destination, { rate: 128 }); }
  finally { db.close(); }
  await fs.chmod(destination, 0o600);
  return inspectDatabase(destination);
}
export async function copyMedia(source, destination) {
  const entries = [];
  await fs.mkdir(destination, { recursive: true, mode: 0o700 });
  for (const relative of await regularFiles(source)) {
    const from = path.join(source, relative), to = path.join(destination, relative);
    await fs.mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
    await fs.copyFile(from, to);
    await fs.chmod(to, 0o600);
    entries.push({ path: relative, bytes: (await fs.stat(to)).size, sha256: await sha256(to) });
  }
  return entries;
}
export async function verifyMediaReferences(database, mediaRoot) {
  const db=new DatabaseSync(database,{readOnly:true});
  try {
    const media=db.prepare("SELECT payload FROM entities WHERE kind='media'").all();
    for(const row of media){const item=JSON.parse(row.payload);if(typeof item.id!=='string'||!/^media-[a-f0-9-]+$/.test(item.id))throw new Error('数据库中有无效媒体标识');const file=path.join(mediaRoot,`${item.id}.jpg`);const stat=await fs.lstat(file).catch(()=>{throw new Error(`缺少数据库引用的媒体文件：${item.id}`);});if(!stat.isFile()||stat.isSymbolicLink())throw new Error('媒体引用不是普通文件');}
    return media.length;
  } finally {db.close();}
}
export async function verifyBundle(directory) {
  const root = path.resolve(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.database?.file !== 'database.sqlite' || !Array.isArray(manifest.media?.files)) throw new Error('备份清单格式无效');
  const dbFile = path.join(root, 'database.sqlite');
  const dbStat = await fs.lstat(dbFile);
  if (!dbStat.isFile() || dbStat.isSymbolicLink()) throw new Error('备份数据库必须为普通文件');
  await regularFiles(path.join(root, 'media'));
  if ((await sha256(dbFile)) !== manifest.database.sha256) throw new Error('备份数据库校验值不匹配');
  const database = inspectDatabase(dbFile);
  for (const entry of manifest.media.files) {
    if (typeof entry.path !== 'string' || entry.path.includes('\\') || entry.path.startsWith('/') || entry.path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('媒体路径不安全');
    const file = path.join(root, 'media', entry.path);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.bytes || await sha256(file) !== entry.sha256) throw new Error(`媒体校验失败：${entry.path}`);
  }
  // Reject symlinks even in additional files, including malicious intermediate directories.
  await regularFiles(path.join(root, 'media'));
  await verifyMediaReferences(dbFile,path.join(root,"media"));
  return { root, manifest, database };
}
export async function createBundle({ database, media, output }) {
  const source = path.resolve(database), target = path.resolve(output), mediaRoot = path.resolve(media);
  if (target === mediaRoot || target.startsWith(mediaRoot + path.sep)) throw new Error('备份目录不能放在媒体目录中');
  try { await fs.access(target); throw new Error('目标备份目录已存在，请使用新目录。'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const staging = await fs.mkdtemp(path.join(path.dirname(target), '.backup-'));
  await fs.chmod(staging, 0o700);
  try {
    const snapshot = path.join(staging, 'database.sqlite');
    const inspection = await createSnapshot(source, snapshot);
    const mediaFiles = await copyMedia(path.resolve(media), path.join(staging, 'media'));
    await verifyMediaReferences(snapshot,path.join(staging,"media"));
    const manifest = { version: 1, createdAt: new Date().toISOString(), tool: 'node:sqlite.backup', database: { file: 'database.sqlite', sha256: await sha256(snapshot), bytes: (await fs.stat(snapshot)).size, ...inspection }, media: { files: mediaFiles, appendOnlyRequired: true } };
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    await verifyBundle(staging);
    await fs.rename(staging, target);
    return { directory: target, ...manifest };
  } catch (error) { await fs.rm(staging, { recursive: true, force: true }); throw error; }
}
