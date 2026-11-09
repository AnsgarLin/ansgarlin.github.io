---
title: "Bytecode of Lambda"
date: "2018-10-11"
---

在《How Does Android Support Java 8》中，提到Android目前還沒支援Java8，所以目前在Android中寫的Lambda其實會在編譯時desugar，來將Lambda實作回覆Anonymous inner class (AIC)的作法。

不過，仍然會好奇Java8是如何實作Lambda。Java7時有一個新引入指令碼：**invokedynamic**，Java8就是用其來完成bytecode的Lambda實作。

在介紹invodedynamic前，需要先大概講述一下相關的指令。

### Invoke instructions

以下是一個簡單的範例，囊括所有舊的invoke instructions：

```java
public class Sample extends ArrayList implements Iterable {
    ...
    private static void sMethod(int i) {}
    private void method(int i) {}
    public Sample() {
        sMethod(0);
        get(0);
        method(0);
        ((Iterable) this).iterator();
    }
}
```

以下則是相關的bytecode，省略Constant pool和其他不重要的部分：

```pseudocode
Classfile .../Sample.class
...
{
	...
    public com.example.Sample();
        ...
        Code:
          stack=1, locals=1, args_size=1
             0: aload_0
             1: invokespecial #1                // Method java/util/ArrayList."<init>":()V
             4: iconst_0
             5: invokestatic  #2                // Method sMethod:(I)V
             8: aload_0
             9: iconst_0
            10: invokevirtual #3                // Method get:(I)Ljava/lang/Object;
            13: pop
            14: aload_0
            15: iconst_0
            16: invokespecial #4                // Method method:(I)V
            19: aload_0
            20: invokeinterface #5,  1          // InterfaceMethod java/lang/Iterable.iterator:()Ljava/util/Iterator;
             ...
}
```

在開始說明之前，先提一下如何看註解的部分，以第一個invokespecial為例：

```
// Method java/util/ArrayList."<init>":()V
```

這一段用於描述當前的invoke instruction要執行的函示，分成三個部分：

* **Class name**：java/lang/Object。
* **Method name**："<init>"。
* **Description**：()V，()內代表傳入的參數，而V是回傳類型，整合起來表示是一個不帶參數且回傳Void的函示。更詳細的符號含義，可以參考官方在解釋Class檔案格式的[文件](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html)。

大致了解後，各個invoke instruction的簡介如下：

* **invokestatic**

```pseudocode
invokestatic  #2 // Method sMethod:(I)V
```

用於static函示呼叫，特點是在編譯時期就決定好執行的函示，以及使用的類別，可說是所見即所得的指令。

* **incokevirtual**

```pseudocode
invokevirtual #3 // Method get:(I)Ljava/lang/Object;
```

用於一般類別可繼承的函示呼叫，特點是在執行期間，才會決定要使用父類或是當前類別，來呼叫對應的函示。

* **invokespecial**：

```pseudocode
invokespecial #3 // Method method:(I)V
```

用於constructor、private和super函示呼叫，特點是在這些情況下，使用的是哪個類別的函示都是已知的，所以也可以當成是invokevirtual的特例。

* **invokeinterface**

```pseudocode
invokeinterface #5,  1 // InterfaceMethod java/lang/Iterable.iterator:()Ljava/util/Iterator;
```

用於interface函示呼叫。特點是執行時是透過interface，而不是一般類別。

可以觀察到這四個指令在使用時，都會明確指定使用的函示，輸入的參數及回傳的類型。即使是彈性最大的invokevirtual。

雖然這四種指令的組合，可以處理如Java此類強型別的語言，但遇到動態語言時，將顯得左右支絀。不過JVM為了	支援動態，還是有其折衷的做法，以Groovy舉例如下：

```groovy
class DynamicSample {
    def static add(x, y) { x + y }
    def static void main(String[] args) {
        add(2, 3)
        add("2", "3")
    }
}
```

編譯後的class檔：

```Java
public class DynamicSample implements GroovyObject {
    public DynamicSample() {
        CallSite[] var1 = $getCallSiteArray();
        super();
        MetaClass var2 = this.$getStaticMetaClass();
        this.metaClass = var2;
    }

    public static Object add(Object x, Object y) {
        CallSite[] var2 = $getCallSiteArray();
        return var2[0].call(x, y);
    }

    public static void main(String... args) {
        CallSite[] var1 = $getCallSiteArray();
        var1[1].callStatic(DynamicSample.class, 2, 3);
        var1[2].callStatic(DynamicSample.class, "2", "3");
    }
}
```

執行過程如下：

* 透過`$getCallSiteArray`函示取得CallSiteArray。

  CallSiteArray內含三個CallSite，名稱分別是plus、add、add。由於此時的CallSite是AbstractCallSite，於是還沒指向任何實際操作的部分。而有plus是因為Groovy會把`+`的操作以plus函示執行。

