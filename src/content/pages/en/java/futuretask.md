---
title: "FutureTask"
updated: "2019-04-04"
---
## What
特殊的Runable，執行任務並提供監控狀態的接口

## How
1. 將要執行的任務包裝在FutureTask中，由於FutureTask有實作Runable，所以可以被Thread當成一個任務執行
2. 建一個新的thread去執行
3. FutureTask會再執行innerRun，狀態改為RUNNING，執行真正指定的任務，並且Thread會block在callable.call
4. call有結果後會呼叫set -> innerSet，狀態改為RAN，將結果設定給result，如此get結果時才不會是null

## Summary
一個實作runnable來執行指定的任務的物件，執行start後會阻塞在run裡面直到任務完成並設定result，如此外部get時就不會取到null而有回傳結果
