---
title: "Linux"
updated: "2019-05-10"
---
### General

#### 查使用者帳號

```bash
whoami
```

### find

#### 在目錄下找檔名符合規則, 且內容包含特定字串的檔案

```
find <目錄> -name “<規則>" -type f -exec grep -l “<字串>" {} +
```

##### 批次更換<字串1>成<字串2>

```
find <目錄> -name “<規則>" -type f -exec grep -l “<字串1>" {} + | xargs sed -i "" ’s/<字串1>/<字串2>/g’
```

### Others

#### 查詢linux版本

```
uname -a
```

#### 查詢os版本
```
lsb_release -a
```

#### 修改使用者密碼

```
passwd <username> <password>
```

#### 切換使用者

```
su <username>
```

