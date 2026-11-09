---
title: "About Proguard - Part 3"
date: "2018-07-28"
---
了解ProGuard的基本運作後，不免讓人想要理解，其背後是怎樣設計，才可以處理並分析各種不同風格的程式碼，甚至不用擔心整個流程會因為目標程式過於巨大而無法順利執行。

至少，對我來說是如此，所以餘下章節將焦點在其程式碼的流程，至於能不能在其中發現任何模式，讓我們可以借鏡來使用於日常專案，就等看完後才會知道。

要講完所有部分篇幅很多，所以Part3只是一個起頭，並且建議先閱讀Part1，才可以理解之後章節內的一些用語。

### Where to start

#### Source code

工欲善其事，必先利其器。首先必須要從[官網](https://sourceforge.net/projects/proguard/files/proguard/6.0/proguard6.0.3.zip/download)下載原始碼，以下使用的內容都基於版號6.0.3。

#### Start point

由於我們想要看的是跟Android相關的流程，所以直接看到`gradle`目錄底下的ProGuardTask。

要設計Gradle的Task，除了要繼承DefaultTask，還要在要當成進入點的函示加上`@TaskAction`；類似Java的`main()`，要開始執行Task則是呼叫`execute()`。細節可以看Gradle官網的[介紹](https://docs.gradle.org/current/userguide/custom_tasks.html)。

所以，ProGuardTask的進入點是`proguard()`：

```Java
// In ProGuardTask
@TaskAction
public void proguard() throws ParseException, IOException
{
	...
    // Run ProGuard with the collected configuration.
    new ProGuard(getConfiguration()).execute();
}
```

就如我們前面Part1提到的，ProGuard第一步是讀取ProGuard設定。

### Read Configuration

首先看到`getConfiguration()`：

```Java
// In ProGuardTask
private Configuration getConfiguration() throws IOException, ParseException
{
    ...

    // Lazily apply the external configuration files.
    ConfigurableFileCollection fileCollection =
        getProject().files(configurationFiles);

    Iterator<File> files = fileCollection.iterator();
    while (files.hasNext()) {
        ConfigurationParser parser =
            new ConfigurationParser(files.next(), System.getProperties());
        try {
            parser.parse(configuration);
        }
        ...
    }
    ...
    return configuration;
}
```

前半段省略的是將Program和Library class部分的jar檔加入`configuration`，不過在這部分不重要，直接跳過。留下來的是所有設定檔會依序透過`ConfigurationParse.parse()`來將檔案內的設定存入`configuration`中。

於是重點就是ConfigurationParser：

```Java
// In ConfigurationParser
public ConfigurationParser(File file, Properties properties) throws IOException {
    this(new FileWordReader(file), properties);
}
public ConfigurationParser(WordReader reader,
                               Properties properties) throws IOException {
    this.reader     = reader;
    this.properties = properties;
    readNextWord();
}
```

ConfigurationParser使用FileWordReader來讀檔：

```Java
// In FileWordReader
public FileWordReader(File file) throws IOException {
    super(new LineNumberReader(new BufferedReader(new FileReader(file))), ...);
}
```

在這不詳述其中功能，總之會用來逐行讀取檔案內容。

回頭再看到`readNextWord()` ：

```Java
// In ConfigurationParser
private void readNextWord() throws IOException {
    readNextWord(false, false);
}

private void readNextWord(boolean isFileName, boolean expectSingleFile) throws IOException {
    nextWord = reader.nextWord(isFileName, expectSingleFile);
}
```

所以在ConfigurationParser建立後就會馬上透過傳入的Reader來讀取檔案，這裡的FileReader沒有實作`nextWord()`，所以是使用父類WorkReader的`nextWord()`。

為了不中斷分析的過程，此函式詳述在[Appendix](#Appdendix)。簡言之，此函式目的為：**逐行讀取設定內容回傳，並以空白、括號、逗號或冒號做分隔。**於是，目前的`nextWord`是`-keep`。

到此，ConfigurationParser已經順利產生出來，接著呼叫`parse()`，並將`configuration`傳入來承接結果。為了接下來解說有個依據，這邊用常見的keep規則作為範例：

```Java
-keep class * extend com.example.classname { *; }
```

這邊列出`parse()`內範例會用到的部分，不過其他部分是大同小異：

```Java
// In ConfigurationConstants
public static final String KEEP_OPTION = "-keep";

// In ConfigurationParser
public void parse(Configuration configuration) throws ParseException, IOException {
    while (nextWord != null) {
    	...
    	if (ConfigurationConstants.KEEP_OPTION.startsWith(nextWord)) 
    		configuration.keep = parseKeepClassSpecificationArguments(configuration.keep, 
                                    							true, false, false, null);
		...
	}
}
```

由於此時`nextWord`是`-keep`，所以進入迴圈後會走到`KEEP_OPTION`所在的片段，這裡會用到`configuration.keep`，負責存放需要被keep的類別、函示和變數：

```Java
// In Configuration
/**
 * A list of {@link KeepClassSpecification} instances, whose class names and
 * class member names are to be kept from shrinking, optimization, and/or
 * obfuscation.
 */
public List      keep;
```

在這直接假設`configuration.keep`不是null，再看到`parseKeepClassSpecificationArguments()`：

```Java
// In ConfigurationParser
private List parseKeepClassSpecificationArguments(List keepClassSpecifications,
                                                  boolean markClasses,
                                                  boolean markConditionally,
                                                  boolean allowShrinking,
                                                  ClassSpecification condition)
                                                  throws ParseException, IOException {
    // Read and add the keep configuration.
    keepClassSpecifications.add(parseKeepClassSpecificationArguments(markClasses,
                                                                     markConditionally,
                                                                     allowShrinking,
                                                                     condition));
    return keepClassSpecifications;
}
```

根據前面的輸入，先記下只有`markClasses`是true，其他不是false就是null。這邊再往下呼叫到同名的另一個`parseKeepClassSpecificationArguments()`：

```Java
// In ConfigurationConstants
public static final String ARGUMENT_SEPARATOR_KEYWORD = ",";

// In ConfigurationParser
private KeepClassSpecification parseKeepClassSpecificationArguments(
	boolean markClasses, boolean markConditionally, boolean allowShrinking,
    ClassSpecification condition) throws ParseException, IOException {
    
    boolean markDescriptorClasses = false;
    boolean markCodeAttributes    = false;
    boolean allowOptimization     = false;
    boolean allowObfuscation      = false;
    
    // Read the keep modifiers.
    while (true) {
        readNextWord(...);

        if (!ConfigurationConstants.ARGUMENT_SEPARATOR_KEYWORD.equals(nextWord)) {
            // Not a comma. Stop parsing the keep modifiers.
            break;
        }
        ...
    }

    // Read the class configuration.
    ClassSpecification classSpecification = parseClassSpecificationArguments();

    // Create and return the keep configuration.
    return new KeepClassSpecification(markClasses, ..., classSpecification);
}
```

此函示一開始會先判斷是否有修飾keep的設定，如`allowshrinking`此類，有就會更改函示開頭的變數值。

不過根據範例，這邊的`readNextWord()`得到字串會是`class`，因此下一個判斷時會直接break跳出迴圈，進到讀取類別的部分：`parseClassSpecificationArguments()`，此函式在此次範例會執行到的地方比較多，以下將分段說明：

```Java
// In ConfigurationParser
public ClassSpecification parseClassSpecificationArguments() throws ParseException, IOException {
    ...
    // Parse the class annotations and access modifiers until the class keyword.
    while (!ConfigurationConstants.CLASS_KEYWORD.equals(nextWord))
    {
        ...
    }
   // Parse the class name part.
    String externalClassName =       
        ListUtil.commaSeparatedString(parseCommaSeparatedList(...);
```

現在的`nextWord`值是`class`，就直接跳過while迴圈走到`parseCommaSeparatedList`。

此函示一樣較為複雜，詳細可參考[Appendix](#Appdendix)。簡言之，此函示目的是：

* **將一串以逗號為分隔的字串重組成一個List，直到沒有看到逗號為止，並在回傳前讀取下一個字**。

取得List後，呼叫`commaSeparatedString`將List重組回字串，這樣一來一往可以去掉字串間不必要的字元，如註解之類。

```Java
    // For backward compatibility, allow a single "*" wildcard to match any
    // class.
    String className = ConfigurationConstants.ANY_CLASS_KEYWORD.equals(externalClassName)?
        null : ClassUtil.internalClassName(externalClassName);
```

搭配範例，`parseCommaSeparatedList()`能取到的只有星號，因此`className`設為null，而`nextWord`是星號的下一個字`extend`。

```Java
    // Clear the annotation type and the class name of the extends part.
    String extendsAnnotationType = null;
    String extendsClassName      = null;

    if (!configurationEnd())
    {
        // Parse 'implements ...' or 'extends ...' part, if any.
        if (ConfigurationConstants.IMPLEMENTS_KEYWORD.equals(nextWord) ||
            ConfigurationConstants.EXTENDS_KEYWORD.equals(nextWord))
        {
            readNextWord("class name or interface name", ...);
            ...
            String externalExtendsClassName = 
                ListUtil.commaSeparatedString(
                	parseCommaSeparatedList("class name or interface name", ...));

            extendsClassName = ConfigurationConstants.ANY_CLASS_KEYWORD.equals(externalExtendsClassName) ?
                null :
                ClassUtil.internalClassName(externalExtendsClassName);
        }
    }
```

`nextWord`是`extend`，所以`configurationEnd()`是false。再次呼叫`readNextWord()`來得到範例下一段字串：`com.example.classname`。

接著如前面一樣使用`parseCommaSeparatedList`取出逗號分隔的字串，不過只會得到相同的結果。所以此時的`externalExtendsClassName`是`com.example.classname`、`nextWord`是`{`。

最後，透過`ClassUtil.internalClassName()`將分隔類別名稱的`.`換成`/`：

```Java
// In ClassUtil
public static String internalClassName(String externalClassName) {
    return externalClassName.replace(JavaConstants.PACKAGE_SEPARATOR,
                                     ClassConstants.PACKAGE_SEPARATOR);
}
```

到這就算是取得完整的類別名稱，接著就是建立一個ClassSpecification。ClassSpecification是一個存放Class資訊的model，記錄包含類別名稱以外，還有函示、變數等類別相關的資訊：

```Java
// Create the basic class specification.
ClassSpecification classSpecification = new ClassSpecification(lastComments,
															requiredSetClassAccessFlags,
								                            requiredUnsetClassAccessFlags,
                           	                            	annotationType,
                           	                            	className,
                           	                            	extendsAnnotationType,
                           	                            	extendsClassName);
```

回到`parseClassSpecificationArguments()`，接著還有：

```Java
    // Now add any class members to this class specification.
    if (!configurationEnd()) {
        // Check the class member opening part.
        if (!ConfigurationConstants.OPEN_KEYWORD.equals(nextWord)) {
            throw new ParseException("Expecting opening '" +
                                     ConfigurationConstants.OPEN_KEYWORD +
                                         "' at " + reader.locationDescription());
        }
```

最後的最後，`configurationEnd()`依然是false，而`nextWord`為`{`，等於`OPEN_KEYWORD`所以直接往下到while迴圈。

```Java

        // Parse all class members.
        while (true) {
            readNextWord("class member description or closing '}'", ...);

            if (nextWord.equals(ConfigurationConstants.CLOSE_KEYWORD)) {
                // The closing brace. Stop parsing the class members.
                readNextWord();
                break;
            }

            parseMemberSpecificationArguments(externalClassName,
                                              classSpecification);
        }
    }

    return classSpecification;
}
```

迴圈內的`readNextWord()`會取到星號，並透過`parseMemberSpecificationArguments()`繼續分析，再將結果塞回去`classSpecification`。

在讀到`}`，也就是`CLOSE_KEYWORD`，則執行最後一次`readNextWord()`，此時`nextWord`會因為讀到行底而為null，退出迴圈，完成一條keep規則的解析。

這邊產生的`classSpecification`，會回傳到`parseKeepClassSpecificationArguments()`。並加入List，`keepClassSpecifications`，也就是外部傳入的`configuration.keep`。

再往回傳就回到`parse`準備進入下一個迴圈，此時`nextWord`是null，導致迴圈終止，並從`parse()`退出，完成了整個檔案的設定分析。

### Appendix

此部分用於介紹內容較多的函示，避免前面的分析內容過於零散。為了與前面分析做連結，會使用到前面的範例。

#### readNextWord() 

由於這method包含很多操作，於是這邊省略掉前面解析不會使用到的部分，或是留下註解節省篇幅：

```java
// In WordReader
public String nextWord(boolean isFileName, boolean expectSingleFile) throws IOException
{
    currentWord = null;
    ...
    // Get a word from this reader.
	
	// 1 ==============================
    // Skip any whitespace and comments left on the current line.
    if (currentLine != null)
    {
        // Skip any leading whitespace.
        ...
        currentIndex++;
        ...
        // Skip any comments.
        ...
    }

	// 2 ==============================
    // Make sure we have a non-blank line.
    while (currentLine == null || currentIndex == currentLineLength)
    {
        currentLine = nextLine();
        if (currentLine == null) {
            return null;
        }

        currentLineLength = currentLine.length();

        // Skip any leading whitespace.
        currentIndex = 0;
        ...
        // Skip the comments.
        ...
    }

	// 3 ==============================
    // Find the word starting at the current index.
    int startIndex = currentIndex;
    int endIndex;

    char startChar = currentLine.charAt(startIndex);
    if (isQuote(startChar)) {
        ...
    } else if (isFileName && !isOption(startChar)) {
    	...
    } else if (isDelimiter(startChar)) {
    	...
    } else {
        // The next word is a simple character string.
        // Find the end of the line, the first delimiter, or the first
        // white space.
        while (currentIndex < currentLineLength)
        {
            char currentCharacter = currentLine.charAt(currentIndex);
            if (isNonStartDelimiter(currentCharacter)    ||
            	Character.isWhitespace(currentCharacter) ||   
            	isComment(currentCharacter)) {
                	break;
                }
            currentIndex++;
        }
        endIndex = currentIndex;
    }

    // Remember and return the parsed word.
    currentWord = currentLine.substring(startIndex, endIndex);

    return currentWord;
}
```

此函示的運作方式，有分成**初次呼叫**、**再次呼叫**、**檔案終止**三種階段。

##### 初次呼叫

首先一開始`currentLine`會是空的，所以會直接跳到第二段，透過`nextLine()`來取得第一行內容。

這邊`nextLine()`就是由不同的Reader來實作，在這直接看到FileWordReader。不過FileWordReader其實是繼承LineNumberReader，就是讀取檔案內的一行不包含換行的字串。

回頭`nextWord`，取得字串後先將長度暫存，這是用來判斷是否此行已經分析完畢的終止條件。接著就是找尋設定內容的起點位置，所以要跳過空白和註解。

找到後直接取出第一個字詞，然後進入第三部分的一整串判斷。一般來說都會進入最後的`else`，然後一路讀取到出現空白為止或是井字號，來當作結束位置。

透過起始和結束位置，就可以從目前的一行字串內，取出部分的字串。

##### 再次呼叫

由於Reader會在整個分析過程中一直存在，所以前面有設值的`currentLine`、`currentLineLength`和最後得到的`currentWord`並不會被刪除；下一次再進入此函式時，就會進入第一部分，一樣先跳過空白和註解，找到下一個設定內容的起點，然後進入第三部分得到下一個片段。

##### 檔案終止

`currentIndex`如果在第一部分已經被遞增到與`currentLineLength`相同，就代表此行已經處理完畢。就進入第二部分，先讀取下一行至`currentLine`，這是一個重置動作，以免之後的呼叫都在終止狀態循環。然後直接回傳null，給外部呼叫知道目前已到行末。

總結來說，此函示作用是：

* **逐行讀取設定內容回傳，並以空白、括號、逗號或冒號做分隔。**

#### parseCommaSeparatedList()

和`readNexrWord()`一樣，這邊僅留下前面分析會使用到的部分：

```Java
// In ConfigurationParser
/**
  * Reads a comma-separated list of java identifiers or of file names.
  * Examples of invocation arguments:
  *
  *   expected          read   allow  expect  is     check  allow   replace replac
  *   description       First  empty  Closing File   Java   Generic System  Extern  
  *                     Word   List   Paren   Name   Id             Prop    Class  
  *   ---------------------------------------------------------------------------------
  *   ...
  *   ("class name ",   true,  false, false,  false, true,  false,  false,  false, ...)
  *   ...
  */
private List parseCommaSeparatedList(String  expectedDescription,
                                     boolean readFirstWord,
                                     boolean allowEmptyList,
                                     boolean expectClosingParenthesis,
                                     boolean isFileName,
                                     boolean checkJavaIdentifiers,
                                     boolean allowGenerics,
                                     boolean replaceSystemProperties,
                                     boolean replaceExternalClassNames,
                                     boolean replaceExternalTypes,
                                     List    list) throws ParseException, IOException {
```

此函式為通用函式，專門用來將以逗號為分隔的字串，重組成一個List。在本篇範例是用來取得類別名稱。

```Java                              
    if (list == null) {
        list = new ArrayList();
    }

    if (readFirstWord) {
    	...
    	// Read the first list entry.
        readNextWord(expectedDescription, ...);
        ...
    }
```

此函式一開始先用`readNextWord()`，以本文的範例來看，前面分析走到這函示時，取到的`nextWord`是星號。

```Java
    while (true) {
        if (checkJavaIdentifiers) {
            checkJavaIdentifier("java type", allowGenerics);
        }
        ...
        list.add(nextWord);
        ...
        else {
            // Read a comma (or a different word).
            readNextWord();
        }
```

不論取到的是什麼，接著會被加入List，然後再次使用`readNextWord()`讀入下一個字串，以範例來說就是`extend`。

```Java
        if (!ConfigurationConstants.ARGUMENT_SEPARATOR_KEYWORD.equals(nextWord)) {
            return list;
        }

        // Read the next list entry.
        readNextWord(expectedDescription, ...);
    }
}
```

由於`nextWord`是`extend`，並不是逗號，所以直接回傳帶有星號的List。如果是逗號，則會再取出下一個字串，進入下一個迴圈。

簡言之，此函式作用是：

* **將一串以逗號為分隔的字串重組成一個List，直到沒有看到逗號為止，並在回傳前讀取下一個字。**