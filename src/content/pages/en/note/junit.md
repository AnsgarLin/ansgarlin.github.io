---
title: "Junit"
updated: "2019-04-04"
---
### Environment
```
1. Install New Software
2. 選擇Work with: Juno - http://download.eclipse.org/releases/juno
3. Programming Language -> Eclipse Java Development Tools
4. Next然後進行安裝
```

### 建置測試專案
假設有一需要被測試的專案叫做MyProject

先依照android官方建議的結構建立test專案
http://developer.android.com/tools/testing/testing_android.html#TestProjects

```
1. 右鍵 -> New -> Project -> Android Test Project

2. 建入Project Name，建議以要測試的專案為prefix
    ex: MyProject -> MyProjectTest

3. Location選擇已MyProject的根目錄
    ex: D:\Dropbox\Public\Company\Projects\Personal\Playfair\Test

4. Finish後，Eclipse會自動以專案名稱為prefix，新增一資料夾MyProjectTestTest至MyProject根目錄

5. 在MyProjectTestTest右鍵 -> Refactor -> Rename 將資料夾名稱改成tests

6. Import MyProjectTest專案至workspace

7. 修改並新增原有的src package成以下三種，代表三種執行方式:
    com.xxx.test.android: 只能透過Android JUnit test執行
    com.xxx.test.android.fun: 可透過兩種方式執行，但必須沒有Android API才可以使用JUnit test執行
    com.xxx.test.java: 只能透過JUnit test執行
    ※針對整個Project只能進行Android JUnit test執行，並且會跳過only裡的測項
```

### 產生測試碼
依照不同的類型有不同的建立方式:

#### com.xxx.test.android:
```
1. New -> Class
2. Name填入測試class名稱，通常以相對應的class名稱為prefix
    ex: MainActivity -> MainActivityTest
3. Superclass選擇android.test.ActivityInstrumentationTestCase2<T>
4. Finish
5. 將ActivityInstrumentationTestCase2<T>的T修正為所對應到的class名稱
        ex: ActivityInstrumentationTestCase2<T> -> ActivityInstrumentationTestCase2<MainActivity>
6. 建立一建構函式如下
    public MainActivityTest() {
        super(MainActivity.class);
    }
7. 接著就可以開始編寫測試函式，測試函式必須皆有test的prefix
   ex: testFun, testFun2...
   測試程序預設會依照行數由上至下執行所有非建構式的函式，如要跳過某些函式，可以使用以下方式
   ※將函式設成private/protected，但須注意單獨執行此class時，這些函式不會被跳過而報錯(class not public)
   ※測試函式加上特殊tag(@Small/Medium/LargeTest)，就可以在測試前進入Run configurations中指定只跑特定tag的測項
8. 透過setUp可以在每個測試函式執行前做初始化設定，並在tearDown做回收的動作
    @Before
    public void setUp() throws Exception {
        super.setUp();
    }
    @After
    public void tearDown() throws Exception {
        super.tearDown();
    }
```

#### com.xxx.test.android.fun:
```
1. New -> Class
2. Name填入測試class名稱，通常以相對應的class名稱為prefix，由於此部分class無法以Activity方式執行，而只能測試函式正確性
    所以prefix後可再加上Fun來跟com.xxx.test.android內的test class做區分
    ex: MainActivity -> MainActivityFunTest
3. Superclass選擇junit.framework.TestCase
4. Finish
5. 由於ActivityInstrumentationTestCase2繼承最終來自於TestCase，所以測試函式的行為和撰寫方式皆與com.xxx.test.android內的相同
6. 同樣可使用setUp/tearDown進行初始化和回收的動作
```

#### com.xxx.test.java:
```
1. New -> JUnit Test Class
2. 選用New JUnit 4 Test
3. Name填入測試class名稱，通常以相對應的class名稱為prefix，由於此部分class無法執行與android相關的API，所以加上JUnit為prefix
    來跟com.xxx.test.android和com.xxx.test.android.fun內的test class做區分
    ex: MainActivity -> MainActivityJUnitTest
4. 勾選底下setUpBeforeClass/tearDownAfterClass/setUp/tearDown，讓系統自動建立
5. Finish
6. 接著就可以開始編寫測試函式，測試函式不一定要有test的prefix，預設依照行數由上至下執行所有有加上@test的函式，如要跳過某些函式，可         以使用@ignore
7. setUp/tearDown功能如前述，setUpBeforeClass/tearDownAfterClass則是在整個class測試的前後進行
    @BeforeClass
    public static void setUpBeforeClass() throws Exception {
        // 此訊息可在console看到
        System.out.println("@BeforeClass");
    }
    @AfterClass
    public static void tearDownAfterClass() throws Exception {
         // 此訊息可在console看到
        System.out.println("@tearDownAfterClass");
    }
    @Before
    public void setUp() throws Exception {
         // 此訊息可在console看到
        System.out.println("@setUp");
    }
    @After
    public void tearDown() throws Exception {
         // 此訊息可在console看到
        System.out.println("@tearDown");
    }
8. 首次執行會有Invalid layout of java.lang.String at value的錯誤，在執行前須進入Run configurations設定以下:
    a. Classpath -> 刪除Bootstrap Entries下的android專案
    b. JRE -> 選擇Excution environment -> 選擇任一
        ※如有透過Install New Software安裝Eclipse Java Development Tools，這邊應該有選項，任一即可
9. 加上@Test(expected=ArithmeticException.class)可以檢查測試函式是否有拋出ArithmeticException
```

