---
title: "Fragment Lifecycle Changed After Support Library 25.1.0"
date: "2018-04-29"
---

在公司的專案內，我們使用了大量的Fragment來達到頁面切換的效果。為了呈現designer設計好的操作流程，我們會在不同的lifecycle callback裡面做相關的設定。由於預期lifecycle callback的順序是固定的，所以這些設定彼此之間有前後關係。

### What happened

升級support library版本至25.1.0後，很多頁面呈現時出現不少錯誤，經過研究後發現是lifecycle callback的順序已經改變，導致設定的順序顛倒。

這影響的範圍有兩個地方：

* `FragmentTransaction.replace()`
* `FragmentManager.popBackStack()`

#### replace() 

為了減少層次，讓使用者可以更方便的退回首頁，我們使用`FragmentTransaction.replace()`替換Fragment，在25.1.0以前，lifecycle callback順序如下：

```java
FragmentA.onPause()
FragmentA.onStop()
FragmentB.onStart()
FragmentB.onResume()
```

而25.1.0則是：

```Java
FragmentB.onStart()
FragmentB.onResume()
FragmentA.onPause()
FragmentA.onStop()
```

#### popBackStack()

用`popBackStack()`可以方便的將最上層的Fragment退出。

在25.1.0以前，lifecycle callback順序如下：

```
Fragment B: onStop()
Fragment A: onStart()
```

而25.1.0則是：

```
Fragment A: onStart()
Fragment B: onStop()
```

#### Summary

退一步來看，可以發現其實前後版本是在不同的大前提下

* 25.1.0以前：先退出前一個Fragment。
* 25.1.0以後：先加入後一個Fragment。

### Why

依照[官方說法](https://issuetracker.google.com/issues/37130220#comment4)，順序變動是預期中的更動，為了效能上的優化。

### Solution

官方在[Issue 37130220](https://issuetracker.google.com/issues/37130220)、[37130329](https://issuetracker.google.com/issues/37130329)提出解法，不過依照討論內容，可知不同的版本有些不同，詳列如下：

#### 25.1.0

由於效能優化預設是打開，為保持彈性，可以透過`FragmentTransaction.setAllowOptimization(false)`關閉。如此`replace()`的lifecycle callback順序就會和以前相同，但`popBackStack()`依然無法還原。

####  25.1.1

這版開始，優化功能預設更改為關閉，所有行為皆還原到25.1.0之前。不過依然可以透過`FragmentTransaction.setAllowOptimization(false)`打開。

#### 25.2.0

在[Issue 37130220](https://issuetracker.google.com/issues/37130220)中有人提到相同錯誤又再次出現，所以如果有疑慮應該要跳過此版。

####  25.3.0 

此版應是穩定版本，在此版release之後就沒有人留言發現問題。

#### 26.1.0

此版將`setAllowOptimization()`更名成`setReorderingAllowed()`。

### Summary

要不直接升級26.1.0，使用`setReorderingAllowed()`將lifecycle callback順序返回舊版順序，不然就停在25.1.0之前。