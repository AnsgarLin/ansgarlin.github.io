---
title: "ADB"
updated: "2019-07-20"
---
Android Debug Bridge (adb) is a versatile command line tool that lets you communicate with an emulator instance or connected Android-powered device.

### 通用

* 指定機器執行指令

```bash
adb -s <device name> <command>
```

### devices

* 查看以連線之裝置列表

```bash
adb devices
```


### install

* 一般安裝apk

```bash
adb install <target apk name>.apk
```

* 強制安裝apk

```bash
adb install -r <target apk name>.apk
```

### remount

1. 在CMD下直接刪除和上傳檔案到機器

```bash
adb remount
```

### logcat

* 查看含有特定字串的log
```bash
adb logcat <target string>:V *:S
```

### shell

* 登入shell介面

```bash
adb shell
```

* 取得event code

```bash
adb shell getevent
```

* 發送intent

```bash
adb shell am
```

* 查看notification

```bash
adb shell dumpsys notification
```

* 清空notification

```bash
adb shell service call notification 1
```

* 點擊screen

```bash
adb shell input tap x y
```

* 手指滑動

```bash
adb shell input swipe x1 y1 x2 y2
```

* 輸入keyevent

```bash
adb shell input keyevent <keycode>
```
[Reference](https://codeforfun.wordpress.com/2014/02/26/android-device-automation-with-adb/)

* 監看某app的記憶體用量

```bash
adb shell dumpsys meminfo <package name>
```

* 讀取TaskStack列表

```bash
adb shell dumpsys activity activities | sed -En -e '/Stack #/p' -e '/Running activities/,/Run #0/p'
```

* Deeplink

```bash
adb shell am start -a android.intent.action.VIEW -d "<link>" (<package>)
```

### In shell mode

#### Run-as

* 切換成PACKAGE_NAME的執行身份

```bash
// in shell
run-as <package-name>
```

### Combination

* Find package pid

```
adb shell ps | grep <package>
```

* 確認memory用量

```
// Emulator需要用api google
cat /proc/<pid>/maps
```

* 確認fd量

需要使用沒有Google play的emulator

```
adb shell run-as "<package>" ls -al /proc/<pid>/fd | wc -l
```

* 確認thread量

```
adb shell ps -T | grep "<pid>" | wc -l
```

* 查看name程序的memory使用量，並以RSS欄位為準

```bash
adb shell ps | grep "name"
```

### Error handle

* Eclipse error: ADB server didn't ACK,  * failed to start daemon *

```bash
通常直接刪除tfadb.exe這程序然後直接重啟adb server可解除，如不行則依照以下步驟
--
//這是因為adb使用的port 5037被佔用了,找出誰占用
netstat -aon|findstr "5037"
TCP  127.0.0.1:3477  127.0.0.1:5037  XXXXXX  5263
TCP  127.0.0.1:3478  127.0.0.1:5037  XXXXXX  5263
--
//依照PID反查程序名稱
tasklist | findstr "5263"
xxx.exe    5263 Console              0  x.xxxk
--
//刪除程序
taskkill /f /t /imxx.exe
--
//重開adb，隨便執行一adb指令
adb devices
```

### Reference

* [Android document](https://developer.android.com/studio/command-line/adb)