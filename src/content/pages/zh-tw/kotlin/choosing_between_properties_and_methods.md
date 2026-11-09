---
title: "(Transcription) Choosing Between Properties and Methods"
updated: "2019-04-04"
---
[origin]: https://msdn.microsoft.com/en-us/library/ms229054(v=vs.100).aspx

### Note

_This is only a transcription_
* _For English reader, please check the [origin article][origin] which is written by Microsoft._

這是一篇個人紀錄，由原文翻譯而來。如欲閱讀細節，請至原文網站。

### 變數 (Property)

一般來說，函式代表操作；變數代表資料。變數應該被使用於屬性，代表變數的值應避免經由複雜的運算來取得。在不違反規範的情況下，也應選用變數而非函式，因為其可讀性比較高。

* **一個類別的屬性應使用變數。**

舉例來說，`BorderStyle`用於表示`ListView`的`border`是什麼類型。

* **如果變數的數值是存於記憶體中，而變數單純用存取數值的話。應該使用變數而不是函示表示。**

接下來用一段程式碼來當範例。在EmployeeRecord中定義了兩個變數來存取private的值。

```
public class EmployeeRecord {
    private int employeeId;
    private int department;

    public EmployeeRecord() { }

    public  EmployeeRecord (int id, int departmentId) {
        EmployeeId = id;
        Department = departmentId;
    }

    public int Department {
        get { return department; }
        set { department = value; }
    }

    public int EmployeeId {
        get { return employeeId; }
        set { employeeId = value; }
    }

    public EmployeeRecord Clone() {
        return new EmployeeRecord(employeeId, department);
    }
}
```

### 函式 (Method)

在以下情況，使用函式好過變數：

* 操作比起設定數值還要慢上許多。如果你需要使用同步機制來避免thread被卡住，那代表這操作已經不適和成為一個變數。特別是針對網路或檔案系統的操作，最好是以函式來表示。
* 操作是類似一種轉型，像是`toString()`。
* 操作每次使用相同參數呼叫，但回傳結果都不同時。例如`NewGuid()`。
* 操作有著明顯的side effect。要注意的是如果是存取內部cache並不屬於side effect。
* 操作會複製並回傳內部狀態。
* 操作會回傳一個陣列。

用函示來回傳Array是為了保護內部的Array，即是得到的Array是內部Array的複製版，而不是指向內部Array的指標。在這樣的前提下，使用變數來取得Array將變得沒有效率。以下用一段程式碼來表示：

```C#
public class EmployeeData {
    EmployeeRecord[] data;
    public EmployeeData(EmployeeRecord[] data) {
        this.data = data;
    }

    public EmployeeRecord[] Employees {
        get {
            EmployeeRecord[] newData = CopyEmployeeRecords();
            return newData;
        }
    }

    EmployeeRecord[] CopyEmployeeRecords() {
        EmployeeRecord[] newData = new EmployeeRecord[data.Length];
        for(int i = 0; i< data.Length; i++) {
            newData[i] = data[i].Clone();
        }
        Console.WriteLine ("EmployeeData: cloned employee data.");
        return newData;
    }
}
```

以下是一個當開發者認為使用變數並不是一個低效率的操作時的範例：

```
public class RecordChecker
{
    public static Collection<int> FindEmployees(EmployeeData dataSource,
             int department) {
        Collection<int> storage = new Collection<int>();
        Console.WriteLine("Record checker: beginning search.");

        for (int i = 0; i < dataSource.Employees.Length; i++) {
            if (dataSource.Employees[i].Department == department) {
                Console.WriteLine("Record checker: found match at {0}.", i);
                storage.Add(dataSource.Employees[i].EmployeeId);
                Console.WriteLine("Record checker: stored match at {0}.", i);
            } else {
                Console.WriteLine("Record checker: no match at {0}.", i);
            }
        }
        return storage;
    }
}
```

可注意到的是Employees這變數是在迴圈內被讀取，而每一次被使用時，內部Array就會被複製一次，從而產生Garbage Collection。如果用函示來操作，你可以發現現在這個做法是更加損耗運算效率。開發者應該傾向於使用函式一次並將結果記錄下來以供接下來持續使用。

### Example

以下程式碼是本章節完整範例：

```
using System;
using System.Collections.ObjectModel;
namespace Examples.DesignGuidelines.Properties {
    public class EmployeeRecord {
        private int employeeId;
        private int department;

        public EmployeeRecord() { }

        public  EmployeeRecord (int id, int departmentId) {
            EmployeeId = id;
            Department = departmentId;
        }

        public int Department {
            get {return department;}
            set {department = value;}
        }

        public int EmployeeId {
            get {return employeeId;}
            set {employeeId = value;}
        }

        public EmployeeRecord Clone() {
            return new EmployeeRecord(employeeId, department);
        }
    }

    public class EmployeeData {
        EmployeeRecord[] data;

        public EmployeeData(EmployeeRecord[] data) {
            this.data = data;
        }

        public EmployeeRecord[] Employees {
            get {
                EmployeeRecord[] newData = CopyEmployeeRecords();
                return newData;
            }
        }

        EmployeeRecord[] CopyEmployeeRecords() {
            EmployeeRecord[] newData = new EmployeeRecord[data.Length];
            for(int i = 0; i< data.Length; i++) {
                newData[i] = data[i].Clone();
            }
            Console.WriteLine ("EmployeeData: cloned employee data.");
            return newData;
        }
    }

    public class RecordChecker {
        public static Collection<int> FindEmployees(EmployeeData dataSource,
                 int department) {
            Collection<int> storage = new Collection<int>();
            Console.WriteLine("Record checker: beginning search.");

            for (int i = 0; i < dataSource.Employees.Length; i++) {
                if (dataSource.Employees[i].Department == department) {
                    Console.WriteLine("Record checker: found match at {0}.", i);
                    storage.Add(dataSource.Employees[i].EmployeeId);
                    Console.WriteLine("Record checker: stored match at {0}.", i);
                }

                else {
                    Console.WriteLine("Record checker: no match at {0}.", i);
                }
            }
            return storage;
        }
    }

    public class Tester {
        public static void Main() {
            EmployeeRecord[] records  = new EmployeeRecord[3];
            EmployeeRecord r0  = new EmployeeRecord();
            r0.EmployeeId = 1;
            r0.Department = 100;
            records[0] = r0;
            EmployeeRecord r1  = new EmployeeRecord();
            r1.EmployeeId = 2;
            r1.Department = 100;
            records[1] = r1;
            EmployeeRecord r2  = new EmployeeRecord();
            r2.EmployeeId = 3;
            r2.Department = 101;
            records[2] = r2;
            EmployeeData empData = new EmployeeData(records);
            Collection<int> hits = RecordChecker.FindEmployees(empData, 100);
            foreach (int i in hits) {
                Console.WriteLine("found employee {0}", i);
            }
        }
    }
}
```
