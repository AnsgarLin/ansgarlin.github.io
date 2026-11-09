---
title: "Start Playing With Android KTX"
updated: "2019-04-04"
---

[Android KTX](androidx.core:core-ktx)是一個官方支援的Library，用來簡化Kotlin所寫的Android程式碼。相關程式範例也可以在[Sunflower](https://github.com/googlesamples/android-sunflower)專案找到，裡面整合Android新的Library家族，[Jackpack](https://developer.android.com/jetpack/)。

KTX有個主要重點：簡化繁瑣的操作，所以簡化的會集中在一段程式碼頭尾都會做的初始化和還原。

### Install 

```groovy
// In build.gradle
dependencies {
	implementation 'androidx.core:core-ktx:1.0.0'
}
```

以下直接依照列出Kotlin和KTX的對照。

### core-ktx

#### SharePreference

```java
// Kotlin
sharedPreferences.edit()
    .putBoolean("key", value)
    .apply()
// KTX
sharedPreferences.edit {
    putBoolean("key", value)
}
```

#### View

```java
// Kotlin
view.viewTreeObserver.addOnPreDrawListener(
    object : ViewTreeObserver.OnPreDrawListener {
        override fun onPreDraw(): Boolean {
            viewTreeObserver.removeOnPreDrawListener(this)
            actionToBeTriggered()
            return true
        }
    }
)
// KTX
view.doOnPreDraw {
     actionToBeTriggered()
}
```

#### Animation

```java
// In Kotlin
animatorInstance.addListener(object: Animator.AnimatorListener{
    override fun onAnimationRepeat(animator: Animator?) {}
    override fun onAnimationEnd(animator: Animator?) {}
    override fun onAnimationCancel(animator: Animator?) {}
    override fun onAnimationStart(animator: Animator?) {}
})
// In KTX
animator.addListener(
    onEnd = {}, onStart = {}, onCancel = {}, onRepeat = {}
)
// Or
animatorInstance.doOnEnd {}
```

#### Toast

```java
// Kotlin
Toast.makeText(this, R.string.text, Toast.LENGTH_SHORT).show()
// KTX
context.toast(R.string.text)
```

#### Spannalbe

```java
// Kotlin
val s = SpannableStringBuilder("Hello, Spans!")
s.setSpan(StyleSpan(Typeface.BOLD), 0, s.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
s.setSpan(ForegroundColorSpan(Typeface.BOLD), 7, 12, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
// KTX
val s = "Hello, Spans!".toSpannable()
s += StyleSpan(Typeface.BOLD)
s[7..12] ForegroundColorSpan(Color.RED)
```

#### Menu item

```java
// Kotlin
for (i in 0..menu.size()) {
    var menuItem = menu.getItem(i)
}
// KTX
menu.forEach {
    // Do action
}
```

```java
// Kotlin
val menuItemToDel
for (i in 0..menu.size()) {
    var menuItem = menu.getItem(i)
    if (menuItem == menuItemToDel) {
    	menu.removeItem(i)
    }
}
// KTX
if (menuItemToDel in menu) {
	menu -= menuItemToDel
}
```

#### Uri

```java
// In Kotlin
val uri = Uri.parse(myUriString)
// KTX
val uri = myUriString.toUri()
```

#### Canvas

```java
// In Kotlin
val pathDifference = Path(myPath1).apply {
   op(myPath2, Path.Op.DIFFERENCE)
}

val myPaint = Paint()

canvas.apply {
   val checkpoint = save()
   translate(0F, 100F)
   drawPath(pathDifference, myPaint)
   restoreToCount(checkpoint)
}
// KTX
val pathDifference = myPath1 - myPath2

canvas.withTranslation(y = 100F) {
   drawPath(pathDifference, myPaint)
}
```

#### Calendar

```java
// In Kotlin
Month.APRIL.ordinal
// KTX
Month.APRIL.asInt()
```

```java
// In Kotlin
val nano = Duration.ofSeconds(1).nano
val seconds = Duration.ofSeconds(1).seconds
// KTX
val (seconds, nanoseconds) = Duration.ofSeconds(1)
```

```java
// Kotlin
var duration = Duration.ofSeconds(1).seconds
duration /= 2
// KTX
val result = Duration.ofSeconds(2) / 2
```

Instant、LocalDate、OffsetDateTime、Period、ZonedDateTime之類時間相關的類別都可以有這種類似的方式。反過來也可以從數值轉換回時間類別：

```Java
someLong.asEpochMillis() // returns Instant instance
someLong.asEpochSeconds() // returns Instant instance
someLong.hours() // returns Duration instance
someLong.millis() // returns Duration instance
someLong.minutes() // returns Duration instance
someLong.nanos() // returns Duration instance
someLong.seconds() // returns Duration instance
```

### fragment-ktx

```java
// Kotlin
supportFragmentManager
    .beginTransaction()
    .replace(R.id.my_fragment_container, myFragment, FRAGMENT_TAG)
    .commitAllowingStateLoss()
// KTX
supportFragmentManager.transaction(allowStateLoss = true) {
    replace(R.id.my_fragment_container, myFragment, FRAGMENT_TAG)
}
```

### sqlite-ktx

```java
// Kotlin
db.beginTransaction()
try {
    // insert data
    db.setTransactionSuccessful()
} finally {
    db.endTransaction()
}
// KTX
db.transaction {
    // insert data
}
```

### Reference

https://medium.com/exploring-android/exploring-ktx-for-android-13a369795b51