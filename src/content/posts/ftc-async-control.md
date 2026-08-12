---
title: FTC机器人：自动阶段的异步控制
published: 2025-01-20
description: '在参与FTC机器人比赛中，自动阶段有大量需要底盘与其它部件的独立运行，通过异步可以较好的处理这种情况'
image: ''
tags: [FTC Robotic, Java]
category: '记录'
draft: false 
lang: ''
---

在和多线程斗智斗勇多次无果后，选择使用异步来解决机器人自动阶段手脚独立运行的任务

这个思路我最早在FTCLib上看到，但是由于一身反骨（？，我不打算直接套用这个包（主要是因为兼容起来太烦了），决定自己搓一个异步框架

大致的思路是：把自动阶段所有会被调用的方法拆分为：

+ 初始化（循环前）：init

+ 迭代（循环内）：iterate

+ 结束（循环后）：finish

+ 继续循环的条件（或者 !跳出循环的条件）：hasNext

并在自动阶段的代码中，只使用一个循环，来控制所有这些任务，来实现无阻塞的执行多个任务

于是，写了一个Command接口

```java
public interface Command {
    void iterate();

    boolean hasNext();

    default void init() {}

    default void finish() {}
}
```

接着，我通过两种CommandGroup来控制这些Command的执行：

+ ParallelCommandGroup(Command... commands): 同时执行commands中的所有命令
+ SequentialCommandGroup(Command... commands): 依次执行commands中的命令

这些CommandGroup都是实现了Command接口的类，因此可以反复套娃（理论上

可以通过Parallel嵌套Sequential来实现类似两个“进程”的效果（就是异步）。此外，如果在Parallel外面套上一层Sequential的话，可以等两个并发Command都结束了之后执行下一个CommandGroup，实现类似await的功能。

```java
ParallelCommandGroup cmd1 = new ParallelCommandGroup(
                new SequentialCommandGroup(
                        // 底盘
                    	new Command1(),
                    	......
                ),
                new SequentialCommandGroup(
                        // 其他部件
                    	new Command2(),
                    	......
                )
        );
```

这样，可以用流程图先画出命令执行的先后顺序（以及哪些需要并发执行），再直接套用到Parallel和Sequential中

> A -> B -> C -> ...</br>
> &nbsp;&nbsp;`-> D -> E -> ...


以下是我对这些框架的实现：

**ParallelCommandGroup.java**

```java
import java.util.Arrays;

public class ParallelCommandGroup implements Command {
    Command[] commandGroup;
    boolean[] isFinished;

    public ParallelCommandGroup(Command... commands) {
        this.commandGroup = commands;
        isFinished = new boolean[commands.length];
        Arrays.fill(isFinished, false);
    }

    @Override
    public void iterate() {
        for (int i = 0; i < commandGroup.length; i++) {
            Command eachCommand = commandGroup[i];
            boolean eachCmdFinished = isFinished[i];

            if(eachCommand.isContinuous()){
                eachCommand.iterate();
                isFinished[i] = eachCommand.hasNext();
            }
            if(!eachCmdFinished) {
                if (eachCommand.hasNext()) {
                    eachCommand.iterate();
                } else {
                    eachCommand.finish();
                    isFinished[i] = true;
                }
            }
        }
    }

    @Override
    public boolean hasNext() {
        for(boolean each: isFinished){
            if(!each){
                return true;
            }
        }
        return false;
    }

    @Override
    public void init() {
        for (Command eachCommand : commandGroup) {
            eachCommand.init();
        }
    }

    @Override
    public void finish() {
        Command.super.finish();
    }

    @Override
    public void cancel() {
        Command.super.cancel();
    }

    public void runCommand(){
        init();
        while (hasNext()){
            iterate();
        }
        finish();
    }
}

```

**SequentialCommandGroup.java**

```java
public class SequentialCommandGroup implements Command{
    Command[] commandGroup;
    int cmdLength;
    int currentIndex = 0;

    public SequentialCommandGroup(Command... commands) {
        this.commandGroup = commands;
        this.cmdLength = commandGroup.length;
    }

    @Override
    public void init(){
        commandGroup[0].init();
    }

    @Override
    public void finish(){
        commandGroup[cmdLength-1].finish();
    }

    @Override
    public void iterate() {
        if(currentIndex >= cmdLength)return;

        Command currentCommand = commandGroup[currentIndex];
        if(currentCommand.isContinuous()){
            currentCommand.iterate();
        }else {
            if (currentCommand.hasNext()) {
                currentCommand.iterate();
            } else {
                currentCommand.finish();
                currentIndex += 1;
                if (currentIndex < cmdLength) commandGroup[currentIndex].init();
            }
        }
    }

    @Override
    public boolean hasNext() {
        if(currentIndex == cmdLength - 1){
            return commandGroup[currentIndex].hasNext();
        } else return currentIndex < cmdLength;
    }

    public void runCommand(){
        init();
        while (hasNext()){
            iterate();
        }
        finish();
    }

    @Override
    public boolean isContinuous(){
        for (Command eachCommand: commandGroup) {
            if(eachCommand.isContinuous())return true;
        }
        return false;
    }
}

```