* 透過取得的AbstractCallSite執行`callStatic`。

  `callStatic`會在DynamicSample內找尋可以接受兩個int或String的函示並執行，於是呼叫到`add`。

* `add`內再透過`call`執行實際的相加操作。

簡單來說就是，編譯器直接在編譯時加入動態呼叫函示的邏輯。

可以感覺到加入的內容會因為程式本身，而有不同變化，複雜度相對提高，所以如果要簡化一些重複性的操作，就是在bytecode層面需要做些調整。

### Invokedynamic

接著，我們在編譯時加上`--indy`，來看如果使用invokedynamic，編譯後的內容會變成如何：

```Java
public class DynamicSample implements GroovyObject {
    public DynamicSample() {
        MetaClass var1 = this.$getStaticMetaClass();
        this.metaClass = var1;
    }

    public static Object add(Object x, Object y) {
        return ((Class)x).invoke<invokedynamic>(x, y);
    }

    public static void main(String... args) {
        DynamicSample.class.invoke<invokedynamic>(DynamicSample.class, 2, 3);
        DynamicSample.class.invoke<invokedynamic>(DynamicSample.class, "2", "3");
    }
}
```

可以看到原本編譯時會加入的`$getCallSiteArray`，僅剩下`$getStaticMetaClass`。而原本在`main()`裡的操作也變得很單一。

由於`add`用了新的指令invokedynamic，以下直接與原本的bytecode對照，來看有什麼變化：

```bash
// Before invokedynamic
public static java.lang.Object add(java.lang.Object, java.lang.Object);
    descriptor: (Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      # ============================
      // Without invokedynamic
      stack=3, locals=3, args_size=2
         0: invokestatic  #19               // Method $getCallSiteArray:()[Lorg/codehaus/groovy/runtime/callsite/CallSite;
         3: astore_2
         4: aload_2
         5: ldc           #32               // int 0
         7: aaload
         8: aload_0
         9: aload_1
        10: invokeinterface #37,  3         // InterfaceMethod org/codehaus/groovy/runtime/callsite/CallSite.call:(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
      # ============================
      # With invokedynamic
      stack=2, locals=2, args_size=2
         0: aload_0
         1: aload_1
         2: invokedynamic #40,  0           // InvokeDynamic #0:invoke:(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
      # ============================
        15: areturn
        16: nop
        17: athrow
```

快速對照後，原本需要透過invokestatic和invokeinterfac才可完成的操作，縮減為只有invokedynamic。與此相對，BootstrapMethod被加入：

```bash
BootstrapMethods:
  0: #37 invokestatic org/codehaus/groovy/vmplugin/v7/IndyInterface.bootstrap:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;I)Ljava/lang/invoke/CallSite;
    Method arguments:
      #29 plus
      #30 0
  1: #37 invokestatic org/codehaus/groovy/vmplugin/v7/IndyInterface.bootstrap:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;I)Ljava/lang/invoke/CallSite;
    Method arguments:
      #48 add
      #30 0
```

忽略掉`IndyInterface.bootstrap`的輸入參數，直接看回傳值就是上面曾經提過的CallSite。

所以新的實現邏輯和原本是類似的：在執行階段走到invokedynamic時，會呼叫BootstrapMethods的操作來取得CallSite，裡面包含要指定的函示然後執行。

與原本做法的主要差異在於：

- **編譯時期由編譯器產生的函示減少。**
- **編譯後所需要的指令減少。**
- **將操作介面統一標準化，降低bytecode的複雜度。**

透過invokedynamic，簡化了動態語言在JVM上的實現，但invokedynamic是如何促成Java可使用Lambda取代傳統callback的實作？以下先從原本的callback實作開始講起。

### Anonymous Inner Class (AIC)

首先範例程式如下：

```Java
public class CallbackSample {
    public CallbackSample() {
        Runnable runnable = new Runnable() {
            @Override public void run() {}
        };
    }
}
```

非常簡單的Runnable，直接來看看bytecode是如何實作：

```Java
...
{
  public com.example.CallbackSample();
    descriptor: ()V
    flags: ACC_PUBLIC
    Code:
      stack=3, locals=2, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: new           #2                  // class com/example/CallbackSample$1
         7: dup
         8: aload_0
         9: invokespecial #3                  // Method com/example/CallbackSample$1."<init>":(Lcom/example/CallbackSample;)V
        12: astore_1
        13: return
        ...
}
SourceFile: "Blur.java"
InnerClasses:
     #2; //class com/example/CallbackSample$1
```

我們看到了一個特別的inner class，`CallbackSample$1`，這是編譯器在編譯時會自動產生的class檔。此class檔會對應到程式碼中的AIC，有幾個AIC，就會有幾個這樣的class產生出來。

### Lambda in Java

接著將範例改用Lambda風格：

```Java
public class LambdaSample {
    public LambdaSample() {
        Runnable runnable = () -> {};
    }
}
```

編譯成bytecode則是：

