---
title: "Room (Android Interface Definition Language)"
updated: "2019-04-04"
---

Room是Android原生的API，官方敘述如下：

> Room provides an abstraction layer over SQLite to allow fluent database access while harnessing the full power of SQLite.

其功能在於提供開發者一個抽象的介面，使開發的過程可以更加流暢並保留SQLite的效能。

Room的機制包含了三個部分：Database、DAO和Entity：

* Database：持有底層資料庫並提供DAO。
* DAO：定義與資料庫溝通的函式。
* Entity：資料庫內的table。

彼此關係可用下圖表示：

<img src="https://developer.android.com/images/training/data-storage/room_architecture.png" style="max-width:50%"/>

整個執行過程如下：

* 透過RoomDatabase取得DAO。
* 呼叫DAO內的函式存入或取得Entity。
* 針對Entity修改內容。

### Setup

在使用Room之前，必須要先引入相關的dependency：

```
allprojects {
    repositories {
        jcenter()
        google()
    }
}

dependencies {
	// Room (use 1.1.0-rc1 for latest version)
    implementation "android.arch.persistence.room:runtime:1.0.0"
    annotationProcessor "android.arch.persistence.room:compiler:1.0.0"
}
```

其他設定可以參考[官方文件](https://developer.android.com/topic/libraries/architecture/adding-components)。

接著來依照設定的順序介紹每個部位的設定方式。每一部分的第一段程式碼都是可以直接使用的範例。

#### Entity

作為Entity必須要符合以下幾個條件：

* 使用`@Entity`標記。
* 使用`@PrimaryKey`標記變數。

指定primary key時，有以下兩個情形要注意：

* 注意變數的值是否一定唯一，不然會產生conflict狀況。
* 如果預設值會是null的類別，如String，需要加上`@NonNull`。

除了以上兩種Annotation是強制要設定的，Entity中還可以設定以下幾種：

* `@tableName`：預設表單名稱是Entity類別名，透過此Annotation可以另外指定。
* `@ColumnInfo`：預設欄位名稱是變數名，透過此Annotation可以另外指定。
* `@Index`：用於標記特定欄位來加快查詢速度，如有特定組合是不希望重複的，可以再加上`unique`。


* `@Ignore`：用於不想被存入資料庫的變數。
* `@ForeignKey`：用於設定外部關聯。
* `@Embedded`：用於加入另一個Entity或POJO的變數。


完整用到所有的Annotation的範例如下：

```java
@Entity(tableName = "user",
        indices = {@Index(value = {"first_name", "last_name"}, unique = true)},
        foreignKeys = @ForeignKey(entity = Address.class, 
                                  parentColumns = "id", childColumns = "uid", 
                                  onDelete = ForeignKey.CASCADE))
public class User {
    @PrimaryKey
    private int uid;

    @ColumnInfo(name = "first_name")
    private String firstName;

    @ColumnInfo(name = "last_name")
    private String lastName;
    
    @Embedded(prefix = "order_")
    private Order order;

    @Ignore
    private Address address;
    
    // Ignore get/set
}

public static class Order {
    private int id;
    private String name;

    // Ignore get/set
}
```

##### More about Entity

***Constructor***

Entity可以擁有second constructor，但輸入的參數名稱必須要和Entity內的變數名稱相同。

***Table name***

表單名稱在SQLite裡面沒有大小寫之分。

***Foreign key Callbacks***

設定foreign key之後，可以使用`onDelete`或`onUpdate`來設定外部資料變動時所要進行的操作：

```java
@Entity(foreignKeys = @ForeignKey(entity = Address.class,
                                  parentColumns = "id", childColumns = "uid", 
                                  onDelete = ForeignKey.CASCADE))
```

要存取有foreign key的	Entity時，必須確保資料庫已經存有指定的Entity，否則會產生錯誤訊息：
```
FOREIGN KEY constraint failed 
```


相關參數可以看官方文件[ForeignKey](https://developer.android.com/reference/android/arch/persistence/room/ForeignKey.html)。

***Multiple Embedded***

如果Embedded類別所含的變數名稱相同，可以透過`prefix`來加入前綴字，避免資料欄位重複產生錯誤：

```java
@Embedded(prefix = "prefix_")
```

***Special Rule***

* `@ColumnInfo`、`@Embedded`和`@Relation`不能同時使用在同一個變數。

#### DAO

要作為DAO的類別必須要符合以下幾個條件：

* 使用`@Dao`標記。
* 用`@Query`、`@Insert`、`@Update`、`@Delete`或`@Transaction`標記函示。

```java
@Dao
public interface UserDao {
    @Query("SELECT * FROM user")
    List<User> getAll();

    @Query("SELECT * FROM user WHERE uid IN (:userIds)")
    List<User> loadAllByIds(int[] userIds);

    @Query("SELECT * FROM user WHERE first_name LIKE :first AND "
            + "last_name LIKE :last LIMIT 1")
    User findByName(String first, String last);
    
    @Query("SELECT * FROM user WHERE uid = :userId")
    UserAddress getUserOrder(int userId);
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertAddress(Address... addressess);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertAll(List<User> users);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertAll(User... users);
    
    @Delete
    void delete(User user);
}
```

以下分別介紹這幾個Annotation：

##### @Query

```java
@Query("SELECT * FROM user")
List<User> getAll();
```

用於執行給予的資料庫操作指令：

***Query with collection***

如果參數是一個集合，只要再加上括號，Room就會自動將其內容分批執行然後回傳：

```java
@Query("SELECT * FROM user WHERE uid IN (:userIds)")
List<User> loadAllByIds(int[] userIds);
```

***Query with parameters***

有時我們需要給與參數來進行篩選，可以將參數名稱加入指令內，並在前面加冒號：


```java
@Query("SELECT * FROM user WHERE first_name LIKE :first AND " + "last_name LIKE :last LIMIT 1")
User findByName(String first, String last);
```

***Query through tables***

有時我們也需要由不同的資料表來篩選想要的結果，這時就可以在指令內進行整合資料表的規則：

```java
@Dao
public interface SampleDao {
  @Query("SELECT * FROM book "
         + "INNER JOIN loan ON loan.book_id = book.id "
         + "INNER JOIN user ON user.id = loan.user_id "
         + "WHERE user.name LIKE :userName")
  public List<Book> findBooksBorrowedByNameSync(String userName);
}
```

***Query relation data***

有時我們需要進行多表查詢，則可以建立一個POJO，並用`@Relation`設定變數：

```Java
public class UserAddress {
    @Embedded
    private User user;

    @Relation(parentColumn = "uid", entityColumn = "id")
    private List<Address> address;

    // Ignore get/set
}
```

`@Relation`指定的變數必須要是List或Set，並透過`parentColumn`指定變數所在類別對應到的欄位，而`entityColumn`則是變數類型內對應到的欄位。

如果變數類型和要聯查的類型不同，可以用`entity`另外指定：

```Java
@Relation(parentColumn = "uid", entityColumn = "id", entity = Address.class)    
private List<ShortAddress> address;

public static class ShortAddress {
    public int id;
    public String street;
    
    // Ignore get/set
}
```

如果只是要特定`Entity`的特定欄位，可以設定`projectiton`：

```Java
@Relation(parentColumn = "uid", entityColumn = "id", entity = Address.class, projection = {"city"})
private List<String> city;
```

不知為何，Primitive type的物件類型如Boolean、Long無法使用，會產生以下錯誤訊息：

```
Error:Entities and Pojos must have a usable public constructor.
```


##### @Insert

用於標記將資料加入資料庫的函示：

```java
@Insert
void insertUsers(User... users);

@Insert
void insertAll(List<User> users);

@Insert
void insertBothUsers(User user1, User user2);
```

插入方式可以是單數、複數的陣列或Collection。

定義`@Insert`函示的時候，建議設定好資料重複時的處理方式：

```java
@Insert(onConflict = OnConflictStrategy.REPLACE)
void insertUsers(User... users);
```

否則如`@PrimaryKey`重複時，就會產生以下錯誤：

```
UNIQUE constraint failed
```

詳細參數可以看官方文件[Insert](https://developer.android.com/reference/android/arch/persistence/room/Insert.html)，而Conflict的規則，可以查看SQL官方文件[ON CONFLICT clause](https://sqlite.org/lang_conflict.html)。

***Get the row IDs***

除了回傳void，標記為`@Insert`的函示也可以回傳當前資料在表單內的`rowid`。如果輸入的參數為集合類，則回傳long[]，反之則是long：

```java
@Insert
long[] insertUsers(User... users);

@Insert
long insertBothUsers(User user1, User user2);
```

##### @Update

用primary key來搜尋資料，並更新資料內容：

```java
@Update
void updateUsers(User... users);
```

可以將回傳參數改成int來取得成功更新的資料筆數。

##### @Delete

用primary key來搜尋資料後刪除：

```java
@Delete
void deleteUsers(User... users);
```

與`@Update`類似，可將回傳參數改成int來取得成功刪除的資料筆數。

##### @Transaction

用來將DAO操作組合，並確保所有操作會在一個transaction內完成：

```java
@Dao
public abstract class UserAddressDao implements UserDao{
    @Transaction
    public void compose() {
        insertAddress(address);
        insertAll(users);
    }
}
```

如果是組合`@Query`操作，則可以確保在以下兩種狀況，資料不會出錯：

- 回傳結果超過[CursorWindow](https://developer.android.com/reference/android/database/CursorWindow?authuser=4)一次能容納的量。


- 回傳結果是POJO類型，則其中的變數將是分開查詢。

```Java
@Dao
public interface UserDao {
    @Transaction @Query("SELECT * FROM user")
    List<User> getAll();
    
    @Transaction @Query("SELECT * FROM user WHERE uid = :userId")
    UserAddress getUserOrder(int userId);
}
```

##### More about DAO

***Returning subsets of columns***

給予一個POJO，可以在取得資料的同時，將結果轉成較為精簡的資料類別：

```Java
public class NameTuple {
  @ColumnInfo(name="first_name")
  public String firstName;

  @ColumnInfo(name="last_name")
  public String lastName;
}
```

然後，函式的回傳值可修改如下：

```Java
@Dao
public interface MyDao {
  @Query("SELECT first_name, last_name FROM user")
  public List<NameTuple> loadFullName();
}
```

***Returning a LiveData or Flowable***

由於Room是操作資料庫的單一路口，等同於資料來源，所以內建提供可以與LifeData和RxJava整合：

```java
@Dao
public interface MyDao {
  @Query("SELECT first_name, last_name FROM user WHERE region IN (:regions)")
  public LiveData<List<User>> loadUsersFromRegionsSync(List<String> regions);
}

@Dao
public interface MyDao {
  @Query("SELECT * from user where id = :id LIMIT 1")
  public Flowable<User> loadUserById(int id);
}
```

搭配RxJava後，可以在資料改變時收到通知，但無法確定收到的資料是不是重複，因為Room不會知道是什麼造成變動，所以建議加上`distinctUntilChanged()`。

使用LifeData和Flowable皆需要新增dependency，已不在本文介紹範圍中。如需知道詳細內容，請前往以下連結：

* [LifeData](https://developer.android.com/reference/android/arch/lifecycle/LiveData.html)
* [Room and RxJava](https://medium.com/google-developers/room-rxjava-acb0cd4f3757)

#### Database

```java
@Database(entities = {User.class}, version = 1)
public abstract class AppDatabase extends RoomDatabase {
  public abstract UserDao getUserDao();
}
```

RoomDatabase必須滿足以下幾個條件：

* 必須是一個抽象類別並繼承RoomDatabse。
* 使用@Database標記，並給予會用到的Entity類別，和資料庫版本。
* 設定一個抽象並且沒有接受參數的函示來取得Dao。

### Usage

#### Create Database

要取得RoomDatabase，必須要透過靜態函示`databaseBuilder`。在呼叫的同時要給予有`@Databse`標記的類別和想要的資料庫名稱。

```Java
AppDatabase db = Room.databaseBuilder(
  getApplicationContext(), 
  AppDatabase.class, 
  "database-name")
  .build();
```

***Allow quering on the main thread***

在預設的情況下，存取資料庫的行為都強制在背景處理，否則會有以下錯誤訊息：

````Java
java.lang.IllegalStateException: Cannot access database on the main thread since it may potentially lock the UI for a long period of time.
````

但有時候我們的操作是需要在main thread執行，就可以使用`allowMainThreadQueries()`來避免在main thread存取資料庫時產生錯誤：

```java
AppDatabase db = Room.databaseBuilder(
  getApplicationContext(), 
  AppDatabase.class, 
  "database-name")
  .allowMainThreadQueries()
  .build();
```

#### Migration

不同版本的資料庫可以進行相互整合，整合方式就是在產生RoomDatabase時加入Migration：

```java	
AppDatabase db = Room.databaseBuilder(getApplicationContext(), AppDatabase.class, "database-name").addMigrations(MIGRATION_1_2).build();
  
static final Migration MIGRATION_1_2 = new Migration(1, 2) {
  @Override
  public void migrate(SupportSQLiteDatabase database) {
    database.execSQL("CREATE TABLE `Fruit` (`id` INTEGER, " + "`name` TEXT, PRIMARY KEY(`id`))");
  }
};
```

要注意的是，再透過Migration進行版本整合時，需要自行建立新的表單。然後才可以將資料重新塞入，塞入的方式可以分為以下兩種：

***Execute SQL command***

單純執行所熟悉的SQL指令：

```java
database.execSQL("INSERT INTO `Fruit` VALUES (" + 1 + ", `Harry`)");
```

***Use ContentValues***

如不想打指令也可以透過Android內建的ContentValues：

```java
database.beginTransaction();
try {
  ContentValues values = new ContentValues();
  values.put("id", 1);
  values.put("name", "Harry");
  database.insert("Fruit", SQLiteDatabase.CONFLICT_REPLACE, values);
  database.setTransactionSuccessful();
} finally {
  database.endTransaction();
}
```

要注意的是使用前後必須使用`beginTransaction()`、`setTransactionSuccessful()`和`endTransaction()`來通知資料庫目前狀態。

### Test

測試進行開發很重要的一環，以下將從Room開發時比較重要的兩部分進行測試相關的介紹：

#### Database & DAO

要測試Database的基本功能，可以分成以下三個步驟來完成：

##### @Before

在測試前，透過`Room.inMemoryDatabaseBuilder()`來產生RoomDatabase，並呼叫`getUserDao()`來取得DAO。

##### @Test

產生假資料，透過DAO來加入資料庫。再透過DAO將資料取回並驗證。

##### @After

在測試完成後，執行`close()`關閉資料庫。

以下是一個完整的範例：

```java
@RunWith(AndroidJUnit4.class)
public class SimpleEntityReadWriteTest {
  private UserDao mUserDao;
  private TestDatabase mDb;

  @Before
  public void createDb() {
    Context context = InstrumentationRegistry.getTargetContext();
    mDb = Room.inMemoryDatabaseBuilder(context, TestDatabase.class).build();
    mUserDao = mDb.getUserDao();
  }

  @After
  public void closeDb() throws IOException {
    mDb.close();
  }

  @Test
  public void writeUserAndReadInList() throws Exception {
    User user = TestUtil.createUser(3);
    user.setName("george");
    mUserDao.insert(user);
    List<User> byName = mUserDao.findUsersByName("george");
    assertThat(byName.get(0), equalTo(user));
  }
}
```

#### Migration

要測試migration需要有一些前置作業：

***Export schemas***

為了讓Room可以在測試migration時直接建立資料表單，必須要將資料庫結構儲存下來。因此需要在`build.gradle`指定好schema檔案發佈的位置：

```Java
android {
    ...
    defaultConfig {
        ...
        javaCompileOptions {
            annotationProcessorOptions {
                arguments = ["room.schemaLocation":"$projectDir/schemas".toString()]
            }
        }
    }
}
```

***Add test dependency***

另外也要加入測試相關的dependency：

```java
android.arch.persistence.room:testing
```

***Add into asset directories***

最後，將schema的位置加入asset的路徑中：

```java
android {
    ...
    sourceSets {
        androidTest.assets.srcDirs += files("$projectDir/schemas".toString())
    }
}
```

完成設定後，要在撰寫測試時有以下幾個要點：

* 在測試前，建立MigrationTestHelper這個類別的物件，並用`@Rule`標記。
* 在測試時，先用MigrationTestHelper產生測試用的資料庫。用前面介紹過的方式插入資料，不能透過DAO。
* 執行`runMigrationsAndValidate()`來執行migration操作。
* 透過DAO取出資料進行驗證。

以下是完整範例：

```java
public class MigrationTest {
  private static final String TEST_DB = "migration-test";

  @Rule
  public MigrationTestHelper helper;

  public MigrationTest() {
    helper = new MigrationTestHelper(InstrumentationRegistry.getInstrumentation(),
                                     TargetDb.class.getCanonicalName(),
                                     new FrameworkSQLiteOpenHelperFactory());
  }

  @Test
  public void migrate1To2() throws IOException {
    SupportSQLiteDatabase db = helper.createDatabase(TEST_DB, 1);

    // db has schema version 1. insert some data using SQL queries.
    // You cannot use DAO classes because they expect the latest schema.
    ContentValues values = new ContentValues();
    values.put(<KEY>, <VALUE>);
    db.insert(<TABLE_NAME>, SQLiteDatabase.CONFLICT_REPLACE, values);

    // Prepare for the next version.
    db.close();

    // Re-open the database with version 2 and provide
    // MIGRATION_1_2 as the migration process.
    helper.runMigrationsAndValidate(TEST_DB, 2, true, MIGRATION_1_2);

    // MigrationTestHelper automatically verifies the schema changes,
    // but you need to validate that the data was migrated properly.
    TargetDB targetDb = Room.databaseBuilder(InstrumentationRegistry.getTargetContext(),
                                             TargetDb.class, TEST_DB).build();
  }
}
```

#### More about Test

資料庫使用後要關閉，為了方便，MigrationTestHelper另外提供了`closeWhenFinished()`來讓測試結束時會自動關閉指定的資料庫：

```java
helper.closeWhenFinished(database);
```

### What's more

#### @TypeConverters & @TypeConverter 

在少數情況下，會需要儲存Room無法支援的類別，但在加入前都要進行轉型會產生多餘的程式碼，所以Room提供了兩個annotation，`@TypeConverters`和`@TypeConverter`，來讓使用者可以提供Room相對應的轉換函示。

首先需要先實作轉換用的函示，這裡節錄[官網範例](https://developer.android.com/reference/android/arch/persistence/room/TypeConverter)：

```Java
public class Converters {
    @TypeConverter
    public static Date fromTimestamp(Long value) {
        return value == null ? null : new Date(value);
    }

    @TypeConverter
    public static Long dateToTimestamp(Date date) {
        return date == null ? null : date.getTime();
    }
}
```

如範例，要成為一個轉換用的函式需要有以下幾個條件：

* 要用`@TypeConverter`標記
* 轉換的函示的輸入參數須為想轉換的類別，轉出的類別則為Room可支援的類別。
* 一個轉換的函示，要對應到一個還原的函示。

接著要在DB類別告知Room有哪些額外的TypeConverter可以使用：

```Java
@Database(entities = {User.class}, version = 1)
@TypeConverters({Converters.class})
public abstract class AppDatabase extends RoomDatabase {
    public abstract UserDao userDao();
}
```

如此就完成了TypeConverter的建立與連結。當這DB執行時遇到Date，就會自動使用對應的函示進行轉換：

```Java
// In UserDao_Impl
public UserDao_Impl(RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfUser = new EntityInsertionAdapter<User>(__db) {
        
        @Override
        public void bind(SupportSQLiteStatement stmt, User value) {
            ...
            final Long _tmp_1;
            _tmp_1 = Converters.dateToTimestamp(value.date);
            ...
        }
    }
}
```

### Reference

* [7 Pro-tips for Room](https://medium.com/google-developers/7-pro-tips-for-room-fbadea4bfbd1)