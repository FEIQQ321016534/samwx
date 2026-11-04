import type { FastifyInstance, FastifyRequest } from 'fastify';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import type { User, Order } from '../../../packages/domain/src/index.ts';
import { Store, fail, uid, now } from './db.ts';

interface Media { id: string; orderId: string; merchantId: string; kind: 'receipt'|'photo'; filename: string; size: number; createdAt: string; createdBy: string }
export function registerMediaRoutes(app: FastifyInstance, store: Store, options: { authenticate: (request: FastifyRequest, roles?: User['role'][]) => User; directory?: string }) {
  const directory = resolve(options.directory || process.env.MEDIA_DIRECTORY || './data/media');
  const pendingUploads = new Set<FastifyRequest>();
  const releaseUpload = (request: FastifyRequest) => { pendingUploads.delete(request); };
  app.addHook('onRequestAbort',async request=>releaseUpload(request));
  const orderFor = (user: User, id: string) => {
    const order = store.require<Order>('order', id);
    if (user.role === 'customer' && order.customerId !== user.id || user.role === 'merchant' && order.merchantId !== user.merchantId) fail(403,'FORBIDDEN','无权访问此订单的凭证');
    return order;
  };
  app.post('/api/admin/orders/:id/media', { bodyLimit: 7 * 1024 * 1024,
    onRequest: async request => {
      const user=options.authenticate(request,['admin','merchant']);
      orderFor(user,(request.params as {id:string}).id);
      if(!store.consumeRateLimit(`media:${user.id}`,20,60_000).allowed)fail(429,'MEDIA_RATE_LIMIT','图片上传过于频繁，请稍后重试');
      if(pendingUploads.size>=2)fail(503,'MEDIA_BUSY','图片处理繁忙，请稍后重试');
      pendingUploads.add(request);
    },
    onResponse: async request=>releaseUpload(request),
    onError: async request=>releaseUpload(request),
    onTimeout: async request=>releaseUpload(request),
  }, async request => {
    const user = options.authenticate(request,['admin','merchant']);
    const order = orderFor(user,(request.params as {id:string}).id);
    const body = request.body as Record<string,unknown>;
    if (!body || !['photo','receipt'].includes(String(body.kind)) || typeof body.contentBase64 !== 'string') fail(400,'INVALID_MEDIA','请选择采购照片或小票图片');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.contentBase64) || body.contentBase64.length % 4) fail(400,'INVALID_MEDIA','图片编码无效');
    const input = Buffer.from(body.contentBase64,'base64');
    if (!input.length || input.length > 5 * 1024 * 1024) fail(413,'MEDIA_TOO_LARGE','单张图片不得超过5MB');
    let output: Buffer;
    try {
      const decoder = sharp(input,{limitInputPixels:24_000_000,animated:false});
      const metadata = await decoder.metadata();
      if (!['jpeg','png','webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) fail(400,'INVALID_MEDIA','仅支持静态JPEG、PNG或WebP图片');
      output = await decoder.rotate().resize({width:2048,height:8192,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:90}).toBuffer();
    } catch { return fail(400,'INVALID_MEDIA','图片无法解析或尺寸过大'); }
    const record: Media = {id:uid('media'),orderId:order.id,merchantId:order.merchantId,kind:body.kind as Media['kind'],filename: typeof body.filename === 'string' ? body.filename.slice(0,120) : '采购凭证.jpg',size:output.length,createdAt:now(),createdBy:user.id};
    await mkdir(directory,{recursive:true,mode:0o700});
    const file = join(directory,`${record.id}.jpg`);
    await writeFile(file,output,{mode:0o600,flag:'wx',flush:true});
    try {
      store.transaction(()=>{
        if(store.all<Media>('media').filter(m=>m.orderId===order.id).length>=40)fail(409,'MEDIA_LIMIT','每张订单最多40张凭证');
        store.put('media',record);
        store.put('operation_audit',{id:uid('audit'),actorId:user.id,merchantId:order.merchantId,action:'media.upload',reason:'上传订单私有凭证',after:{mediaId:record.id,kind:record.kind,size:record.size},orderId:order.id,createdAt:now()});
      });
    } catch (error) { await unlink(file).catch(()=>{}); throw error; }
    return {data:record};
  });
  app.get('/api/orders/:id/media',async request=>{
    const order=orderFor(options.authenticate(request),(request.params as {id:string}).id);
    return {data:store.all<Media>('media').filter(m=>m.orderId===order.id).map(({createdBy,...m})=>m)};
  });
  app.get('/api/media/:id',async (request,reply)=>{
    const user=options.authenticate(request);
    const record=store.require<Media>('media',(request.params as {id:string}).id);
    orderFor(user,record.orderId);
    if(!/^media-[a-f0-9-]+$/.test(record.id))fail(400,'INVALID_MEDIA','凭证标识无效');
    let bytes: Buffer;
    try { bytes=await readFile(join(directory,`${record.id}.jpg`)); }
    catch { return fail(404,'MEDIA_NOT_FOUND','凭证文件暂不可用，请联系运营人员'); }
    return reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').type('image/jpeg').send(bytes);
  });
}
