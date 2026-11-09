---
title: "How To Equally And Elegantly Layout Child Views In LinearLayout"
date: "2018-04-17"
---

在實作中，想要設定子View在LinearLayout中所佔的空間，可在子View上設定`android:layout_weight`。這參數使用時機，通常在於嘗試將LinearLayout的寬，平均分攤給所有子View時。

現在假設我們需要用四個子View來塞滿LinearLayout，並且寬度要平均，則在子View上設定：

````Xml
// On child view
layout_weight = 1
````

結果如下：

![](/zh-tw/news/2018/04/17/how_to_equally_and_elegantly_layout_child_views_in_LinearLayout/linearlayout_weight.png)

這種寫法的缺點在於，如果今天的子View的數量不足時，子View依然會填滿整個LinearLayout：

![](/zh-tw/news/2018/04/17/how_to_equally_and_elegantly_layout_child_views_in_LinearLayout/linearlayout_weight_less.png)

於是子View就會變成原本的兩倍寬，與原先的設計不同，且當子View剩下一個時，整體畫面會更加突兀。

解決的方法有兩種，一種就是透過程式動態取得寬度，然後依照設計的比例均分後設定給子View。在android的實作中，寬高的取得時機必須要與整個繪製的流程配合，取得的數值也不完全是正確的。此方法並非不可，只是較為複雜，在此不多做贅述。

另一種方法就是設定`android:weightSum`。根據[官方描述](https://developer.android.com/reference/android/widget/LinearLayout.html#attr_android:weightSum)，此參數代表子View的`layout_weight`的總和，如此就可以不增加多餘的程式碼運算，就可讓每個子View自行計算出所需要的寬度。

要做的修改不多，只要在LinearLayout上設定：

```Xml
// On LinearLayout
android:weightSum = 4
```

每個子View的`layout_wight`都為1，則每個子View寬就為LinearLayout的四分之一：

![](/zh-tw/news/2018/04/17/how_to_equally_and_elegantly_layout_child_views_in_LinearLayout/linearlayout_weight_sum.png)