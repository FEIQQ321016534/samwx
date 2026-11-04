# 正式管理账号

管理台使用独立账号密码，不依赖微信 AppID。微信登录只创建顾客身份，不能在登录请求中指定管理员或商户权限。系统不附带默认账号或密码。

在服务器项目目录中，先确认 `--database` 指向 API 正在使用的同一 `DATABASE_PATH`。创建平台管理员：

```sh
npm --prefix apps/api run manage-account -- create --database /绝对路径/sam-production.sqlite --username platform.admin --role admin
```

命令从本地 TTY 隐藏读取密码并二次确认。密码为 15 至 256 个字符，可以使用空格和中文；不接收密码参数或密码环境变量。自动化配置可由秘密管理工具提供一个当前进程用户所有、权限 `0600` 的普通文件，再指定 `--password-file /绝对路径/secret-file`；命令拒绝符号链接并且不输出密码。密码使用随机盐和 scrypt `N=131072,r=8,p=1` 存储。[Node.js crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)、[OWASP 密码存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

管理员创建并审核商户后，为商户建立账号：

```sh
npm --prefix apps/api run manage-account -- create --database /绝对路径/sam-production.sqlite --username merchant.chen --role merchant --merchant-id 已有商户ID
```

商户未审核或暂停时无法使用管理权限。恢复审核后需要重新登录，原令牌不会恢复有效。账号角色和商户绑定不能通过密码重置或登录请求修改。旧的 `grant-role` 方式不能建立正式管理登录。

账号操作：

```sh
npm --prefix apps/api run manage-account -- list --database /绝对路径/sam-production.sqlite
npm --prefix apps/api run manage-account -- reset --database /绝对路径/sam-production.sqlite --username platform.admin
npm --prefix apps/api run manage-account -- disable --database /绝对路径/sam-production.sqlite --username merchant.chen
npm --prefix apps/api run manage-account -- enable --database /绝对路径/sam-production.sqlite --username merchant.chen
npm --prefix apps/api run manage-account -- unlock --database /绝对路径/sam-production.sqlite --username platform.admin
```

重置、禁用、启用、解锁均撤销该账号所有已有会话。连续五次登录失败会锁定十五分钟并撤销旧会话；错误信息不区分不存在、停用或密码错误。正式管理会话有效八小时，数据库只存令牌 SHA-256 摘要。退出会删除当前会话。

## 部署设置

- `NODE_ENV` 默认按 `production` 处理；仅支持 `development`、`test`、`staging`、`production`，拼写错误会拒绝启动。
- `production` 与 `staging` 强制关闭开发身份和模拟资金，并拒绝演示数据库。开发身份或模拟资金启用时只允许绑定回环地址。
- 正式管理登录应通过 HTTPS。API 只向受控反代开放，不直接向公网发布内部端口。
- 反代后的客户端 IP 只接受显式 `TRUST_PROXY_CIDRS`。例如受控 Caddy 地址为 `172.30.20.2` 时设置 `TRUST_PROXY_CIDRS=172.30.20.2/32`，默认不信任 `X-Forwarded-For`。不接受 `true`、`*` 或任意来源 `/0`。反代必须正确覆盖或追加来源链，避免所有用户共享同一登录限速桶。
- 登录路径按客户端 IP 限制每十五分钟三十次；所有请求按 IP 限制每分钟六百次。账号锁定和限速保存在 SQLite，服务重启不会清空。
- 日志不包含请求体、授权头、查询参数或原始异常消息。安全事件保存在 `security_audit`，管理操作的财务审计仍由业务模块记录。[Fastify 日志配置](https://fastify.dev/docs/latest/Reference/Logging/)

顾客端真实微信登录后续需要 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`，或使用权限 `0600` 的 `WECHAT_APP_SECRET_FILE`。服务端不会向客户端返回或存储微信 `session_key`。未配置这些参数时，正式管理台仍可使用本地创建的管理账号。

旧数据库自动补充安全表和字段，将既有令牌列转换为摘要并保留身份来源，不删除用户、订单或资金流水。旧开发身份不会进入生产。升级前应保留原数据库备份，并确保备份仅由运营者访问。
