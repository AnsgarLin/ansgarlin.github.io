---
title: "XML"
updated: "2019-04-04"
---
## attr
* 需注意版本差異，如"?android:attr/actionBarSize"，在舊版為48dp，而新版為56dp。
> 1. 設置數值於dimen中供xml和原始碼使用
> 2. xml使用attr，原始碼則需解析attr的數值來使用，不要訂變數存單一數值。
> 3. 設置相同數值於xml和原始碼。