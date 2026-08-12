---
title: 神经网络Part.1：线性函数拟合
published: 2025-10-01
description: '初步学习神经网络时的笔记: 线性拟合'
image: ''
tags: [神经网络, Python]
category: '笔记'
draft: false 
lang: ''
---
## 1. 神经网络的基本流程

1. **输入层**：接收数据（数字、图像等）。
2. **隐藏层**：多个神经元，做「线性组合 + 非线性激活」。
3. **输出层**：得到预测结果。
4. **损失函数**：衡量预测与真实的差距。
5. **反向传播**：计算梯度并更新参数。
6. **训练循环**：前向传播 → 计算损失 → 反向传播 → 参数更新，重复多次直到收敛。

## 2. 线性函数拟合

- **模型形式**

  y=wx+b

- **目标**：找到合适的参数 w,b 使得预测值 `y_{pred}` 与真实值 y 尽量接近。

- **方法**：

  - 定义损失函数（如均方误差）
  - 通过 **梯度下降** 更新参数——把损失函数对w, b分别求偏导，找到能使误差函数最小的极值点

- **意义**：线性拟合是神经网络的 **基础单元**（的基础），相当于一个神经元在没有激活函数时的计算。

+ **局限**：只能拟合直线型关系，无法处理非线性的复杂数据。因此，通常需要特征变换，或添加非线性激活函数...

## 3. 数学公式

### 1. 损失函数（衡量拟合效果）

常用 **均方误差（MSE）**：

$$
L = \frac{1}{n} \sum_{i=1}^n (y_i - \hat{y}_i)^2
$$

预测值：

$$
\hat{y}_i = w x_i + b
$$

### 2. 梯度下降（参数优化方法）

通过不断调整参数 w,b 让损失函数 L 尽量减小。

更新公式：

$$
w := w - \eta \frac{\partial L}{\partial w}
\\
b := b - \eta \frac{\partial L}{\partial b}
$$

其中 η 是学习率。

梯度公式：

$$
\frac{\partial L}{\partial w} = -\frac{2}{n} \sum_{i=1}^n x_i (y_i - (w x_i + b))
\\
\frac{\partial L}{\partial b} = -\frac{2}{n} \sum_{i=1}^n (y_i - (w x_i + b))
$$

### 计算过程

**对 w 的偏导**

先代入损失函数：

$$
L = \frac{1}{n} \sum_{i=1}^n \big(y_i - (w x_i + b)\big)^2
$$

对 w 求导（复合函数，链式法则）：

$$
\frac{\partial L}{\partial w}
= \frac{1}{n} \sum_{i=1}^n 2 \big(y_i - (w x_i + b)\big) \cdot \frac{\partial}{\partial w}\big(y_i - (w x_i + b)\big)
$$

所以：

$$
\frac{\partial L}{\partial w}
= \frac{1}{n} \sum_{i=1}^n 2 \big(y_i - (w x_i + b)\big)(-x_i)
$$

化简：

$$
\frac{\partial L}{\partial w}
= -\frac{2}{n} \sum_{i=1}^n x_i \big(y_i - (w x_i + b)\big)
$$

**对b同理**：
$$
\frac{\partial L}{\partial b}
= \frac{1}{n} \sum_{i=1}^n 2 \big(y_i - (w x_i + b)\big) \cdot \frac{\partial}{\partial b}\big(y_i - (w x_i + b)\big)
$$

$$
\frac{\partial L}{\partial b}
= -\frac{2}{n} \sum_{i=1}^n \big(y_i - (w x_i + b)\big)
$$

------

## 4.学习率的选择

+ 学习率过小：收敛很慢

+ 学习率合适：平稳收敛

+ 学习率过大：**可能发散**

### 关于梯度下降时，学习率过大导致的发散

以一维情况举例：

假设损失函数是一个抛物线：

$$
L(w) = (w - 5)^2
$$

最优点在 5。梯度为：

$$
\frac{dL}{dw} = 2 (w - 5)
$$

更新公式：

$$
w_{t+1} = w_t - \eta \cdot 2 (w_t - 5)
$$

左右同时 -5，合并：

$$
w_{t+1} - 5 = (1 - 2\eta)(w_t - 5)
$$

这里 `w_{t+1} -5`和`w_{t} -5` 代表当前w与最优w的距离。因此，要想收敛，必须满足：
$$
|1 - 2\eta| < 1
$$

解得：

$$
0 < \eta < 1
$$

所以学习率太大（比如 η≥1）时，误差项会不断放大 → **发散**。

直观理解：每次“跨过”极值点太远，新的位置比之前更离谱 → 震荡逐渐变大，最终发散

---

## 5. 代码实现

```python
def linear_regression(x, y, lr=0.015, epochs=1000):
    # 线性回归
    w = 0
    b = 0
    for epoch in range(epochs):
        y_pred = w * x + b # 预测值
        loss = np.mean((y_pred-y)**2) # 损失函数(均方差)
        dw = np.mean(2*(y_pred-y)*x) # 梯度(对w求偏导)
        db = np.mean(2*(y_pred-y)) # 梯度(对b求偏导)
        w -= lr * dw # 梯度下降
        b -= lr * db # 梯度下降

        print(f"Epoch {epoch}, Loss: {loss:.4f}, w: {w:.2f}, b: {b:.2f}")
    return w,b
```

+ lr = 学习率
+ epochs = 训练次数

结果：

![img](https://youke1.picui.cn/s1/2025/10/01/68dc0f8022ed1.png)

### 完整代码

```python
import numpy as np

def generate_random_data(w,b,seed=0):
    np.random.seed(seed)
    x = np.linspace(0, 10, 50)

    # 生成函数，赋予噪声影响
    y = w * x + b + np.random.randn(*x.shape)*2
    return x, y

def linear_regression(x, y, lr=0.015, epochs=1000):
    # 线性回归
    w = 0
    b = 0
    for epoch in range(epochs):
        y_pred = w * x + b # 预测值
        loss = np.mean((y_pred-y)**2) # 损失函数(均方差)
        dw = np.mean(2*(y_pred-y)*x) # 梯度(对w求偏导)
        db = np.mean(2*(y_pred-y)) # 梯度(对b求偏导)
        w -= lr * dw # 梯度下降
        b -= lr * db # 梯度下降

        print(f"Epoch {epoch}, Loss: {loss:.4f}, w: {w:.2f}, b: {b:.2f}")
    return w,b

def show_result(x, y, w, b):
    import matplotlib.pyplot as plt
    plt.scatter(x, y, label="Data")
    plt.plot(x, w*x+b, color="red", label="Fitted line")
    expr = f"y = {w:.2f}x + {b:.2f}"
    plt.text(0.05, 0.95, expr, transform=plt.gca().transAxes,
        fontsize=12, verticalalignment='top')
    plt.legend()
    plt.show()

if __name__ == '__main__':
    x, y = generate_random_data(3, 2)
    print(x)
    print(y)

    w,b = linear_regression(x, y)
    show_result(x, y, w, b)
```

