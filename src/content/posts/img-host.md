---
title: 个人图床
published: 2026-08-19
description: "基于Cloudflare搭建个人图床"
image: "https://img.eternity0.xyz/beautiful-images/cheshire-cat.jpg"
tags: ["Cloudflare", "图床", "Python", "Javascript"]
category: "教程"
draft: false
lang: ""
---

## 0. 准备

- Cloudflare账号
- 银行卡（用于注册R2储存桶，免费额度也需要）

## 1. 创建R2储存桶

在左侧目录找到：**存储和数据库 -> R2对象存储**

![img](https://img.eternity0.xyz/blog/img-host/index.png)

第一次打开需要输入银行卡绑定，如果自己用的话，免费额度（应该）是够的

**AI总结的免费额度内容**
| Resource | Free Allowance |
| --------------------------- | ---------------------- |
| **Storage** | **10 GB** |
| Upload operations (Class A) | 1,000,000/month |
| Read operations (Class B) | 10,000,000/month |
| **Bandwidth (egress)** | **Unlimited and free** |

接着在右上角可以找到**创建储存桶**

点击后如下所示

![img](https://img.eternity0.xyz/blog/img-host/create.png)

第一个储存桶名称可以随便取，能够自己区分就行，不影响部署后的图片路径

位置指储存桶服务器，自动能够根据你的ip选择，如果你没有挂梯子，选自动就可以（挂了的话可以右边手动选或直接关了）

储存类选择标准，原因下面写了（除非你的图片真的每个月访问少于一次）

创建成功后，你已经可以上传/访问图片了

![img](https://img.eternity0.xyz/blog/img-host/r2-page.png)

## 2. 绑定自己的域名

进入你的储存桶，即上面一张图片的界面

左上角有一个设置的按钮

找到**自定义域**

在这里你可以把储存桶绑定到自己的域名下，比如这里放在img子域名

如果你的域名在cloudflare上管理，应该会自动创建DNS记录

![img](https://img.eternity0.xyz/blog/img-host/settings.png)

现在，可以用自己的域名访问图片了，如`your.domain.com/xxx.png`

## 3. 自己写上传/下载客户端

毕竟是个人图床，肯定要自己的方便又快捷的管理平台

### 3.1 获得api

回到**R2 对象存储**页面，右下角有一个**管理API令牌**按钮

进入之后界面如下

![img](https://img.eternity0.xyz/blog/img-host/api1.png)

账户和用户的区别在于，一个账户可以有多个用户身份，如果用户从账户中移除，API也会失效。自己用用的话选择**账户**即可

![img](https://img.eternity0.xyz/blog/img-host/api2.png)

令牌名称可以随便起，后面的权限取决于你的用途，作为自己的图床，一般读写都要（根据需要而定）

最好指定一下储存桶，确保这个API只能访问特定的储存桶

TTL指的是有效期，永久即可

**注意！**接下来的页面会显示你的所有这次创建的API内容，**这个页面只会显示这一次！**请及时复制、保存。

内容包括：

- token value
- access key id
- secret key id
- endpoint

这些内容用于第三方软件/代码控制你的储存桶

### 3.2 找/写一个图床管理软件

如果你想找，GitHub有很多，B站视频也有很多介绍

如果你想写，可以使用s3来与你的储存桶交互

```python
# python
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='http://xssxx.r2.cloudflarestorage.com',
    aws_access_key_id='xxxx',
    aws_secret_access_key='xxxx'
)

# upload
s3.upload_file(local_path, bucket_name, object_key)

# download
s3.download_file(bucket_name, object_name, file_path)

# delete
s3.delete_object(Bucket=bucket_name, Key=object_name)

# list
response = s3.list_objects_v2(Bucket=bucket_name)

```

---

```javascript
// javascript
import { S3Client } from '@aws-sdk/client-s3

const s3 = new S3Client({
    endpoint: 'https://xxxx.r2.cloudflarestorage.com',
    region: 'auto',
    credentials: {
        accessKeyId: 'xxxx',
        secretAccessKey: 'xxxx'
    }
});

// upload
const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: fileContent
});
await s3.send(command);

// download
const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey
});
const response = await s3.send(command);

//delete
const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: objectKey
});
await s3.send(command);

// list
const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix
});
const response = await s3.send(command);
```

## \*4. 随机图片api

使用cloudflare workers写api能直接访问R2储存桶

### 4.1 创建workers

找到：**计算->Workers和Pages**

![img](https://img.eternity0.xyz/blog/img-host/workers-index.png)

右上角有一个**创建应用程序**按钮

点击后如下

![img](https://img.eternity0.xyz/blog/img-host/create-workers.png)

接着，你需要写一个（或AI生成一个）随机图片api的代码

是个AI应该都能做到，这里不粘贴代码了

接下来有两种导入方法：

- 1. 选择Upload your static files

- 2. 先选择从hello world开始，点击部署。部署完毕后点右上角**编辑代码**，把代码复制进去

第一种不行的话就用第二种

### 4.2 绑定R2储存桶

在左上角菜单里面找到**绑定**

![img](https://img.eternity0.xyz/blog/img-host/workers-bind.png)

点击**添加绑定**

![img](https://img.eternity0.xyz/blog/img-host/workers-bind2.png)

类型选择R2储存桶，添加绑定

![img](https://img.eternity0.xyz/blog/img-host/workers-bind3.png)

**注意！**，变量名称指的是代码里的环境变量

例如你的变量名称是`R2_BUCKET`

你的代码里面的写法是应该是`env.R2_BUCKET`

此外，别忘了选择你的图片所在的储存桶

现在你的api应该可以运行了，你可以访问默认域名检验

### 4.3 绑定自己的域名

左上角找到**域**

![img](https://img.eternity0.xyz/blog/img-host/workers-domain.png)

添加域名

输入自己的域名，如random.xxx.com

cloudflare会自动添加DNS记录
