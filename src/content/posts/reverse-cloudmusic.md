---
title: 你觉得你是逆向工程吗？我觉得我是！
published: 2026-10-18
description: "通过把网易云音乐超级拆解超级抓包，挖出其中的api，并持续探索网易云程序员的真相"
image: "https://img.eternity0.xyz/blog/reverse-cloudmusic/v6-response.png"
tags: ["web", "reverse engineering"]
category: "记录"
draft: false
lang: ""
---

事情的起因很简单：我想自己写一个网易云音乐 API。

需求其实不复杂：根据歌单 ID 获取歌曲列表，根据歌曲 ID 获取歌曲详情，再根据歌曲 ID 获取播放链接。

乍一看，这不就是向服务器发送几个 HTTP 请求，然后把 JSON 返回给调用者吗？

事实证明，当你觉得一个逆向项目应该很简单的时候，它往往已经准备好给你上一课了。

不过，这次探索比预想中有趣得多。我不仅找到了网易云客户端使用的接口，还逐步摸清了它的 EAPI 请求加密方式，并最终用 Node.js 实现了自己的 API 服务。

这篇文章记录整个过程：从最初的网页分析，到使用 mitmproxy 抓取客户端流量，再到还原 AES 加密流程，以及最后的接口封装。

说明：本文仅记录技术研究过程。所涉及的接口行为来自当时的实际测试，可能随客户端版本和服务端策略变化。部分内容依赖正常登录状态，不涉及绕过付费权限。

## 1. 网页端的探索

既然想实现 API，我最先想到的自然是浏览器开发者工具。

打开网易云音乐网页版，进入一个歌单页面。

我原本的计划是：

1. 打开 Network 面板。
2. 找到加载歌单时发送的请求。
3. 复制请求地址和参数。
4. 使用 Node.js 的 `fetch()` 复现。

非常朴素的计划。

然而，真正开始观察网页之后，我发现了一个有趣的现象。

### 1.1 一个歌单，为什么只给我六首歌？

最开始，我尝试在浏览器的无痕模式下访问歌单页面。

因为没有登录，我想看看网易云会向匿名访客公开哪些数据，结果发现，网页初始 HTML 中只包含前几首歌曲的信息。在当时的测试中，我只能直接获得前六首。但当我使用已登录的浏览器访问同一个页面时，HTML 中却能找到完整得多的歌单信息。

反复搜寻之中，发现歌单只会跟着HTML一起发回来，没有暴露单独的api接口。

**逆向分析里根本不是这样的！你应该先直接让我看api，让我在network里找到请求，然后我打XHR断点，在调用栈里面来回找，找到混淆的签名算法文件，最后构建环境本地发请求，然后你给我看特殊cg (response)。**

**你怎么直接把api都藏起来了，逆向分析根本不是这样的啊！**

## 2. 分析客户端请求

这一次，我决定从浏览器转向网易云音乐 Windows 客户端。

工具是 **mitmproxy**。

mitmproxy 是一个支持 HTTP/HTTPS 流量分析的代理工具，可以捕获请求与响应，并查看它们的 URL、请求头、请求体等信息。

我使用它的 Web 界面 mitmweb 观察流量。

```
mitmweb --mode local:cloudmusic.exe
```

我先尝试在未登录的状态下尝试访问歌单，抓到了可疑的api请求

