---
title: "Custom View:Attribute, LayoutParams, Size"
date: "2018-05-16"
---

在公司的專案中，有時設計師提供的畫面設計，是原生的元件無法直接實現的，所以要透過重寫原生的元件來實現預期的效果。

一般來說，要自訂一個View元件的畫面，需要知道以下三個要點：

* 如何自訂Attributes。
* 如何自訂LayoutParams。
* 如何取得View的大小、畫面位置與範圍。

以下將依照順序介紹這三個要點的用途及做法。

### 如何自訂Attributes

在`/res/values/attr.xml`中，加入如下設定：

```xml
<resources>
    <declare-styleable name="StyleName">
        <attr name="styleAttr" format="boolean"/>
    </declare-styleable>
</resources>
```

`format`可以有很多種型態，舉例如下：

- boolean
- color
- dimension
- enum
- flag
- float
- fraction
- integer
- reference
- string

設定好後就可以在xml內使用自訂的參數設定：

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
   xmlns:app="http://schemas.android.com/apk/res-auto">
    <com.example.customview 
		app:styleAttr="true" />
</LinearLayout>
```

最後只要在自訂物件的類別中，覆寫外部參數有`AttributeSet`的函示，一般為建構函示，就可以順利取得xml內的設定值並套用：

```Java
public Customview(Context context, AttributeSet attrs) {
   super(context, attrs);
   TypedArray a = context.obtainStyledAttributes(attrs, R.styleable.styleName, defStyle, 0);
   try {
       boolean styleAttr = a.getBoolean(R.styleable.StyleName_styleAttr, false);
   } finally {
       a.recycle();
   }
}
```

這邊要注意的是TypedArray使用後一定要呼叫`recycle()`，否則會有OOM的疑慮。

### 如何自訂LayoutParams

如果自訂的物件是一個ViewGroup，勢必也會想自訂的參數，可以使用在子View上。這時就需要自行寫一個專屬於自訂物件的LayoutParams。

在這先點出所有應該要覆寫的函式：

* checkLayoutParams()
* generateLayoutParams()
* generateDefaultLayoutParams()

#### checkLayoutParams()

就如字面，判斷傳入的LayoutParams類型是否正確。

#### generateLayoutParams()

此函式會在以下兩種情境使用到：

##### Inflate

只要是一個View透過LayoutInflater產生的，都會走到以下函示：

```java
// In LayoutInflater
void rInflate(XmlPullParser parser, View parent, Context context,
            AttributeSet attrs, boolean finishInflate) throws XmlPullParserException, IOException {
    ...
    final View view = createViewFromTag(parent, name, context, attrs);
    final ViewGroup viewGroup = (ViewGroup) parent;
    final ViewGroup.LayoutParams params = viewGroup.generateLayoutParams(attrs);
    rInflateChildren(parser, view, attrs, true);
    viewGroup.addView(view, params);
    ...
}
```

如此就很明顯了，子View建立後會透過parent呼叫`generateLayoutParams()`來取得對應的LayoutParams。

##### Add view

上面的原始碼最後一行用了`addView()`來將建立好的子View，連同LayoutParams加入parent，最終會走到`addViewInner()`：

```java
// In ViewGroup
private void addViewInner(View child, int index, LayoutParams params,
        boolean preventRequestLayout) {
    ...
    if (!checkLayoutParams(params)) {
        params = generateLayoutParams(params);
    }
    ...
}
```

不論是Android自動生成的View，或是自己呼叫`addView()`，都會走到這裡並再透過`checkLayoutParams()`進行一次確認。

#### generateDefaultLayoutParams()

此函式用於沒有傳入LayoutParams的`addView()`：

```java
// In ViewGroup
public void addView(View child, int width, int height) {
    final LayoutParams params = generateDefaultLayoutParams();
    params.width = width;
    params.height = height;
    addView(child, -1, params);
}
```

所以結論如下：

* **覆寫`checkLayoutParams()`**

```java
@Override
protected boolean checkLayoutParams(ViewGroup.LayoutParams p) {
    return p instanceof LayoutParams;
}
public static class LayoutParams extends ConstraintLayout.LayoutParams {
    ...
}
```

依照原始碼的風格，屬於物件本身的LayoutParams都屬於靜態內部類，且名稱都不會有前綴詞，使用時必須連同外部類的名稱一起寫出。

* **覆寫`generateLayoutParams()`**

```java
@Override
public LayoutParams generateLayoutParams(AttributeSet attrs) {
    return new LayoutParams(getContext(), attrs);
}
```

* **覆寫`generateDefaultLayoutParams()`**

```java
@Override
protected LayoutParams generateDefaultLayoutParams() {
    return new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
}
```

如此就可以將自訂的參數設定給子View，並使用自訂的LayoutParams讓我們有機會將設定套用在子VIew上：

```Java
public static class LayoutParams extends ConstraintLayout.LayoutParams {
    private boolean styleAttr;
    public LayoutParams(Context c, AttributeSet attrs) {
        super(context, attrs);
        TypedArray a = context.obtainStyledAttributes(attrs, R.styleable.styleName, defStyle, 0);
        try {
            boolean styleAttr = a.getBoolean(R.styleable.StyleName_styleAttr, false);
        } finally {
            a.recycle();
        }
    }
}
```

#### What's more

在子View被設定好LayoutParams後，如果是要用其中設定於外層多做些處理，可以覆寫`addView()`：

```java
@Override
public void addView(View child, int index, ViewGroup.LayoutParams params) {
    super.addView(child, index, params);
    boolean styleAttr = params.getStyleAttr();
}

