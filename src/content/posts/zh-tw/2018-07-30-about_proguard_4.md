---
title: "About ProGuard - Part 4"
date: "2018-07-30"
---
Part3我們提到如何讀取ProGuard設定，接著讓我們再回頭看到ProGuardTask的進入點：

```Java
// In ProGuardTask
@TaskAction
public void proguard() throws ParseException, IOException {
	...
    // Run ProGuard with the collected configuration.
    new ProGuard(getConfiguration()).execute();
}
```

讀取完Configuration後是呼叫`execute()`：

```Java
// In ProGuard
public void execute() throws IOException {
    ...
    readInput();
    ...
}
```

直接看到`readInput()`：

```Java
// In ProGuard
private void readInput() throws IOException {
    ...
    // Fill the program class pool and the library class pool.
    new InputReader(configuration).execute(programClassPool,
                                           libraryClassPool);
}
```

根據內容確定這就是我們在Part1提到的，讀取完ParGuard設定後，接著讀取要處理的程式碼，並分成**Program class pool**和**Library class pool**。

接著看到`execute()`：	

```Java
// In InputReader
public void execute(ClassPool programClassPool, ClassPool libraryClassPool) throws IOException {
    WarningPrinter warningPrinter = new WarningPrinter(System.err, configuration.warn);
    WarningPrinter notePrinter    = new WarningPrinter(System.out, configuration.note);

    DuplicateClassPrinter duplicateClassPrinter = new DuplicateClassPrinter(notePrinter);

    // Read the library class files, if any and if they should get priority.
    if (FAVOR_LIBRARY_CLASSES && configuration.libraryJars != null) {
        // Prepare a data entry reader to filter all classes,
        // which are then decoded to classes by a class reader,
        // which are then put in the class pool by a class pool filler.
        readInput("Reading library ",
                  configuration.libraryJars,
                  new ClassFilter(
                  new ClassReader(true,
                                  configuration.skipNonPublicLibraryClasses,
                                  configuration.skipNonPublicLibraryClassMembers,
                                  warningPrinter,
                  new ClassPresenceFilter(libraryClassPool, duplicateClassPrinter,
                  new ClassPoolFiller(libraryClassPool)))));
    }
```

