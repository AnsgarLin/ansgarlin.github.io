---
title: "jEnv"
updated: "2019-04-04"
---
[jEnv](http://www.jenv.be/)是一個可以讓使用者方便控管和切換Java版本的套件。

以下以Mac環境為主，其他平台可以直接看官方網站。

### Installation

```java
brew install jenv
```

### Configuration

#### 加入Java版本

```Java
jenv add /Library/Java/JavaVirtualMachines/jdk1.7.0_80.jdk/Contents/Home
```

#### 查看Java版本

```Java
jenv version(s)
```

#### 設定Java版本

##### 全局

```Java
jenv global <version>
```

##### 當前目錄

```Java
jenv local <version>
```

##### 終端

```Java
jenv shell <version>
```

### Trouble shooting

直接參照[官方文件](https://github.com/gcuisinier/jenv/wiki/Trouble-Shooting)
