---
title: "Gradle"
updated: "2019-08-16"
---
Android Studio用Gradle的腳本來進行編譯動作，詳情可直接查看[官網](https://docs.gradle.org/current/userguide/userguide.html)。


### Configuration

在Android專案內，Gradle腳本會放在`build.gradle`內。

#### 強制執行task

編譯過程中，會避免重複執行任務，當task已被執行過，則會有以下訊息：

```Java
:<taskname> UP-TO-DATE
```

如要強迫其次編譯時都要執行：

```Java
// In build.gradle
task {
    outputs.upToDateWhen { false }
}
```

[Force rerun task](https://stackoverflow.com/questions/42175235/force-gradle-to-run-task-even-if-it-is-up-to-date?answertab=active#tab-top)

### Command

在每個Android專案目錄下，都會有一個可執行的檔案，`gradlew`，可以直接執行Gradle腳本進行編譯或其他操作。

#### 執行task

```Java
./gradlew <task> name
```

#### 列出library關係：

```Java
./gradlew dependencies
```

##### 查看特定套件

假設目前dependency內有設定library如下：

```Java
implementation "com.github.bumptech.glide:glide:$glideVersion"
```

透過`dependencyInsight`可以單獨輸出dependency：

```Java
./gradlew dependencyInsight --configuration compile(implementation) --dependency glide


com.github.bumptech.glide:glide:3.8.0
   variant "default"
\--- compile
```

> 在Gradle 3.0之後，會出現以下錯誤：
```
Resolving configuration 'implementation' directly is not allowed
```
> 目前解法是將`implementation`換回`compile`。

#### 關閉開啟中的daemon

```Java
./gradlew stop
```

#### 清除編譯產生的資料

```Java
./gradlew clean
```

#### 查看所用的keystore的SHA1

```Bash
./gradlew signingConfigs
```

#### 清除build cache

```bash
./gradlew cleanBuildCache
```

#### 強制重新解析和下載dependencies

```bash
./gradlew build --refresh-dependencies
```

### Trouble Shooting

* **Unsupported major.minor version 52.0**

  如果本機的Java版本不是1.8，則會出現這樣的訊息。所以只要將版本升級就好，或是透過[jEnv](http://www.jenv.be/)這類的套件調整版本。詳細也可以看Note的[jEnv](../note/jenv.html)。
  
### Reference

* [Gradle - Command](https://docs.gradle.org/current/userguide/command_line_interface.html)