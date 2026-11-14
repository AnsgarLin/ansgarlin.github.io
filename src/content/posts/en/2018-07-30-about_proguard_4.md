---
title: "About ProGuard - Part 4"
date: "2018-07-30"
---
In Part3 we covered how the ProGuard configuration is read. Now let's go back to the entry point of ProGuardTask:

```Java
// In ProGuardTask
@TaskAction
public void proguard() throws ParseException, IOException {
	...
    // Run ProGuard with the collected configuration.
    new ProGuard(getConfiguration()).execute();
}
```

After the Configuration is read, `execute()` is called:

```Java
// In ProGuard
public void execute() throws IOException {
    ...
    readInput();
    ...
}
```

Let's go straight to `readInput()`:

```Java
// In ProGuard
private void readInput() throws IOException {
    ...
    // Fill the program class pool and the library class pool.
    new InputReader(configuration).execute(programClassPool,
                                           libraryClassPool);
}
```

From the content, we can confirm this is what we mentioned in Part1: after reading the ProGuard configuration, the code to be processed is read next, and divided into the **Program class pool** and the **Library class pool**.

Next, look at `execute()`:

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

First, the library is read through `readInput()`. For a detailed introduction of this method, see the [Appendix](#Appendix). In short, this method is responsible for:

* **Unzipping and reading the Class files inside the archive and putting them into the class pool**.

In this example, it reads the Class files from the Jar file paths listed in `configuration.libraryJars` and adds them to `libraryClassPool`.

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

The previous part reads the library; next comes reading the program. What's different from before is the last argument used, ClassPresenceFilter.

Before going deeper, let's first break this ClassPresenceFilter down. Its structure is as follows:

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

Following the introduction in the [Appendix](#Appendix), this ClassPresenceFilter executes the following steps:

* Check whether the class that was read is already in the first one, `programClassPool`. If it is, `duplicateClassPrinter` is used directly to output a note; if not, it goes into the next ClassPresenceFilter.
* The second ClassPresenceFilter checks whether the class is already in `libraryClassPool`. If it is, a note is output as well; if not, it's added to `programClassPool` through ClassPoolFilter.

In short, **if it's in neither `programClassPool` nor `libraryClassPool`, it's put into `programClassPool`**.

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

At this point, the Class files inside the Jar files specified through `-injars`, `-outjars` and `-libraryjars` have all been read and sorted into the Library class pool and the Program class pool.

### What's more

From the introduction above, you can see that the timing of reading the library may change depending on `FAVOR_LIBRARY_CLASSES`:

```java
// In InputReader
private static final boolean FAVOR_LIBRARY_CLASSES = System.getProperty("favor.library.classes") != null;
```

Through a specific system property, `favor.library.classes`, you can decide whether to process the library before the program.

The processing order then becomes one of the following two:

- With `favor.library.classes`: library first, then program.
- Without `favor.library.classes`: program first, then library.

This change was mainly proposed by a Google engineer who works on AOSP. For details, see the [discussion thread](https://sourceforge.net/p/proguard/discussion/182455/thread/76430d9e/).

### Appendix

#### readInput()

The following uses a snippet in `InputReader.execute()` as the example:

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

Here `configuration.libraryJars` is used. It's a ClassPath, which Configuration uses to record the file paths obtained from the configuration files:

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

Paths set through `-injars` and `-outjars` are put in `programJars`; `-libraryjars` goes into `libraryJars`.

The `readInput()` above goes into the following `readInput()`:

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

Here the file paths are taken out of the ClassPath one by one and passed into another `readInput()`:

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

Here `DataEntryReaderFactory.createDataEntryReader()` is used to wrap the passed-in `dataEntryReader` once more:

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

Only the more commonly used parts are kept here. For an Android project, `classPathEntry` should be the path of a Jar file, and `reader` is the ClassFilter mentioned in the example.

First, look at the first call to `wrapInJarReader()`:

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

Again the unused parts are omitted, so the passed-in `reader`, which is the ClassReader, is first wrapped into a JarReader.

`isJar` is `isApk`, so it's false and goes into the else branch: the JarReader, together with the passed-in ClassReader and a DataEntryNameFilter, is wrapped into a FilteredDataEntryReader and returned.

Let's first mention DataEntryNameFilter here:

```Java
// In DataEntryNameFilter
public DataEntryNameFilter(StringMatcher stringMatcher) {
    this.stringMatcher = stringMatcher;
}
```

The passed-in stringMatcher is an ExtensionMatcher:

```Java
// In ExtensionMatcher
public ExtensionMatcher(String extension) {
    this.extension = extension;
}
```

From the content above, `extension` is the `.apk` passed in when `wrapInJarReader` was called.

Back in `createDataEntryReader()`, `isApk` is false, so `wrapInJarReader()` is called again. The FilteredDataEntryReader we just got is wrapped into another JarReader, but this time `isJar` is true, so the current JarReader is returned directly.

So far, the reader obtained through `DataEntryReaderFactory.createDataEntryReader()` has the following structure:

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

After getting the needed DataEntryReader, a DirectoryPump is created, and it starts reading the file through `pumpDataEntries()`.

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

The first thing used here is JarReader's `read()`:

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

We know a Jar file is in the Zip archive format, so it makes sense to use ZipInputStream to get the content of the Jar file. Through `getNextEntry()`, the Class files can be taken out one by one and passed to `dataEntryReader.read()`:

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

Through `dataEntryFiler`, which is the DataEntryNameFilter, `accepts` is called to make the decision:

```java
// In DataEntryNameFilter
public boolean accepts(DataEntry dataEntry) {
    return dataEntry != null && stringMatcher.matches(dataEntry.getName());
}
```

When this method is called, it uses `stringMatcher`, which is the ExtensionMatcher, to call `matches` and passes in the file path. From the process just described, we know the path passed in here ends with `.class`:

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

What it does is simple: check whether the end of the file path is the same as `extension`. The value of `extension` is the `.apk` passed in at the first call to `wrapInJarReader`, so it returns false.

Back in `FilteredDataEntryReader.read()`, getting false means `rejectedDataEntryReader`, which is the ClassReader, is used to continue.

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

The ClassReader here is the one passed in when `InputReader.readInput()` was called at the beginning of the example, so `isLibrary` is true, and a LibraryClassReader is passed in through `LibraryClass.accpet()`:

```Java
// In LibraryClass
public void accept(ClassVisitor classVisitor) {
    classVisitor.visitLibraryClass(this);
}
```

This is a [Visitor Pattern](https://en.wikipedia.org/wiki/Visitor_pattern), so we need to go back and look at LibraryClassReader's `visitLibraryClass()`:

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

LibraryClassReader gets the content of the Class file through `dataInputStream` and parses it. The process of reading the file is no longer related to this post, so we won't go deeper. In short, the parsed result is stored back into the LibraryClass, and the same goes for ProgramClass.

Here, based on how `accept()` is used, we can point out a concept first:

* **Executing `clazz.accept(visitor)` can be read directly as `visitor.visitXXXClass()`. Whether `clazz` is a ProgramClass or a LibraryClass decides what `XXX` is.**

##### Put into pool

Back in `ClassReader.read()`, if the LibraryClassReader part completed successfully, `getName()` won't be null, so `accept` is called once more with classVisitor, which is the ClassPresenceFilter mentioned in the example above:

```Java
// In ClassPresenceFilter
public ClassPresenceFilter(ClassPool    classPool, ClassVisitor presentClassVisitor,
                           ClassVisitor missingClassVisitor) {
    this.classPool           = classPool;
    this.presentClassVisitor = presentClassVisitor;
    this.missingClassVisitor = missingClassVisitor;
}
```

From the content above, we know it goes to `visitLibraryClass`:

```Java
// In ClassPresenceFilter
public void visitLibraryClass(LibraryClass libraryClass) {
    ClassVisitor classFileVisitor = classFileVisitor(libraryClass);

    if (classFileVisitor != null) {
        classFileVisitor.visitLibraryClass(libraryClass);
    }
}
```

First, `classFileVisitor` is used to find the suitable ClassVisitor to call `visitLibraryClass`:

```Java
// In ClassPresenceFilter
private ClassVisitor classFileVisitor(Clazz clazz) {
    return classPool.getClass(clazz.getName()) != null ?
        presentClassVisitor :
        missingClassVisitor;
}
```

This checks whether the current class already exists in `classPool`, which is the ClassPool passed in by ProGuard when `InputReader.execute()` was called.

If it does, `presentClassVisitor` is called, which is the DuplicateClassPrinter, and is only used to output a note:

```Java
// In DuplicateClassPrinter
public void visitLibraryClass(LibraryClass libraryClass) {
    notePrinter.print(libraryClass.getName(), "Note: duplicate definition of library class [" + ClassUtil.externalClassName(libraryClass.getName()) + "]");
}
```

If it's `missingClassVisitor`, it's a ClassPoolFiller. This class only implements `visitAnyClass`, but its parent class SimplifiedVisitor has:

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

This way, the class that was read is added to the Library class pool or the Program class pool.

So, `readInput()` is implemented in the following steps:

- **Take out the file paths specified in the ProGuard configuration files one by one.**
- **Create the corresponding DataEntryReader based on the file type.**
- **Get the paths of the class files inside the file one by one through the DataEntryReader.**
- **Read the class files through LibraryClassReader or ProgramClassReader and turn them into clazz objects.**
- **Sort the clazz into the Library class pool or the Program class pool.**

Its main purpose is:

* **Unzipping and reading the Class files inside the archive and putting them into the class pool.**