首先看到是透過`readInput()`來讀取library，此函示詳細介紹請參考[Appendix](#appendix)，簡言之此函式負責：

* **解壓並讀取壓縮檔內的Class檔來放入class pool**。

以這邊例子就是會從`configuration.libraryJars`有列出的Jar檔路徑讀取Class檔，加入`libraryClassPool`。

```Java
    // Read the program class files.
    // Prepare a data entry reader to filter all classes,
    // which are then decoded to classes by a class reader,
    // which are then put in the class pool by a class pool filler.
    readInput("Reading program ",
              configuration.programJars,
              new ClassFilter(
              new ClassReader(false,
                              configuration.skipNonPublicLibraryClasses,
                              configuration.skipNonPublicLibraryClassMembers,
                              warningPrinter,
              new ClassPresenceFilter(programClassPool, duplicateClassPrinter,
              new ClassPresenceFilter(libraryClassPool, duplicateClassPrinter,
              new ClassPoolFiller(programClassPool))))));
```

前面是讀取library，接著就是要讀取program，與前面不同的是最後一個使用的參數ClassPresenceFilter。

在深入前，首先先將這個ClassPresenceFilter做拆解，結構如下：

```
ClassPresenceFilter {
    programClassPool,
    duplicateClassPrinter,
    ClassPresenceFilter {
        libraryClassPool
        duplicateClassPrinter,
        ClassPoolFilter {
            programClassPool
        }
    }
}
```

依照[Appendix](#Appendix)的介紹，此ClassPresenceFilter的執行步驟如下：

* 判斷讀取到的類別是否包含在第一個`programClassPool`。有則直接直接使用`duplicateClassPrinter`輸出提示訊息；沒有則進入下一個ClassPresenceFilter。
* 第二個ClassPresenceFilter則是判斷類別是否已經含在`libraryClassPool`。有則一樣輸出提示，沒有就透過ClassPoolFilter加入`programClassPool`。

簡言之，**`programClassPool`和`libraryClassPool`都沒有，就放進`programClassPool`**。

```Java
    ...
    // Read the library class files, if any.
    if (!FAVOR_LIBRARY_CLASSES && configuration.libraryJars != null) {
        // Prepare a data entry reader to filter all classes,
        // which are then decoded to classes by a class reader,
        // which are then put in the class pool by a class pool filler.
        readInput("Reading library ",
                  configuration.libraryJars,
                  new ClassFilter(
                  new ClassReader(true,
                                  configuration.skipNonPublicLibraryClasses,
                                  configuration.skipNonPublicLibraryClassMembers,
                                  warningPrinter,
                  new ClassPresenceFilter(programClassPool, duplicateClassPrinter,
                  new ClassPresenceFilter(libraryClassPool, duplicateClassPrinter,
                  new ClassPoolFiller(libraryClassPool))))));
    }
    ...
}
```

執行到這邊，透過`-injars`、`-outjars`和`-libraryjars`指定的Jar檔內的Class檔，都已經被讀取並分類至Library class pool和Program class pool。

### What's more

前面介紹可以發現，讀取library的時機可能會因`FAVOR_LIBRARY_CLASSES`，而有些改變：

```java
// In InputReader
private static final boolean FAVOR_LIBRARY_CLASSES = System.getProperty("favor.library.classes") != null;
```

透過一個指定的系統變數`favor.library.classes`，可以決定是否要在處理program前，先處理library。

處理的順序會變成以下兩種可能：

- 有`favor.library.classes`，則先library，再來program。
- 沒`favor.library.classes`，則先program，再來library。

這修正主要是由一位專門負責AOSP的Google工程師提出，詳細可直接參考[討論串](https://sourceforge.net/p/proguard/discussion/182455/thread/76430d9e/)。

### Appendix

#### readInput()

以下使用`InputReader.execute()`內的片段為範例：

```Java
// In InputReader
DuplicateClassPrinter duplicateClassPrinter = new DuplicateClassPrinter(notePrinter);

readInput("Reading library ",
          configuration.libraryJars,
          new ClassFilter(
              new ClassReader(
                  true,
                  configuration.skipNonPublicLibraryClasses,
                  configuration.skipNonPublicLibraryClassMembers,
                  warningPrinter,
                  new ClassPresenceFilter(libraryClassPool, duplicateClassPrinter,
                                          new ClassPoolFiller(libraryClassPool)))));
```

##### Get file path

這邊用到了`configuration.libraryJars`，這是ClassPath類別，Configuration用來記錄從設定檔得到的檔案路徑：

```java
// In Configuration
/**
 * A list of input and output entries (jars, wars, ears, jmods, zips, and directories).
 */
public ClassPath programJars;

/**
 * A list of library entries (jars, wars, ears, jmods, zips, and directories).
 */
public ClassPath libraryJars;
```

透過`-injars`和`-outjars`設定的路徑會放在`programJars`；`-libraryjars`在`libraryJars`。

前面的`readInput()`會走到以下這個`readInput()`：

```Java
// In InputReader
public void readInput(String messagePrefix, ClassPath classPath,
                      int fromIndex, int toIndex,
                      DataEntryReader reader) throws IOException {
    for (int index = fromIndex; index < toIndex; index++) {
        ClassPathEntry entry = classPath.get(index);
        if (!entry.isOutput()) {
            readInput(messagePrefix, entry, reader);
        }
    }
}
```

這邊會依序從ClassPath取出檔案路徑，傳入另一個`readInput()`：

```Java
// In InputReader
private void readInput(String          messagePrefix,
                       ClassPathEntry  classPathEntry,
                       DataEntryReader dataEntryReader) throws IOException {
    ...
    // Create a reader that can unwrap jars, wars, ears, jmods and zips.
    DataEntryReader reader =       
        DataEntryReaderFactory.createDataEntryReader(messagePrefix, classPathEntry,
                                                     dataEntryReader);
    // Create the data entry pump.
    DirectoryPump directoryPump = new DirectoryPump(classPathEntry.getFile());
    // Pump the data entries into the reader.
    directoryPump.pumpDataEntries(reader);
    ...
}
```

##### Constructor DataEntryReader

這邊使用了`DataEntryReaderFactory.createDataEntryReader()`來將傳入的`dataEntryReader`再進行打包：

```Java
public static DataEntryReader createDataEntryReader(String          messagePrefix,
                                                    ClassPathEntry  classPathEntry,
                                                    DataEntryReader reader) {
    ...
    // Unzip any apks, if necessary.
    reader = wrapInJarReader(reader, false, false, isApk, apkFilter, ".apk");
    if (!isApk) {
        // Unzip any jars, if necessary.
        reader = wrapInJarReader(reader, false, false, isJar, jarFilter, ".jar");
        ...
    }
    return reader;
}
```

這邊僅留下比較常用到的部分，以Android專案來說，`classPathEntry`應是Jar檔的路徑。而`reader`是範例提到的ClassFilter。

先看到第一次呼叫`wrapInJarReader()`：

```Java
// In DataEntryReaderFactory
private static DataEntryReader wrapInJarReader(DataEntryReader reader,
                                               boolean         stripClassesPrefix,
                                               boolean         stripJmodHeader,
                                               boolean         isJar,
                                               List            jarFilter,
                                               String          jarExtension) {
    ...
    // Unzip any jars, if necessary.
    DataEntryReader jarReader = new JarReader(reader, stripJmodHeader);

    if (isJar) {
        // Always unzip.
        return jarReader;
    } else {
        ...
        // Only unzip the right type of jars.
        return new FilteredDataEntryReader(
            new DataEntryNameFilter(new ExtensionMatcher(jarExtension)), 
            jarReader, reader);
    }
}
```

一樣省略不會用到的部分，所以傳入的`reader`，就是ClassReader，會先包入JarReader。

`isJar`是`isApk`，所以是false進入else，JarReader會與傳入的ClassReader，連同DataEntryNameFilter一起打包進FilteredDataEntryReader並回傳。

這邊先提一下DataEntryNameFilter：

```Java
// In DataEntryNameFilter
public DataEntryNameFilter(StringMatcher stringMatcher) {
    this.stringMatcher = stringMatcher;
}
```

傳入的stringMatcher是ExtensionMatcher：

```Java
// In ExtensionMatcher
public ExtensionMatcher(String extension) {
    this.extension = extension;
}
```

根據前面的內容，`extension`是呼叫`wrapInJarReader`時傳入的`.apk`。

回到`createDataEntryReader()`，`isApk`是false，於是再次呼叫`wrapInJarReader()`。剛剛取得的FilteredDataEntryReader又會再包進JarReader，不過這次的`isJar`是true，所以直接回傳當前的JarReader。

到目前，透過`DataEntryReaderFactory.createDataEntryReader()`得到的reader結構如下：

```Java
JarReader {
    dataEntryReader = FilteredDataEntryReader {
        dataEntryFilter = DataEntryNameFilter(.apk)
        acceptedDataEntryReader = JarReader {
            dataEntryReader = ClassReader {
            }
        }
        rejectedDataEntryReader = ClassReader {
        }
    }
}
```

##### Unzip file

取得所需的DataEntryReader後，接著就是建立DirectoryPump，透過`pumpDataEntries()`開始讀取檔案

```Java
// In DirectoryPump
public void pumpDataEntries(DataEntryReader dataEntryReader) throws IOException {
    ...
    readFiles(directory, dataEntryReader);
}

private void readFiles(File file, DataEntryReader dataEntryReader) throws IOException {
    // Pass the file data entry to the reader.
    dataEntryReader.read(new FileDataEntry(directory, file));
    ...
}
```

這邊用到的首先是JarReader的`read()`：

```Java
// in JarReader
public void read(DataEntry dataEntry) throws IOException {
    ...
    ZipInputStream zipInputStream = new ZipInputStream(dataEntry.getInputStream());
    try {
        // Get all entries from the input jar.
        while (true) {
            // Can we get another entry?
            ZipEntry zipEntry = zipInputStream.getNextEntry();
            if (zipEntry == null) {
                break;
            }

            // Delegate the actual reading to the data entry reader.
            dataEntryReader.read(new ZipDataEntry(dataEntry, zipEntry, zipInputStream));
        }
    }
    ...
}
```

我們知道Jar檔是Zip壓縮檔格式，所以合理使用ZipInputStream將來取得Jar檔內容。透過`getNextEntry()`，可將Class檔依序取出，傳給`dataEntryReader.read()`：

```Java
// In FilteredDataEntryReader
public void read(DataEntry dataEntry) throws IOException {
	DataEntryReader dataEntryReader = dataEntryFilter.accepts(dataEntry) ?
        acceptedDataEntryReader :
        rejectedDataEntryReader;

    if (dataEntryReader != null) {
        dataEntryReader.read(dataEntry);
    }
}
```

透過`dataEntryFiler`，也就是DataEntryNameFilter，來呼叫`accepts`執行判斷：

```java
// In DataEntryNameFilter
public boolean accepts(DataEntry dataEntry) {
    return dataEntry != null && stringMatcher.matches(dataEntry.getName());
}
```

此函式被呼叫的時候，會使用`stringMatcher`，也就是ExtensionMatcher，來呼叫`matches`，並傳入檔案路徑。依照剛剛的過程，可知這邊傳入的路徑，結尾是`.class`：

```java
// In ExtensionMatcher
@Override
protected boolean matches(String string, int beginOffset, int endOffset) {
    return endsWithIgnoreCase(string, beginOffset, endOffset, extension);
}

private static boolean endsWithIgnoreCase(String string, int    beginOffset, 
                                          int    endOffset, String suffix) {
    int suffixLength = suffix.length();
    return string.regionMatches(true, endOffset - suffixLength, suffix, 0, suffixLength);
}
```

執行內容很單一，就是判斷檔案路徑的結尾，是否和`extension`相同。`extension`的值，就是前面第一次呼叫`wrapInJarReader`時傳入的`.apk`，所以回傳false。

回到`FilteredDataEntryReader.read()`，得到false後，代表要使用`rejectedDataEntryReader`，也就是ClassReader，來繼續往下執行。

##### Read class

```java
// In ClassReader
public void read(DataEntry dataEntry) throws IOException {
    try {
        // Get the input stream.
        InputStream inputStream = dataEntry.getInputStream();
        // Wrap it into a data input stream.
        DataInputStream dataInputStream = new DataInputStream(inputStream);
        // Create a Clazz representation.
        Clazz clazz;
        if (isLibrary) {
            clazz = new LibraryClass();
            clazz.accept(new LibraryClassReader(dataInputStream, ...));
        } else {
            clazz = new ProgramClass();
            clazz.accept(new ProgramClassReader(dataInputStream));
        }

        // Apply the visitor, if we have a real class.
        String className = clazz.getName();
        if (className != null) {
            ...
            clazz.accept(classVisitor);
        }

        dataEntry.closeInputStream();
    }
    ...
}
```

這邊的ClassReader是範例一開始呼叫`InputReader.readInput()`時傳入的，所以`isLibrary`是true，於是透過`LibraryClass.accpet()`傳入LibraryClassReader：

```Java
// In LibraryClass
public void accept(ClassVisitor classVisitor) {
    classVisitor.visitLibraryClass(this);
}
```

這是一種[Visitor Pattern](https://en.wikipedia.org/wiki/Visitor_pattern)，所以需要回頭看到LibraryClassReader的`visitLibraryClass()`：

```Java
// In LibraryClassReader
public void visitLibraryClass(LibraryClass libraryClass)
{
    ...
    // Store their actual names.
    libraryClass.thisClassName  = getClassName(u2thisClass);
    libraryClass.superClassName = (u2superClass == 0) ? null :
                                  getClassName(u2superClass);

    ...
    libraryClass.interfaceNames = new String[u2interfacesCount];
    for (int index = 0; index < u2interfacesCount; index++) {
        // Store the actual interface name.
        int u2interface = dataInput.readUnsignedShort();
        libraryClass.interfaceNames[index] = getClassName(u2interface);
    }

    ...
    // Copy the visible fields (if any) into a fields array of the right size.
    ...
    else {
        libraryClass.fields = new LibraryField[visibleFieldsCount];
        System.arraycopy(reusableFields, 0, libraryClass.fields, 0, visibleFieldsCount);
    }
    ...
    // Copy the visible methods (if any) into a methods array of the right size.
    ...
    else {
        libraryClass.methods = new LibraryMethod[visibleMethodsCount];
        System.arraycopy(reusableMethods, 0, libraryClass.methods, 0, visibleMethodsCount);
    }
}
```

LibraryClassReader透過`dataInputStream`取得Class檔內容並解析，讀取檔案的過程已經和本文無關，所以不再深入。總之解析後的結果會回存LibraryClass，而對於ProgramClass也是相同操作。

在這，依照`accept()`的使用，可以先點出一個觀念：

* **執行`clazz.accept(visitor)`，可直接看成`visitor.visitXXXClass()`。由`clazz`屬於ProgramClass或LibraryClass來決定`XXX`是什麼。**

##### Put into pool

回到`ClassReader.read()`，如果LibraryClassReader的部分有順利完成，則`getName()`不會是null，於是會再呼叫一次`accept`，傳入classVisitor，也就是前面範例提到的ClassPresenceFilter：

```Java
// In ClassPresenceFilter
public ClassPresenceFilter(ClassPool    classPool, ClassVisitor presentClassVisitor,
                           ClassVisitor missingClassVisitor) {
    this.classPool           = classPool;
    this.presentClassVisitor = presentClassVisitor;
    this.missingClassVisitor = missingClassVisitor;
}
```

根據前面的內容，可知會走到`visitLibraryClass`：

```Java
// In ClassPresenceFilter
public void visitLibraryClass(LibraryClass libraryClass) {
    ClassVisitor classFileVisitor = classFileVisitor(libraryClass);

    if (classFileVisitor != null) {
        classFileVisitor.visitLibraryClass(libraryClass);
    }
}
```

首先先透過`classFileVisitor`，來找到適合的ClassVisitor來呼叫`visitLibraryClass`：

```Java
// In ClassPresenceFilter
private ClassVisitor classFileVisitor(Clazz clazz) {
    return classPool.getClass(clazz.getName()) != null ?
        presentClassVisitor :
        missingClassVisitor;
}
```

這邊就是先判斷當前取得的類別，是否已經存在於`classPool`，也就是`InputReader.execute()`被呼叫時，由ProGuard傳入的ClassPool。

有的話就呼叫`presentClassVisitor`，也是DuplicateClassPrinter，僅用來輸出提示訊息：

```Java
// In DuplicateClassPrinter
public void visitLibraryClass(LibraryClass libraryClass) {
    notePrinter.print(libraryClass.getName(), "Note: duplicate definition of library class [" + ClassUtil.externalClassName(libraryClass.getName()) + "]");
}
```

如果是`missingClassVisitor`，則是ClassPoolFiller，此類別僅有實作`visitAnyClass`。不過其父類SimplifiedVisitor有：

```Java
// In SimplifiedVisitor
public void visitLibraryClass(LibraryClass libraryClass) {
    visitAnyClass(libraryClass);
}
// In ClassPoolFiller
public void visitAnyClass(Clazz clazz) {
    classPool.addClass(clazz);
}
```

如此就將讀取到的類別加入Library class pool或Program class pool。

所以，`readInput()`實作上則分以下幾個步驟：

- **依序取出ProGuard設定檔指定的檔案路徑。**
- **依照檔案類型建立對應的DataEntryReader。**
- **透過DataEntryReader依序取得檔案內class檔路徑。**
- **透過LibraryClassReader或ProgramClassReader，讀取class檔轉成clazz類別。**
- **將clazz分類加入Library class pool或Program class pool。**

其用途主要是：

* **解壓並讀取壓縮檔內的Class檔來放入class pool。**