@Override
public void addView(View child, ViewGroup.LayoutParams params) {
    super.addView(child, params);
    boolean styleAttr = params.getStyleAttr();
}
```

如果使用沒有傳入LayoutParams的`addView()`，則取到的LayoutParams就會是預設值，是透過`generateDefaultLayoutParams()`產生的。

### 如何取得View的大小、畫面位置與範圍

當要做的效果，需要知道View的最終大小、範圍，以及位置時，一般來說可以主動呼叫`measure()`強迫其計算，但這是一次性的。如果要得到確定的數值，其間可能會經歷多次運算。

因此，既然都已經自訂物件，比較可靠的取得方式，就是覆寫繪製流程中會用到的callback：

* **onMeasure()**
* **onLayout()**

這裡選擇不覆寫`onMeasure()`，因為`onLayout()`會取得繪製位置的座標，則可以反推出其大小數值：

```Java
@Override
protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
    super.onLayout(changed, left, top, right, bottom);
    int height = bottom - top;
    int weight = right - left;
}
```

* **跟Canvas繪圖相關的程式碼，如Path，也可以在此一併處理，就可以在每次重新計算時更新。**

綜合以上所提的三個要點，相信已經足夠用來解決大部分需要自訂物件，來繪製特殊畫面的情境。

### What's more

#### Duplicate attribute

如果有很多不同的自訂元件，就有可能需要的自訂參數會重複：

```Xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <declare-styleable name="StyleName1">
        <attr name="styleAttr" format="boolean" />
    </declare-styleable>
    <declare-styleable name="StyleName2">
        <attr name="styleAttr" format="boolean" />
    </declare-styleable>
</resources>
```

編譯時就會出現以下錯誤：

```
Error: Found item Attr/customAttr more than one time
```

直覺就是不定義而是直接引入重複的參數：

```Xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <declare-styleable name="StyleName1">
        <attr name="styleAttr" format="boolean" />
    </declare-styleable>
    <declare-styleable name="StyleName2">
        <attr name="styleAttr" />
    </declare-styleable>
</resources>
```

不過這樣如果設定一多就會不好整理，所以可以改變定義參數方式：

```Xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <declare-styleable name="GeneralAttrs">
        <attr name="styleAttr" format="boolean" />
    </declare-styleable>
    <declare-styleable name="StyleName1">
        <attr name="styleAttr" />
    </declare-styleable>
    <declare-styleable name="StyleName2">
        <attr name="styleAttr" />
    </declare-styleable>
</resources>
```

