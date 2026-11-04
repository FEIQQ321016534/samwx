import { createApp } from './app.ts';
const {app} = await createApp({logger:true});
const port=Number(process.env.PORT??8787);
const host=process.env.HOST??'127.0.0.1';
await app.listen({port,host});
for(const signal of ['SIGINT','SIGTERM']as const)process.on(signal,()=>{app.close().then(()=>process.exit(0));});
