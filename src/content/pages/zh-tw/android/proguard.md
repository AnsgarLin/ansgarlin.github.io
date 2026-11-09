---
title: "ProGuard"
updated: "2019-04-04"
---

ProGuard用於將編譯後的Java檔，也就是class檔，並進行兩件事：

* 刪除沒用到的程式碼片段，降低整個程式的大小。
* 將類別、函式和變數的名稱進行更變，以提供對於反組譯的保護。

以下介紹是以Android，並透過IDE，Android Studio為主。

如何在Android Studio上打開並設定ProGuard，可以直接參照[官方文件](https://developer.android.com/studio/build/shrink-code)，以下內容將著重在參數介紹。

### keep

這是ProGuard最重要的設定，提供分析程式碼的入口，也用於控制沒有被刪除的類別、函式和變數的名稱是否要被更名。

依照範圍和規則不同，總共有分成以下幾種基礎keep：

* **-keep**：將符合規則的類別、函式和變數，當成分析的入口，同時也可以不被刪除和更改名稱。

  ```Java
  -keep class * 
  ```

* **-keepclassmembers**：如果符合規則的類別沒有被刪除，則當成分析的入口，且符合規則的函式或和變數也可不被更改名稱。

  ```Java
  -keepclassmembers class * {
      @android.webkit.JavascriptInterface <methods>;
  }
  ```

* **-keepclasseswithmembers**：擁有符合規則的函式和變數的類別，才可以不被刪除和更改名稱。

  ```Java
  -keepclasseswithmembernames class * {
      native <methods>;
  }
  ```

所以，依照想留的目標，可以簡單歸類如下：

- 類別：`-keep`、`keepclasseswithmember`。
- 函式和變數：`-keepclassmembers`。

以上如果在後面加上`allowshrinking`，則提供可被刪除的彈性，也可以在keep後加上`names`，效果相同：

* **-keepnames**：如果符合規則的類別、函式和變數沒有被刪除，則效果同`-keep`。
* **-keepclassmembernames**：如果符合規則的類別沒有被刪除，則符合規則且沒被刪除的函示和變數，效果同`-keepclassmembers`。
* **-keepclasseswithmembernames**：如果符合規則的函示和變數都沒有被刪除，則效果同`keepclasseswithmembers`。

#### Print

用於輸出設定、分析進入點、刪除或改名的類別，可提供開發者debug設定時的參考，基本的有以下幾種：

* **-printconfiguration**：輸出ProGuard所有的設定。

跟流程有關的有以下幾種：

* **-printseeds**：輸出被當成分析進入點的類別、函式和變數。
* **-printusage**：輸出被刪除的類別、函式和變數。
* **-printmapping**：輸出被改名的類別、函式和變數，以及其被更改後的名稱。

#### Others

* **-keepattributes**：ProGuard會將執行期間沒用到的內容刪除，透過這個參數可以直接指定ProGuard不要處理的類型，所有可設定的類型可直接參照[官方文件](https://www.guardsquare.com/en/products/proguard/manual/attributes)。

  如果是開發library，常用的幾個如下：

  * Exceptions：泛指Exception相關類，編譯器需要知道library可能丟出的例外類型。

  * InnerClasses：泛指任何內部類，編譯器需要知道，內部類和外部的關係，尤其是透過映射來使用時。

  * EnclosingMethod：泛指含有local class或anonymous class的函式，編譯器需要以此來找出類別間的關係。

  * Deprecated：泛指deprecated的類別、函式和變數。

  * Signature：泛指泛形符號，如T、R等，編譯器需要這些才能正確編譯。

  以下則是在debug時會需要的：

  * SourceFile：輸出StackTrace時，保留檔案名稱。
  * LineNumberTable：輸出StackTrace時，保留行號。

* **-whyareyoukeeping**：讓ProGuard印出keep相關訊息：

  * 符合規則的類別、函式或變數有沒有在Shrink階段被刪除。
  * 如果有，除了前面提到的，還可能會出現以下幾種：
    * is invoked by：這表示是執行階段有引用。
    * is extended by：繼承也算是一種引用，如果子類有被留下。
    * is kept by a directive in the configuration。這表示是因ProGuard設定而被留下。
    * is a library method：這表示函式屬於library class pool，詳細可看"About ProGuard - Part 1"。

* **-dontpreverify**：preverify是ProGuard流程中的一步，目的為針對Java的效驗。如果是編譯Android，則可以使用此參數直接略過，可以縮減一些編譯時間。