![img](https://img.eternity0.xyz/blog/reverse-cloudmusic/raw-response.png)

随后尝试在登录的状态下抓，结果抓到了另一个api请求

![img](https://img.eternity0.xyz/blog/reverse-cloudmusic/v6-response.png)

![img](https://img.eternity0.xyz/blog/reverse-cloudmusic/v6-request.png)

反复测试后发现：访问自己的歌单时，调用v6，未登录或从访问其他人的歌单时，调用v4

（不过后来测试得知，实际上v6也可以用来访问其他人的歌单，什么石山代码）

不过，比起这个，更令人绝望的时这串乱七八糟的加密hex，无论是request params还是response都被加密了。除了逆向分析整个软件，实在想不到有什么方法能破解这串加密内容...

## 3. 初识 EAPI：请求参数是如何加密的？

### 3.0 站在巨人的肩膀上：参考开源项目

研究到这里，我意识到一件事：网易云音乐已经存在很多第三方 API 项目，显然，我不太可能是第一个对这些接口产生兴趣的人。

于是，我开始在 GitHub 上搜索相关项目，并找到了 [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 等开源实现。

既然已经有前人研究过这个协议，为什么不先看看他们是怎么做的呢？

### 3.1 第一步：序列化 JSON

首先，把业务参数转换为 JSON 字符串：

```javascript
const text = JSON.stringify(data);
```

### 3.2 第二步：计算 MD5

EAPI 会先构造一段字符串：

```javascript
const message = `nobody${path}use${text}md5forencrypt`;
```

其中 `path` 是接口路径，`text` 是刚才序列化的 JSON。

然后计算 MD5：

```javascript
const digest = md5(message);
```

MD5 最终得到一个 128 位摘要，通常表示为 32 个十六进制字符。

这里的 MD5 不是用来加密数据，而是生成摘要。

> Nobody use md5 for encrypt. 嘿，你真幽默！

### 3.3 第三步：拼接真正要加密的明文

随后，EAPI 将路径、JSON 和 MD5 摘要拼接起来：

```javascript
const plaintext =
    `${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
```

这写东西会一起送去加密，真是狠啊

### 3.4 第四步：AES-128-ECB 加密

接下来使用 AES-128-ECB 对上述明文进行加密。

密钥为：

```javascript
const key = Buffer.from("e82ckenh8dichen8");
```

16 字节密钥对应 AES-128。

Node.js 已经内置 `node:crypto` 模块，因此不需要另外安装加密库。

可以直接实现一个简单的辅助函数：

```javascript
import crypto from "node:crypto";

function encrypt128Ecb(data, key) {
    const cipher = crypto.createCipheriv(
        "aes-128-ecb",
        key,
        null
    );

    return Buffer.concat([
        cipher.update(data),
        cipher.final()
    ]);
}
```

### 3.5 第五步：编码并发送

加密后得到的是二进制数据。

EAPI 需要将其转换为大写十六进制字符串：

```javascript
const params = encrypted.toString("hex").toUpperCase();
```

最后以表单编码方式发送：

```text
Content-Type: application/x-www-form-urlencoded
```

请求体形如：

```text
params=...
```

至此，我们基本还原了 EAPI 的请求加密流程。

用一张流程图总结：

```text
业务参数对象
     │
     ▼
JSON.stringify()
     │
     ▼
拼接 nobody + path + use + JSON + md5forencrypt
     │
     ▼
MD5 摘要
     │
     ▼
拼接 path、JSON 和 MD5
     │
     ▼
AES-128-ECB + PKCS#7 Padding
     │
     ▼
大写 Hex 字符串
     │
     ▼
表单编码的 params
     │
     ▼
发送 EAPI 请求
```

### 3.6 以上的加密破解不是我干的！

感谢前人对网易云的超级解包，超级破译，让我能够复现所有加密过程

不要小看开源社区啊！！！

## 4. 尝试解密request params

如果协议还原正确，解密后应该能看到类似：

```text
/api/v6/playlist/detail-36cd479b6b5-{"id":"...","n":...}-36cd479b6b5-...
```

这一步非常关键。

它不仅可以验证加密算法，也可以帮助我们观察客户端实际发送了哪些参数。

```javascript
{
    id: "...",
    n: 300,
    s: 0,
    e_r: true
}
```

在分析最小化参数的时候，我注意到这个参数

```javascript
e_r: true
```

经过测试，我发现它与服务端响应加密行为有关。

在当时研究的部分 EAPI 接口中，带上 `e_r: true` 会得到加密响应；而移除这个字段后，服务器可以直接返回明文 JSON。

这就很有意思了。

原本还在琢磨怎么进一步处理加密响应，结果发现：只要不要求服务器加密，它就真的不加密了。

> 哦，选择了最有兼容性的方法吗。网易程序员，你们这些家伙

如果故意设置`e_r=false`，那么有效参数就只有一个`id`了

## 5. 分析返回数据

### 5.1 `/api/v6/playlist/detail`

我重点研究了：

```text
/api/v6/playlist/detail
```

这个接口可以返回歌单信息，包括：

- 歌单元数据
- `trackIds`
- 部分或完整的 `tracks`

这里需要区别两个字段：

`trackIds` 主要保存歌曲 ID 列表，而 `tracks` 保存歌曲的详细信息。

在我的测试中，未登录时，接口依然可能返回完整的 `trackIds`，但是 `tracks` 只有前面一部分。

而携带有效登录 Cookie 时，可以获得更加完整的歌曲详情数据。

换句话说：

**知道一个歌单有哪些歌曲，不等于已经拿到了每首歌曲的完整信息。**

那么未登录的时候，其他歌曲怎么获得详细信息？

这就引出了另一个接口。

### 5.2 `/api/v3/song/detail`

我在 Windows 客户端的请求中观察到，它有时并不会直接从歌单详情接口取得所有歌曲数据。

对于部分歌单，客户端会先请求：

```text
/api/playlist/v4/detail
```

拿到歌单及歌曲 ID 信息，再通过：

```text
/api/v3/song/detail
```

批量获取歌曲详情。

传入歌曲id，返回这些id的所有详细信息

> 看似功能划分分明，但是实际上有没有登录，得到的结果是一样的，评价为何意味

所以，获得所有歌单里的歌曲详情的接口逻辑应该是这样：

```
playlist/detail --> 获得所有歌曲id --> song/detail --> 所有歌曲详细信息
```

## 7. 歌曲播放链接

歌单详情解决后，我还需要获取歌曲的实际播放资源。

客户端使用的相关接口是：

```text
/api/song/enhance/player/url/v1
```

这个接口需要提交歌曲 ID，以及音质、编码格式等参数。

例如：

```javascript
{
    ids: JSON.stringify([123456]),
    level: "lossless",
    encodeType: "flac"
}
```

这里还有一个小坑：`ids` 并不是直接传入 JavaScript 数组，而是需要将数组序列化成 JSON 字符串。

### 8.1 encodeType 并不完全决定返回的格式

我测试了不同的 `level` 和 `encodeType` 组合。

结果发现，真正返回的文件格式并不是单纯由 `encodeType` 决定。

当时的观察大致如下：

| level      | 实际观察到的格式           |
| ---------- | -------------------------- |
| `hires`    | FLAC                       |
| `lossless` | FLAC                       |
| `exhigh`   | MP3                        |
| `standard` | MP3 或 M4A，取决于参数组合 |

例如，某些请求即使指定 `encodeType: "flac"`，在 `exhigh` 音质下仍然返回 MP3 资源。

而 `standard` 音质配合不同的 `encodeType`，则可能返回不同的资源文件。

因此，不能仅根据请求参数推断最终的音频编码格式，而应该根据接口响应中的实际信息进行判断。

### 8.2 登录状态与资源权限

我还发现，登录 Cookie 会影响部分歌曲资源的可用性。

例如，某些需要会员权限的歌曲，在未登录或没有相应权限时，并不能得到可用的播放链接。

而且，播放链接是有时效性的，过一段时间，得到的url会失效，似乎也不能想办法绕过

> 实际上下载的ncm文件早就被破解了，要一直听vip音乐可以走下载的路线

## 9. 回头看：原来真正有趣的是探索过程

现在回顾整个项目，我觉得最有趣的地方并不是最终拿到了多少接口。

而是每解决一个问题，都会暴露出下一个问题。

一开始，我只是想获取完整歌单，结果网页版只给部分数据。

于是我去研究 Windows 客户端，结果客户端请求参数加密了。

好不容易解决加密，又发现歌单详情和歌曲详情需要组合使用。

最后，还要考虑分页、并发、接口设计和错误处理。

原本只想写几个 `fetch()`，结果不知不觉把 HTTP、密码学、异步编程和 API 设计全都复习了一遍。

但也正是这种不断遇到问题、提出假设、通过实验验证的过程，让软件逆向变得有趣。

**逆向工程并不一定意味着破解某个复杂的保护机制。有时候，它只是认真观察一个程序如何工作，再尝试用自己的代码复现其行为。**
