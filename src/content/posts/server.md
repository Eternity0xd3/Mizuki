---
title: node后端项目部署
published: 2026-10-18
description: "把自己的node后端项目部署到云服务器上"
image: ""
tags: ["web", "server"]
category: "教程"
draft: false
lang: ""
---

最近，我用Node写了一个网易云音乐 API (详情见：https://www.eternity0.xyz/posts/reverse-cloudmusic/)，我迫切需要把他部署到一个24小时开着的服务器上供人（我）访问。

之前我使用过Render的免费托管，但冷启动会造成明显的访问等待，令人难受，所以我决定买一台自己的云服务器。

这也是我第一次完整体验 Linux 服务器的部署过程。

本文记录从 SSH 登录、Node.js 环境配置、项目部署，到使用 systemd 常驻运行、Caddy 反向代理和 HTTPS 配置的全过程，以及中间遇到的几个问题。

## 1. 选择服务器

我买了腾讯云VPS，33元/month，还算便宜。

| 项目     | 配置             |
| -------- | ---------------- |
| 地域     | 中国香港         |
| CPU      | 2 核             |
| 内存     | 2 GB             |
| 硬盘     | 40 GB SSD        |
| 操作系统 | Ubuntu 24.04 LTS |

选择香港地域主要是为了方便使用已有域名部署服务，不必处理中国大陆服务器的 ICP 备案问题。

## 2. 使用SSH登录远程服务器

在腾讯云购买的时候，可以选择SSH密钥登录，在创建SSH密钥的时候，会自动下载密钥文件`xxx.pem`

把他放在一个合适的位置，例如用户目录下的.shh目录里面`~/.ssh/xxx.pem`

随后需要记一下服务器的公网IP地址。

然后可以进行远程ssh链接

```bash
ssh -i "$HOME\.ssh\atlas.pem" ubuntu@<SERVER_IP>
```

引号里面是pem私钥的路径，右边是默认用户名，一般是linux版本（比如Ubuntu）或者root，@后面是你的服务器IP

第一次连接可能看到：

```
The authenticity of host '...' can't be established.

Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

这是 SSH 在确认远程服务器身份。输入Yes

![img](https://img.eternity0.xyz/blog/server/ssh-login.png)

## 3. 一些初始工作

基本上很多厂商会帮你进行一定初始化，不过仍然推荐手动进行一些初始配置

### 3.1 更新软件包

首次进入服务器后，先更新软件包索引：

```bash
sudo apt update
```

再升级已安装的软件：

```bash
sudo apt upgrade
```

这里的`apt`是 Ubuntu 的软件包管理工具。

`update` 负责更新软件包索引，`upgrade` 负责实际升级。

随后安装 `Git`、`curl`：

```
sudo apt install -y git curl ca-certificates
```

### 3.2 安装部署项目所需的软件

这一步因项目而异，就以我部署的Node项目为例

先安装`nvm`

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

安装完成后，重新加载终端配置：

```
source ~/.bashrc
```

再安装`Node`：

```
nvm install 24
nvm alias default 24
```

验证：

```
node -v
npm -v
```

## 4. 部署项目

### 4.1 clone仓库

我将服务器上的个人项目统一放在 `~/projects` 目录。

```bash
mkdir -p ~/projects
cd ~/projects
```

然后克隆项目：

```bash
git clone xxx
```

### 4.2 安装项目依赖

根据你开发的项目选择的包管理器，比如`npm`，`pnpm`等，同步依赖包

当然，如果你的包管理器需要额外安装（比如`npm`），记得安装

### 4.3 配置环境变量

我的项目使用 `.env` 文件保存运行参数。

在**项目根目录**执行：

```bash
nano .env
```

例如：

```dotenv
PORT=3000
```

这里使用了 `nano`，它是 Linux 终端中一个简单的文本编辑器，类似于 Windows 的记事本，只不过没有图形界面。执行 `nano .env` 后，就会进入编辑界面，可以直接使用键盘输入或修改文本。

nano 的常用快捷键包括：

| 快捷键     | 功能                  |
| ---------- | --------------------- |
| `Ctrl + O` | 保存文件（Write Out） |
| `Enter`    | 确认保存的文件名      |
| `Ctrl + X` | 退出编辑器            |
| `Ctrl + W` | 搜索文本              |
| `Ctrl + K` | 剪切当前行            |
| `Ctrl + U` | 粘贴剪切的内容        |

例如，编辑完 `.env` 后，依次按下 `Ctrl + O`、`Enter`、`Ctrl + X`，就可以保存并退出。与 Vim 等编辑器不同，nano 不需要切换输入模式，上手比较容易。

## 5. 保持服务长期运行

使用` systemd`，可以让程序在退出 SSH 后继续运行，并在服务器重启后自动启动

`systemd`是 Linux 的系统和服务管理器，能够管理后台进程的启动、停止、重启与日志。

### 5.1 创建 service 文件

编辑service文件，xxx是你的服务的名字，取一个恰当的名字

```bash
sudo nano /etc/systemd/system/xxx.service
```

内容如下（模板）：

```ini
[Unit]
Description=xxx
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/projects/xxx
ExecStart=/home/ubuntu/.nvm/versions/node/v24.22.0/bin/node --env-file=.env ./src/server.js

Restart=on-failure
RestartSec=5

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

几个关键配置：

**WorkingDirectory**: 指定程序启动时的工作目录。这样 `.env` 和 `./src/server.js` 等相对路径才能被正确解析。（你需要修改，找到你的项目的根目录）

**ExecStart**: 指定实际执行的命令，就是开始运行服务的命令（你必须进行修改，来适配你的项目）。

我直接使用Node.js 的绝对路径，而不是 `pnpm start`，避免 systemd 因为环境变量或 PATH 不同而找不到 pnpm。

> 如果你也想用绝对路径，输入which node查看路径

**Restart=on-failure**: 当程序异常退出时，systemd 会尝试重启它。

**WantedBy=multi-user.target**: 用于将服务配置为在系统进入常规多用户运行状态时启动。

### 5.2 启动服务

保存配置后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudmusic-api
```

`daemon-reload` 让 systemd 重新加载服务定义。

`enable --now` 则同时完成两件事：启用开机自启，并立即启动服务。

正常情况下，通过：

```bash
systemctl status cloudmusic-api
```

应该看到：

```text
Active: active (running)
```

如果显示inactive，有以下内容值得排查：

1. 端口占用（ `EADDRINUSE` 错误）

   输入`sudo ss -ltnp | grep ':3000'`查看是否已经有端口占用3000端口（其他端口修改即可），若不是空白，就说明端口占用。比如返回

   ```text
   LISTEN ... *:3000 ... pid=48655
   ```

   那么就删除这个进程

   ```bash
   kill 48655
   ```

   重新启动服务：

   ```bash
   sudo systemctl restart cloudmusic-api
   ```

   这通常是因为之前调试的时候占用了端口而没有结束监听。

2. 命令错误

   检查自己写入**ExecStart**的指令，能否正常运行

   **检查完毕后别忘了释放这个端口！！！**

## 6. 使用 Caddy 配置 HTTPS

接下来，我希望通过自己的域名访问 API，而不是直接使用服务器 IP 和 3000 端口。

如果想让用户通过 `https://music.example.com` 访问 API，就需要解决两个问题：

1. **域名与端口**：用户访问 HTTPS 网站时，默认连接的是 443 端口，而不是 Express 使用的 3000 端口。
2. **HTTPS 加密**：Express 当前只处理 HTTP 请求，并没有配置 TLS 证书和 HTTPS 握手。

当然，也可以让 Node.js 自己提供 HTTPS 服务，但这意味着需要自行管理证书、续期等工作。对于我的项目而言，更合适的方案是使用**反向代理（Reverse Proxy）**。

> 注：如果你在参考以下内容部署服务，记得把xxx.example.com换成自己的域名

### 6.1 理论解释

> 这部分大多数是AI生成的

#### 6.1.1 反向代理

先来看一个普通的 HTTP 请求：

```text
浏览器 ───── HTTP 请求 ─────▶ Express :3000
```

这里浏览器直接与 Express 通信。

而引入反向代理后，请求路径就变成了：

```text
浏览器
   │
   │ HTTPS :443
   ▼
 Caddy
   │
   │ HTTP :3000
   ▼
 Express
```

浏览器并不知道真正处理业务逻辑的是 Express。它只需要连接 Caddy，由 Caddy 将请求转发给后面的 Node.js 服务，再将响应返回给浏览器。

这种架构叫作**反向代理**：代理服务器位于服务端一侧，代表后端服务器接收客户端请求。

与之相对，正向代理通常位于客户端一侧，代表客户端向其他服务器发起请求。

反向代理有几个明显的好处：

- **统一入口**：外部用户只需要访问标准的 80、443 端口，而不必知道内部服务的实际端口。
- **HTTPS 终止**：TLS 加密连接由代理服务器处理，后端程序仍然使用普通 HTTP。
- **隔离后端**：Express 可以只监听 `127.0.0.1:3000`，不必直接暴露在公网。
- **多服务部署**：未来可以通过不同域名，将请求转发给同一台服务器上的不同项目。

例如，以后我还可以这样配置：

```text
music.example.com  ──▶ Express :3000
image.example.com  ──▶ Worker/API :3001
blog.example.com   ──▶ Web App :3002
```

只需要让 Caddy 根据请求的域名，选择对应的后端服务即可。

#### 6.1.2 HTTPS在哪里发生？

浏览器发送的 HTTP 请求内容在网络传输前会经过 TLS 加密。Caddy 完成 TLS 握手并解密请求后，再将其转发给 Express。

这个过程称为 **TLS Termination（TLS 终止）**。

需要注意，TLS 加密只覆盖浏览器到 Caddy 这一段连接。Caddy 到 Express 的通信没有再次加密。

不过，这两个程序运行在同一台服务器上，并通过 `127.0.0.1` 通信，因此通常没有必要再为它们之间配置 HTTPS。如果后端位于另一台服务器上，则应重新考虑内部链路的加密。

#### 6.1.3 为什么用Caddy？

常见的 Web 服务器和反向代理软件包括 Nginx、Apache 和 Caddy。

我选择了 Caddy，主要因为它的配置简单，而且支持自动 HTTPS。

使用 HTTPS 时，服务器需要提供 TLS 证书，用于证明服务器对域名的控制权，并帮助客户端建立加密连接。

传统的手动配置流程通常涉及证书申请、证书路径配置、HTTP 到 HTTPS 的跳转，以及证书过期前的续期。

而 Caddy 可以通过 ACME 协议，与 Let's Encrypt 等证书颁发机构交互，自动完成域名验证、证书申请和续期。

对于个人项目，我只需要配置域名和后端地址，就可以将证书管理交给 Caddy。

### 6.2 配置 Cloudflare DNS

在 Cloudflare 中添加 A 记录：

| 配置     | 内容                      |
| -------- | ------------------------- |
| 类型     | A                         |
| 名称     | music                     |
| 内容     | 输入服务器的公网 IPv4地址 |
| 代理状态 | DNS only                  |
| TTL      | Auto                      |

这里选择 DNS only，是为了让域名直接解析到我的服务器，先排除额外代理层的影响。

### 6.3 安装 Caddy

安装 Caddy：

```bash
sudo apt update
sudo apt install -y caddy
```

### 6.4 配置反向代理

Caddy 的主要配置文件位于：

```text
/etc/caddy/Caddyfile
```

通过 nano 编辑：

```bash
sudo nano /etc/caddy/Caddyfile
```

我只需要写入：

```caddyfile
music.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

这份配置虽然只有三行，但已经描述了一个完整的 HTTPS 反向代理。

第一行：

```caddyfile
music.example.com {
```

定义了一个站点。Caddy 会根据客户端请求中的域名，将请求交给对应的站点配置处理。

同时，因为这里指定的是正常的域名，Caddy 默认会尝试为它启用自动 HTTPS。

第二行：

```caddyfile
reverse_proxy 127.0.0.1:3000
```

`reverse_proxy` 是 Caddy 的反向代理指令，后面的 `127.0.0.1:3000` 是后端服务地址。

其中：

- `127.0.0.1` 是本机回环地址，表示当前服务器自身。
- `3000` 是 Express 正在监听的端口。
- Caddy 收到请求后，会通过 HTTP 将请求转发给该地址，并将后端响应返回给客户端。

这里还有一个容易忽略的细节：Caddy 默认会保留请求的路径及查询参数。

例如浏览器访问：

```text
https://music.example.com/api/playlist/detail?id=123
```

Caddy 会将请求转发为：

```text
http://127.0.0.1:3000/api/playlist/detail?id=123
```

因此，我不需要额外编写路径转换规则，也不需要修改 Express 原有的路由结构。

### 6.5 验证并加载配置

修改 Caddyfile 后，先格式化并验证：

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
```

`fmt` 用于格式化配置文件，`validate` 用于检查配置是否有效。

随后重新加载 Caddy：

```bash
sudo systemctl reload caddy
```

这里使用的是 `reload`，而不是 `restart`。

`reload` 会让 Caddy 加载新的配置，通常不需要停止正在运行的服务；而 `restart` 则会重启整个进程。

最后查看日志：

```bash
sudo journalctl -u caddy -n 50 --no-pager
```

如果域名 DNS 解析正确，且服务器的 80、443 端口可以从公网访问，Caddy 就可以尝试完成 ACME 域名验证并申请证书。

## 7. 开放服务器端口

不是所有服务器运营商都会要求这一步，不过我仍建议你在无法访问的时候检查这一步

服务器可能默认配置防火墙，你需要手动开放固定的端口

![img](https://img.eternity0.xyz/blog/server/firewall.png)

开放443，来让别的IP可以访问你的HTTPS端口

## 8. 总结

没什么总结的，整个过程在ChatGPT的指导下，只花了3小时不到（算上写blog）

AI也许真的在改变我们的学习，至少没有那么高的门槛

对于现在而言，如果你敢于梦想，你就有可能将它实现
