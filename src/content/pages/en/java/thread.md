---
title: "Thread"
updated: "2019-04-04"
---
## What
在UI thread上直接執行Activity.runOnUiThread會直接執行，而不是ui thread執行則會用activity的handler去post這段任務

## Interrupt
Thread停止方式是先使用Interrupt，讓thread因任何原因產生的block狀態解除，或是直接中斷並送出interrupr exception，然後在run裡面新增退出的條件和catch exception停止當前任務，讓thread可以在未完成一個任務的狀態下退出
