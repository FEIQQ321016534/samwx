# 单实例验收部署与运维

本目录是当前 **SQLite + 本地私有媒体** 实现的单实例验收模板。当前未接入 PostgreSQL、COS、真实微信登录或微信支付；没有自动在公网部署任何服务，也不构成高可用方案。请先在独立验收环境完成操作、备份、恢复和账号测试。

已确认的业务规模是每天100笔以内。正式上线目标建议采用：单台2核4GB应用主机、同地域私网云PostgreSQL、私有COS凭证存储；本阶段不增加Redis和多应用实例。该配置是起步规划，尚无云端压力测试或承载保证。当前应用的SQLite与文件存储仍需做真实适配、迁移和验收后才能切换到上述目标，不能只替换连接字符串。上线总条件见根目录的发布检查说明。

## 目录与边界

- `api.Dockerfile`：Node24、生产依赖、非root账号、数据库和媒体持久卷。
- `admin.Dockerfile`：管理台编译后由非root Nginx静态服务；管理API使用同源`/api`。
- `compose.yaml`：API与静态管理台只在私网暴露，Caddy统一入口；默认仅绑定本机127.0.0.1的8080/8443。
- `Caddyfile`：HTTPS入口与`/api/*`反代，私有图片仍通过Bearer API访问，不将媒体目录作为公开静态目录。
- `backup.sh` / `restore.sh` / `check.sh`：容器环境备份、停机恢复和健康检查。

API只信任固定Caddy地址`172.30.20.2/32`传入的代理信息。Caddy覆盖`X-Forwarded-For`为实际对端，不沿用外部来客自行提交的链。如果此网段与VPC或本机网络冲突，应同时调整Compose网段、Caddy固定IP和`TRUST_PROXY_CIDRS`，不能只改其中一项。

## 验收环境准备

在项目根目录操作：

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml build api admin
```

`APP_DOMAIN`填实际域名时，另行安排域名解析、服务器网络入口和证书。默认本机地址使用Caddy本地证书，不应通过关闭浏览器证书校验来验收。真实公网启用需要明确把`BIND_ADDRESS`改为合适的监听地址及设置80/443端口；本次没有执行该步骤。

小程序尚未注册时，`WECHAT_APP_ID`和`WECHAT_APP_SECRET`保持为空。服务器凭据只放服务端环境，不能进入管理台或小程序构建。模板生产环境明确关闭`DEV_AUTH_ENABLED`和`DEV_PAYMENTS_ENABLED`；应使用全新的生产数据库，已有演示记录的开发数据库会被拒绝启动。

准备完成后，验收环境可由操作者手动启动：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d
```

数据库卷为`app-data`，路径`/data/sam.sqlite`；私有图片为`/data/media`，环境变量是`MEDIA_DIRECTORY`。备份卷为`backups`。命名卷初始化由镜像设置应用账号权限；如果改用宿主机绑定目录，需要由运维明确配置UID/GID1000、数据目录0700、数据库及图片0600，不使用777。

## 正式管理账号

