---
title: "About ProGuard - Part 3"
date: "2018-07-28"
---
After understanding the basics of how ProGuard works, it's hard not to want to know how it's designed behind the scenes, so that it can process and analyze code of all kinds of styles, without even worrying that the whole flow fails to run because the target program is too large.

At least, that's how I feel, so the remaining chapters focus on the flow of its code. As for whether we can find any patterns in it that we can borrow for our daily projects, we'll only know after reading through.

Covering everything takes a lot of space, so Part3 is only a beginning. I also suggest reading Part1 first to understand some of the terms used in the following chapters.

### Where to start

#### Source code

A craftsman must first sharpen his tools. First, download the source code from the [official site](https://sourceforge.net/projects/proguard/files/proguard/6.0/proguard6.0.3.zip/download). Everything below is based on version 6.0.3.

#### Start point

Since we want to look at the flow related to Android, let's go straight to ProGuardTask under the `gradle` directory.

To design a Gradle Task, besides extending DefaultTask, you also need to add `@TaskAction` to the method that serves as the entry point; similar to Java's `main()`, the Task starts by calling `execute()`. For details, see the [introduction](https://docs.gradle.org/current/userguide/custom_tasks.html) on the Gradle website.

So the entry point of ProGuardTask is `proguard()`:

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

As we mentioned in Part1, the first step of ProGuard is reading the ProGuard configuration.

### Read Configuration

First, look at `getConfiguration()`:

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

The omitted first half adds the jar files of the Program and Library classes into `configuration`, but it's not important here, so we skip it. What's left is that every configuration file goes through `ConfigurationParser.parse()` in turn, which stores the settings in the file into `configuration`.

So the key is ConfigurationParser:

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

ConfigurationParser uses FileWordReader to read the file:

```Java
// In FileWordReader
public FileWordReader(File file) throws IOException {
    super(new LineNumberReader(new BufferedReader(new FileReader(file))), ...);
}
```

We won't go into its details here; in short, it's used to read the file content line by line.

Back to `readNextWord()`:

```Java
// In ConfigurationParser
private void readNextWord() throws IOException {
    readNextWord(false, false);
}

private void readNextWord(boolean isFileName, boolean expectSingleFile) throws IOException {
    nextWord = reader.nextWord(isFileName, expectSingleFile);
}
```

So right after ConfigurationParser is created, it reads the file through the passed-in Reader. FileReader here doesn't implement `nextWord()`, so the parent WordReader's `nextWord()` is used.

To avoid interrupting the analysis, this method is explained in the [Appendix](#Appendix). In short, its purpose is: **read the configuration content line by line and return it, split by whitespace, brackets, commas or colons.** So the current `nextWord` is `-keep`.

At this point, ConfigurationParser has been created successfully. Then `parse()` is called, with `configuration` passed in to hold the result. To have something concrete for the explanation, here we use a common keep rule as the example:

```Java
-keep class * extend com.example.classname { *; }
```

Here are the parts of `parse()` that the example uses; the other parts are much the same:

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

Since `nextWord` is `-keep` at this point, after entering the loop it goes to the `KEEP_OPTION` branch, which uses `configuration.keep` to store the classes, methods and variables that need to be kept:

```Java
// In Configuration
/**
 * A list of {@link KeepClassSpecification} instances, whose class names and
 * class member names are to be kept from shrinking, optimization, and/or
 * obfuscation.
 */
public List      keep;
```

Here we simply assume `configuration.keep` isn't null, and look at `parseKeepClassSpecificationArguments()`:

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

Based on the input above, note that only `markClasses` is true, and the others are either false or null. It then calls another `parseKeepClassSpecificationArguments()` with the same name:

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

At the beginning, this method checks whether there are settings modifying keep, such as `allowshrinking`. If there are, the variables at the beginning of the method are changed.

However, according to the example, the string `readNextWord()` gets here is `class`, so the next check breaks out of the loop directly and goes to the part that reads the class: `parseClassSpecificationArguments()`. This method runs through more code for this example, so it's explained in sections below:

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

Now the value of `nextWord` is `class`, so it skips the while loop and goes to `parseCommaSeparatedList`.

This method is also fairly complex; see the [Appendix](#Appendix) for details. In short, its purpose is:

* **Reassemble a comma-separated string into a List until no more commas are seen, and read the next word before returning**.

After getting the List, `commaSeparatedString` is called to reassemble the List back into a string. This round trip removes unnecessary characters between the strings, such as comments.

```Java
    // For backward compatibility, allow a single "*" wildcard to match any
    // class.
    String className = ConfigurationConstants.ANY_CLASS_KEYWORD.equals(externalClassName)?
        null : ClassUtil.internalClassName(externalClassName);
```

With the example, `parseCommaSeparatedList()` only gets the asterisk, so `className` is set to null, and `nextWord` is the word after the asterisk, `extend`.

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

`nextWord` is `extend`, so `configurationEnd()` is false. `readNextWord()` is called again to get the next string in the example: `com.example.classname`.

Then, as before, `parseCommaSeparatedList` is used to take out the comma-separated strings, but it only gets the same result. So at this point `externalExtendsClassName` is `com.example.classname`, and `nextWord` is `{`.

Finally, `ClassUtil.internalClassName()` replaces the `.` separating the class name with `/`:

```Java
// In ClassUtil
public static String internalClassName(String externalClassName) {
    return externalClassName.replace(JavaConstants.PACKAGE_SEPARATOR,
                                     ClassConstants.PACKAGE_SEPARATOR);
}
```

At this point we have the complete class name, and next is creating a ClassSpecification. ClassSpecification is a model that stores class information; besides the class name, it records methods, variables and other class-related information:

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

Back in `parseClassSpecificationArguments()`, there's still:

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

Last of all, `configurationEnd()` is still false, and `nextWord` is `{`, which equals `OPEN_KEYWORD`, so it goes straight down to the while loop.

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

`readNextWord()` inside the loop gets the asterisk, which is further analyzed by `parseMemberSpecificationArguments()`, and the result is put back into `classSpecification`.

When `}`, i.e. `CLOSE_KEYWORD`, is read, `readNextWord()` runs one last time. At this point `nextWord` becomes null because it reaches the end of the line, the loop exits, and the parsing of one keep rule is complete.

The `classSpecification` produced here is returned to `parseKeepClassSpecificationArguments()` and added to the List `keepClassSpecifications`, which is the `configuration.keep` passed in from outside.

Returning further, we're back in `parse` ready for the next iteration. At this point `nextWord` is null, which ends the loop and exits `parse()`, completing the configuration analysis of the whole file.

### Appendix

This part introduces the methods with more content, to keep the analysis above from getting too scattered. To connect with the analysis above, the same example is used.

#### readNextWord() 

Since this method contains a lot of operations, the parts not used in the analysis above are omitted or left as comments to save space:

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

This method works in three phases: **first call**, **subsequent calls**, and **end of file**.

##### First call

At first, `currentLine` is empty, so it jumps straight to the second section and gets the first line through `nextLine()`.

`nextLine()` here is implemented by each Reader; let's look at FileWordReader directly. FileWordReader actually extends LineNumberReader, which reads one line of the file as a string without the line break.

Back in `nextWord`, after getting the string, its length is stored first. This is the termination condition used to tell whether the line has been fully analyzed. Then it looks for the starting position of the configuration content, so whitespace and comments are skipped.

Once found, it takes out the first word and enters the series of checks in the third section. Generally it goes into the last `else`, and reads until a whitespace or a hash sign appears, which is taken as the end position.

With the start and end positions, part of the string can be taken out of the current line.

##### Subsequent calls

Since the Reader exists throughout the whole analysis, the previously set `currentLine`, `currentLineLength` and the resulting `currentWord` aren't cleared; the next time this method is entered, it goes into the first section, again skipping whitespace and comments to find the start of the next piece of configuration, and then goes into the third section to get the next piece.

##### End of file

If `currentIndex` has been incremented to equal `currentLineLength` in the first section, the line has been fully processed. It then goes into the second section and first reads the next line into `currentLine`. This is a reset, so later calls don't loop in the terminated state. Then it returns null directly to let the caller know the end of the line has been reached.

In summary, this method:

* **Reads the configuration content line by line and returns it, split by whitespace, brackets, commas or colons.**

#### parseCommaSeparatedList()

Same as `readNextWord()`, only the parts used in the analysis above are kept here:

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

This is a general-purpose method dedicated to reassembling a comma-separated string into a List. In this post's example, it's used to get the class name.

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

This method first calls `readNextWord()`. In this post's example, when the analysis reaches this method, the `nextWord` obtained is the asterisk.

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

Whatever it gets is then added to the List, and `readNextWord()` is used again to read the next string, which in the example is `extend`.

```Java
        if (!ConfigurationConstants.ARGUMENT_SEPARATOR_KEYWORD.equals(nextWord)) {
            return list;
        }

        // Read the next list entry.
        readNextWord(expectedDescription, ...);
    }
}
```

Since `nextWord` is `extend`, not a comma, the List containing the asterisk is returned directly. If it were a comma, the next string would be taken out and the next iteration would start.

In short, this method:

* **Reassembles a comma-separated string into a List until no more commas are seen, and reads the next word before returning.**
