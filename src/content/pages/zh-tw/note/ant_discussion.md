---
title: "Discussion"
updated: "2019-04-04"
---
## Unable to delete file while using "clean" during the ant build process

* Solution 1

```
The eclipse is open, close eclipse then the files will be deletable
```
* Solution 2

```
Change the following two line in <sdk-dir>/tools/ant/build.xml
<delete dir="${out.absolute.dir}" verbose="${verbose}" />
<delete dir="${gen.absolute.dir}" verbose="${verbose}" />
--to--
<delete dir="${out.absolute.dir}" quiet="true" verbose="${verbose}" />
<delete dir="${gen.absolute.dir}" quiet="true" verbose="${verbose}" />
The parameter means to perform delete like 'rm' but with '-f'
```


