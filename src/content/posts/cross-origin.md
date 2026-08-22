---
title: "CORS: 解析audio元素时跨域请求限制的原因和解决方法"
published: 2025-08-07
description: "使用Web Audio Api的AudioContext.createMediaElementSource()分析Audio元素时，出现CORS访问限制(MediaElementAudioSource outputs zeroes due to CORS access restrictions for xxx)"
image: ""
tags: [CORS, Javascript, web]
category: "记录"
draft: false
lang: ""
---

## 0. 遇到的问题

我在写音频图的网页程序时，发现用Audio元素获取外部音频在仅使用`audio.play()`功能时，不会出现任何问题(也无需修改任何请求头)。但是，在使用`AudioContext.createMediaElementSource()`后，不仅无法解析音频，也无法使用`audio.play()`播放音频了

原来的代码：

```javascript
// 获取audio
let songUrl = url;
if (songUrl.startsWith("http://")) {
  songUrl = songUrl.replace("http://", "https://");
}
let song = new Audio(songUrl);

// 创建频谱分析
this.audioContext = new window.AudioContext();
this.analyser = this.audioContext.createAnalyser();
this.analyser.fftSize = 512;
this.bufferLength = this.analyser.frequencyBinCount;
this.dataArray = new Uint8Array(this.bufferLength);

// 分析目标audio
const source = this.audioContext.createMediaElementSource(this.song);
source.connect(this.analyser);
this.analyser.connect(this.audioContext.destination);
```

**报错信息**：

```
MediaElementAudioSource outputs zeroes due to CORS access restrictions for xxx
```

**报错原因**：CORS限制阻止了对音频的访问

**解决办法**：在分析audio之前，添加一行代码

```javascript
song.crossOrigin = "anonymous";
```

默认情况下，浏览器对 `<audio>` 元素的请求是**不发送跨域相关HTTP头**的（不发送origin），因此需要手动添加`Origin`头

虽然解决了问题，但是也有一些问题令我不解，经过搜索与询问，大致得到了答案：

## 1. 为什么不添加origin头也可以播放？

### 原因：

> **纯粹播放音频**（例如 `<audio src="https://example.com/audio.mp3">`）是一个**不涉及 JS 访问原始数据内容**的行为

- 浏览器会把这个请求当作一个**普通的媒体资源请求**，就像加载图片、CSS 或字体一样
- 这种行为默认被认为**安全**，因为没有访问底层数据

所以浏览器不会强制要求服务器设置 CORS 头，即使你是从别的域加载资源也一样可以播放

也因此，浏览器默认对 `<audio>` 元素的请求是**不发送跨域相关HTTP头**的

## 2. 为什么使用Web Audio Api分析音频时必须满足CORS条件？

### 原因：

> 用 Web Audio API 分析音频（比如使用 `AudioContext.createMediaElementSource(audio)`，然后连接到 `analyser`），你实际上是**访问资源的底层音频数据**

所以，必须通过CORS策略，让服务器判断是否有获取资源的权限，如果不添加origin头，自然无法通过校验

值得注意的是，就算添加了origin，也需要服务器的许可

对于没有限制的服务器，如`Access-Control-Allow-Origin: *`用anonymous即可。如果有相关限制，需要把origin设置为域名（当然，如果你的域名也不在访问范围内，那就真的访问不了了）
