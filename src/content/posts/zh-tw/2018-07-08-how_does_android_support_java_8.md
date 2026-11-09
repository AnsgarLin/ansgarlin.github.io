---
title: "How Does Android Support Java 8"
date: "2018-07-08"
---

本篇沒有什麼技術分析，純粹只是覺得Google這做法很有趣就做個紀錄。

Google官方從Android Studio 3開始，除了開始支援Kotlin，也開始支援Java8，主要是為了讓大家可以使用Lambda。而根據[官方文件](https://developer.android.com/studio/write/java8-support)描述，為了支援Java8，Android Studio編譯的流程變成如下圖：

![](https://developer.android.com/studio/images/write/desugar_2x.png)

在java檔編譯成class檔，然後要再轉成dex檔之前，會再經過一步叫desugar的操作。舉例來說，如果現在要指定按鈕的listener，用lambda表示會如下：

```Java
button.setOnClickListener(v -> Log.d("Button clicked"));
```

desugar就會將這段還原如下：

```Java
button.setOnClickListener(new View.OnClickListener() {
    @Override
    public void onClick(View v) {
        Log.d("Button clicked")
    }
});
```

至於為何要這樣做，原因其實是：

* **ART不支援Java8**

無法支援，但大家又都很愛用Lambda，那只好中間包一層去轉譯了。也難怪官方文件上會說不是所有Java8的功能都能用，還列了表給大家看，應該就是他們還沒處理，或是根本不想要去轉譯一些語法糖。

總之，現在有的就用，沒有的就告訴你之後版本會有，`API level 24 or higher.`，總是給人無限想像空間。

### Reference

* [java8-support](https://developer.android.com/studio/write/java8-support)