系统无默认账号、无默认密码、无公开角色注册接口。由有服务器操作权限的运营人员在受控终端创建账号：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -it api npm run manage-account -- create --database /data/sam.sqlite
```

CLI交互选择账号、平台或商户角色、商户ID，并隐藏输入密码。密码至少15个字符，不写在命令参数、日志或前端配置中。商户账号应绑定已存在的商户。重置、停用、解锁等命令见CLI `--help`；重置或停用会撤销已有会话。

登录界面默认正式账号密码登录。开发入口仅在服务端明确允许时出现，生产Compose不开放该入口。AppID缺失不妨碍管理账号维护目录和运营资料，但顾客正式微信身份和真实收款仍待接入。

## 一致备份

不要直接复制运行中的`.sqlite`文件。应用使用WAL，活跃事务可能尚未合并到主文件。

```sh
# 业务可保持运行：SQLite backup API先形成一致快照，再复制媒体。
deploy/backup.sh
# 或指定新的备份目录名
deploy/backup.sh sam-before-release
```

同一份备份包含：

- `database.sqlite`：Node `node:sqlite.backup`在线一致快照，执行SQLite完整性检查。
- `media/`：快照之后复制只追加的私有凭证，文件0600。备份会检查数据库每条media记录对应的JPEG都存在。
- `manifest.json`：时间、工具、表计数、文件大小和SHA-256。校验通过后才将临时目录原子改名为最终备份目录。

媒体上传先完成文件写入并flush再提交数据库。当前无已提交媒体删除接口，因而DB快照后复制媒体可以覆盖快照引用的全部文件。将来若新增媒体删除、覆盖、COS或异步上传，必须重新设计这一致性方案。SHA-256用于检查内容完整，不代替备份来源的可信验证或签名。

备份包含收货资料、账号Hash与登录会话，应受控保存，并定期将完整备份包加密保留到独立故障域。本模板没有自动向云端传输任何数据，没有自动删除旧备份。仅把备份放在同一主机磁盘上无法应对整机丢失。

本机或其他Node24环境也可以直接运行：

```sh
node tools/backup-db.mjs --database /absolute/data/sam.sqlite --media /absolute/data/media --output /absolute/backups/sam-20261103
```

目标必须是新目录，且不能位于媒体目录中。备份失败只移除本次临时目录，原库和既有备份保持可用。

## 停机恢复与回滚

恢复不能在线进行。Compose包装脚本会先停止真实API容器，再在单独容器内恢复；恢复失败或成功后都不自动启动API，给操作者保留核对窗口。

```sh
deploy/restore.sh sam-before-release
```

脚本先校验数据库、所有媒体与引用关系，再为当前数据创建`before-restore-时间`完整安全备份。替换时旧数据库（含WAL/SHM）和旧媒体也保留在相邻`before-restore`路径。恢复后的所有登录会话会清空，避免恢复旧令牌；账号密码Hash随备份恢复，运营应按恢复时间点核对账号状态并重新登录。

确认输出后手动启动并检查：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d api
deploy/check.sh
```

随后使用正式账号核对：订单金额与状态、顾客余额、退款/支付流水、库存、私有小票访问及对账差异。需要回滚时，以自动创建的安全备份再执行相同恢复流程。不要删除旧文件后才开始恢复。

非Docker环境应先停止所有API及定时任务，再以应用文件所属账号运行：

```sh
node tools/restore-db.mjs --backup /absolute/backups/sam-before-release --database /absolute/data/sam.sqlite --media /absolute/data/media --offline-confirm --safety-output /absolute/backups/before-restore-new-name
```

已有数据库必须指定新的`safety-output`。宿主机如有`lsof`，脚本会额外拒绝仍有进程打开的目标库；容器PID命名空间不能替代停服务检查，所以生产恢复应使用Compose包装脚本。

## 演练与健康检查

```sh
node --test tools/backup-restore.test.mjs
node tools/healthcheck.mjs --url http://127.0.0.1:8787/api
node tools/healthcheck.mjs --url https://your-domain.example/api --production
```

演练使用临时数据库，不操作真实数据：保持原库WAL有已提交记录，在另一个连接写事务期间创建快照；验证钱包余额等于流水合计、媒体内容完整；恢复到新库及已有库；确认旧库安全备份保留、登录会话清空；损坏媒体备份时在替换前拒绝。

健康检查核对`/health`和`/config`，生产模式要求开发登录和开发付款均关闭。健康接口成功只表示进程及基本配置可用，不能代替真实登录、下单、支付回调、退款回调和恢复演练。

## 本次验证记录

2026-11-03：Compose配置解析、三个Shell脚本语法、Node24在线备份/恢复演练通过；API与管理台镜像已在本机构建；API以无网络、无对外端口的临时容器启动后，生产健康检查通过，开发身份与开发付款均为false，正式管理认证为true；Nginx和Caddy配置检查通过。另外对运行中的8791隔离服务及1张私有图片实际备份并恢复到新目录，恢复清除了1个登录会话。临时容器已清理。没有在云服务器部署，没有执行公网监听，没有做云端压测，没有接入PostgreSQL/COS或真实微信支付。
