---
title: "About ProGuard - SP"
date: "2018-07-24"
---
近期調整了專案內的ProGuard設定，所以編譯專案時，遇到了以下錯誤訊息：

```Java
Warning: com.inside.library: can't find referenced class com.android.vending.billing.IInAppBillingService
Warning: com.inside.library: can't find referenced class com.android.vending.billing.IInAppBillingService$Stub
Warning: com.inside.library: can't find referenced class com.google.android.instantapps.InstantApps
```

ProGuard說他找不到該有的類別，所以直接中斷編譯。

問題是，專案內根本沒用到這兩個類別。還好此次的變動不多，可以確定原因是公司內部的library，於是直接找到library的原始碼，在其根目錄下的ProGuard設定檔內找到以下內容：

```groovy
-dontwarn com.google.android.instantapps.InstantApps
-dontwarn com.android.vending.billing.IInAppBillingService
-dontwarn com.android.vending.billing.IInAppBillingService$Stub
```

這裡規則是讓ProGuard不要管這兩個類別。但因爲**此ProGuard設定檔不會跟著library發佈**，所以沒有作用。

我們使用的library，實際是整個library其中一個module，所以可在module資料夾內找到module的ProGuard設定檔，consumer-proguard-rules.pro。對照`build.gradle`後，確定這就是module會帶走的設定檔，且裡面並沒有前面`-dontwarn`的那段。這代表我們得自己想辦法解決了。

### Solution

#### Use "-keep"

找不到類別的問題，直覺就是將要用到的類別keep住：

```groovy
-keep com.google.android.instantapps.InstantApps
-keep com.android.vending.billing.IInAppBillingService
-keep com.android.vending.billing.IInAppBillingService$Stub
```

編譯後，問題仍然存在。原因是這兩個類別是包含在獨立的library內，我們專案用不到，自然是不會有

那就在`build.gradle`設定dependency：

```Java
implementation com.android.billingclient:billing:1.1
implementation com.google.android.instantapps:instantapps:1.1.0
```

結果編譯成功。如此可以確定原因就是ProGuard因某種原因，想要找這兩個類別，而從library的ProGuard規則來看，這兩個是不會被keep的。所以就算沒有被刪除，名稱也已經被更改過，自然是找不到。

#### Use "-dontwarn"

前一個做法需要增加新的dependency，這對我們來說是很多餘的，因為根本用不到，所以另一個作法是叫ProGuard不要提示錯誤。 

要注意的是，使用`-dontwarn`請ProGuard不要吐警告，不代表程式執行時就不會出錯，這只是讓編譯可以順利進行的折衷辦法。在執行階段仍然是有機會發生錯誤的。

### Why

解決問題後，就來回頭看看為什麼需要這兩個類別。直接用字串搜尋，這兩個檔案內找到如下的內容：

```Java
private static final String CLASS_NAME_INSTANT_APP = "com.google.android.instantapps.InstantApps";

public void init(Context context) {
    try {
        Class.forName(CLASS_NAME_INSTANT_APP);
    } catch (ClassNotFoundException e) {
        e.printStackTrace();
        return;
    }
}
```

簡單說就是用來判斷dependency，如果使用此library的專案沒有所需的類別，則會直接報錯並終止當前操作。

邏輯上沒問題，但我們都知道：Java編譯後，使用字串變數的地方，會由純字串取代，所以ProGuard看到的是：

```Java
Class.forName("com.google.android.instantapps.InstantApps");
```

根據ProGuard的[官方文件](https://www.guardsquare.com/en/products/proguard/manual/introduction)指出，這是ProGuard會自動處理的Reflection應用，所以ProGuard會想要找到字串所描述的類別。

這在ProGuard進行分析並處理的階段時，並不會產生問題，因為被改名是最後一步，做完就直接打包發佈，所以library自己編譯時不會有問題。但使用library的專案，會因為ProGuard在看到此串文字，而想要找此類別卻找不到，而導致編譯失敗。

這件事告訴我們，如果今天是要開發library，要確保所有必須要有的ProGuard規則，都有放在會跟著library出去的ProGuard設定檔內。