```Java
{
  public com.example.LambdaSample();
    descriptor: ()V
    flags: ACC_PUBLIC
    Code:
      stack=1, locals=2, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: invokedynamic #2,  0              // InvokeDynamic #0:run:()Ljava/lang/Runnable;
         9: astore_1
        10: return
        ...
  private static void lambda$new$0();
    descriptor: ()V
    flags: ACC_PRIVATE, ACC_STATIC, ACC_SYNTHETIC
    Code:
      stack=0, locals=0, args_size=0
         0: return
      LineNumberTable:
        line 29: 0
}
SourceFile: "LambdaSample.java"
InnerClasses:
     public static final #30= #29 of #33; //Lookup=class java/lang/invoke/MethodHandles$Lookup of class java/lang/invoke/MethodHandles
BootstrapMethods:
  0: #14 invokestatic java/lang/invoke/LambdaMetafactory.metafactory:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodHandle;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;
    Method arguments:
      #15 ()V
      #16 invokestatic com/example/LambdaSample.lambda$new$0:()V
      #15 ()V
```

這裡我們看到與前面Groovy類似的結構，為了實現動態函示呼叫，Java做了幾個變化：

* 新增LambdaMetafactory、CallSite和MethodHandle等新的類別。
* 將Lambda實際操作的部分包裝成一個獨立的靜態函示`lambda$new$0`。
* 新增BootstrapMethods區塊給invokedynamic使用。

整個執行的流程如下：

- invokedynamic呼叫到BootstrapMethods內的LambdaMetafactory。
- 將呼叫`lambda$new$0`的指令`invokestatic com/example/LambdaSample.lambda$new$0:()V`當成參數傳給LambdaMetafactory，此指令會被包裝成MethodHandle，可當成函示本身。
- MethodHandle會再被包裝進CallSite回傳。

#### Generate class on fly

到這可能會有個疑問，之前編譯AIC會產生的class檔去哪了？在執行時期，`LambdaMetafactory.metafactory`會同時產生一個如同AIC做法的inner class，樣子大概如下：

```Java
final class LambdaSample$$Lambda$1 implements Runnable {
    private LambdaSample$$Lambda$1() {}

    // 如果有參數時才會產生
    // private static Runnable get$Lambda(String[] var) {
    //    return new LambdaSample$$Lambda$1(var);
    //}

    @Hidden
    public void run() {
        LambdaSample.lambda$main$0();
    }
}
```

所以前面流程，在進入`LambdaMetafactory.metafactory`後，應該改成如下：

* 產生動態類別`LambdaSample$$Lambda$1`。
* 將呼叫Constructor或`get$Lambda()`的操作包裝成MethodHandle。
* 將此MathodHandle放進CallSite回傳。

接著就可以透過CallSite，執行MethodHandle取得`LambdaSample$$Lambda$1`的物件，並指定給範例中的變數`runnable`。這樣執行`run`時，就可以呼叫到編譯器替我們產生的靜態函示`lambda$main$0()`，執行我們原本設計好的操作。想更詳細了解這個過程，可以直接看LambdaMetafactory的[原始碼](https://github.com/frohoff/jdk8u-dev-jdk/blob/master/src/share/classes/java/lang/invoke/LambdaMetafactory.java#L291)。

另外，可能會令人好奇的是，為何在執行期間才建立class？實際上就算建在檔案中，也可以透過CallSite來使用。原因主要可能有以下兩個：

- **在執行期間產生的類別不用依賴實際的class檔，其signature也存在於constant pool，降低記憶體空間。且非檔案就沒有讀檔到建立物件的過程，在效能上也會有提升。**
- **轉移到執行期間，可降低bytecode與JVM之間的相依性，當JVM日後能直接支援動態函示時，將可無痛的棄用invokedynamic**。

### What's more

在開頭提到Android藉由desugar，把Lambda以傳統的callback實作代替，所以在編譯時期會自動建立對應的class。以Android來說，就是如下一般的Lambda類別：

```Bash
-$$Lambda$Blur$vkhPi2gkU05Je_-6VHMwbOrEmug;
```

產生類別本身不是大問題，問題是如果Lambda內的實作都一樣，在編譯後依然是產生不一樣的類別；如果開發者大量使用Lambda，將可能造成多餘的類別產生。

為了解決此問題，Jack Wharton在2017年的[Driodcon UK](https://jakewharton.com/sinking-your-teeth-into-bytecode/)有提到，Android新的編譯工具D8中，會將後面那串亂碼，以Lambda實作內容，透過SHA1 Base64的方式產生，並由此來避免重複的Lambda實作。

### Reference

* [jλvλ-8-a-comprehensive-look](https://dzone.com/articles/j%CE%BBv%CE%BB-8-a-comprehensive-look)
* [How Lambdas And Anonymous Inner Classes Work](https://dzone.com/articles/how-lambdas-and-anonymous-inner-classesaic-work)
* [Java 7: A complete invokedynamic example](https://www.javacodegeeks.com/2012/02/java-7-complete-invokedynamic-example.html)