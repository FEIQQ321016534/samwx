import { constants, closeSync, fstatSync, openSync, readFileSync } from 'node:fs';

/** Open the checked descriptor itself, preventing a symlink swap between checks. */
export function readPrivateSecretFile(filename:string,maxBytes:number):string {
  let descriptor:number|undefined;
  try{
    descriptor=openSync(filename,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(descriptor);
    if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>maxBytes||(process.getuid&&stat.uid!==process.getuid()))throw new Error('insecure file');
    return readFileSync(descriptor,'utf8');
  }catch{
    throw new Error('PRIVATE_SECRET_FILE_INSECURE: 秘密文件须由当前进程用户所有、权限0600、为非符号链接的普通文件且不超过大小限制');
  }finally{if(descriptor!==undefined)closeSync(descriptor);}
}
