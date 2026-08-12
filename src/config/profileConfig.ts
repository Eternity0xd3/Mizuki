import type { ProfileConfig } from "../types/config";

// 个人资料配置
export const profileConfig: ProfileConfig = {
  avatar: "assets/images/avatar.webp", // 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
  name: "Eternity0",
  bio: "Explore the ever-evolving world to the fullest",
  typewriter: {
    enable: false, // 启用个人简介打字机效果
    speed: 80, // 打字速度（毫秒）
  },
  links: [
    {
      name: "Bilibili",
      icon: "fa7-brands:bilibili",
      url: "https://space.bilibili.com/488842102",
    },
    {
      name: "GitHub",
      icon: "fa7-brands:github",
      url: "https://github.com/Eternity0xd3",
    },
    {
      name: "X",
      icon: "simple-icons:x",
      url: "https://x.com/eternity_yx",
    },
  ],
};
