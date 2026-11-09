---
title: "Git"
updated: "2019-05-29"
---
## Set up

### Install

```
sudo yum install git-all
sudo apt-get install git-all
```

### Repository

#### 建立server上的bare repository

```
git init --bare <name>.git
```

### Config

```
git config --(global|system|local) <options>
```

#### Global

* Windows

```
C:\Users\name\.gitconfig
```

* Linux

```
~/.gitconfig
```

#### System

* Windows

```
C:\Program Files\Git\mingw64\etc
```
> 如果有安裝類linux輔助，則會其目錄下的/etc內

* Linux

```
/etc/.gitconfig
```

#### Local

位在repository當前.git/config

#### Options

| 項目 | option |
| --- | ---|
| 使用者名稱 | user.name |
| 信箱 | user.email |

#### RSA key

1. 跟著Github官方的[教學文件](https://help.github.com/en/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)。

##### Trouble shoot

###### [host key verification failed](https://stackoverflow.com/questions/33275382/sublime-git-pushing-host-key-verification-failed)

通常是`known_hosts`的問題，執行以下動作來覆蓋內容修正：

```bash
ssh-keyscan -t rsa github.com > ~/.ssh/known_hosts
```

## Commands

### Checkout

#### 根據tag建立branch

```bash
git checkout -b <branch> <tag>
```

### Bisect

主要用於檢查是哪個commit開始造成程式錯誤。

1. 指定壞掉的點

```bash
git bisect start HEAD <SHA1/Tag>
```

指定好後，會直接二元方式切換到另一個commit。

2. 指定當前commit是好或壞

```bash
git bisect bad/good
```

3. 返回bisect前狀態

```bash
git bisect reset
```

### Clone

#### 下載一個repository

```bash
git clone <repository url>
```

> 如果是.git結尾的url則必須要給定server端的絕對路徑

#### 下載特定目錄

##### 新Repository

1. 建立資料夾

```bash
mkdir <folder name>
```

2.  進入資料夾

```bash
cd <folder name>
```

3.  初始化git

```bash
git init
```

4.  加入remote

```bash
git remote add –f <remote name> <url>
```

5.  開啟sparse checkout功能

```bash
git config core.sparsecheckout true</code>
```

6.  設定想要抓取的目錄

```bash
echo <path of folder> >> .git/info/sparse-checkout</code>
```

7.  執行pull抓取

```bash
git pull <remote name> master</code>
```

#### 現有Repository 

1.  開啟sparse checkout功能

```bash
git config core.sparsecheckout true
```

2. 在`info`內加入想要抓取的目錄

```bash
echo <path of folder> >> .git/info/sparse-checkout
```

3. 執行read-tree更新git並抓取

```bash
git read-tree -mu HEAD
```

##### 過濾不必要的檔案或目錄

* 目錄

```bash
!<folder path>
```

* 檔案

```bash
!*<file name or type> 
```

> [參考](https://www.kernel.org/pub/software/scm/git/docs/git-read-tree.html)

### Fetch

#### 單取一個PR

```bash
git fetch {remote} pull/{ID}/head:{from BRANCHNAME}
```

### Log

#### 從訊息找對應字串的commit

```bash
git log --grep="<string>"
```

#### 從內容找有對應字串的commit

```bash
git log -S "<string>"
```

### Merge

#### 不自動產生commit 

```bash
git merge <branch name> --no-commit
```

### Push

#### 強制更新

```bash
git push -f <remote branch> <local branch>
```

#### 強制返回remote至某一commit

```bash
git reset --hard <commit>
git push -f <remote branch> <local branch>
```

### Stash

#### 自訂訊息

```bash
git stash save <message>
```

#### 查看所有stash

```bash
git stash list
```

#### 取用特定的stash

```bash
git stash apply stash@{<index>}
```

> 需要搭配`git stash list`。

### Worktree

主要用於多個feature同時進行，但想簡化工作流程而不用互相干擾時。

1. 開啟新的worktree

```bash
git worktree add -b <branch> ../hotfix <upstream>
```

執行後會以目前狀態建立新的資料夾`../hotfix`，建立並切換branch至`<branch>`，遠端是追蹤`<upstream>`。

2. 查看worktree列表

```bash
git worktree list
```

3. 刪除worktree

```bash
直接rm -rf刪除目錄, 或
git worktree prune 清除記錄
```

### Submodule

1. 加入submodule

```bash
git submodule add <repository> <path>
```

目錄底下會出現.gitmodules

2. 打開.gitmodules 確認 path 及 repository

```bash
// In .gitmodules
[submodule "user_guide"]
path = your/path
url = xxx/xxx/xxx/repository.git
```

3. 設定結束，Push

## Useful

### 顯示執行過程

```bash
<git command> --progress
```

### Clone有submodule的repository

1. clone後執行init，讓git知道有submodule

```bash
git submodule init
```

2. 取得submodule

```bash
git submodule update
```

### 查看所有被track的檔案

```bash
git ls-tree -r master --name-only
```

#### 刪除track的檔案

```bash
git rm -r --cached <file>
```

