---
title: "crack"
updated: "2019-04-04"
---
## 使用工具
* [https://ibotpeaches.github.io/Apktool/ apktool]
* auto-sign.rar
* dex2jar
* jd-gui

## Crack
### Smali
* 反組譯apk
```
./apktool.bat d <destination> target.apk
```
* 編輯內容
※ 如無法直接看懂smali，可先反組成jar檔觀看
* 重新打包
```
./apktool.bat b <source folder>
```

### Jar 
* 解壓縮apk
將附檔幅改成zip，可進行解壓
* 取出classes.dex
* 用dex2jar將dex轉成jar檔
* 使用jd-gui看內容
