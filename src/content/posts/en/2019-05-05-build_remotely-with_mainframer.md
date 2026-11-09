---
title: "Build remote with Mainframer"
date: "2019-05-05"
---
I have **one laptop** for daily work and **one desktop** which is more powerful but not possible to travel with me.

Because the project was getting more bigger and complex. I started to feel no matter how hard I tried, it still took minutes to finish. Even I just removed one line.

And that’s when I found the **Mainframer**.

> [**Mainframer**](https://github.com/buildfoundation/mainframer) is a tool for you to push the project to the remote, build there and sync the result back.

Thanks to the contributors, they really save my day.

Here are my settings:

-   **Remote**: Ubuntu Desktop 18.04 LTS.
-   **Local**: MacOS 10.12.6.
-   **Mainframer**: v2.1.0.

I choose desktop version just because I may need to something else which will be more easier with GUI.

To simplify the steps, some trivial steps are ignored intentionally. If you face any problem during the journey, I believe google should be enough to find the solution.

## Remote

### Ubuntu

-   **[Download Ubuntu image](https://www.ubuntu.com/#download) and Install** Ubuntu on a real/virtual machine.

### JAVA

-   **Install Java Open JDK 1.8**

```bash
$ sudo apt install openjdk-8-jdk
```

### SSH server

-   **Install SSH server**

```bash
$ sudo apt-get install openssh-server
```

The server should be started automatically. And now you can try to connect the server locally through `$ ssh user@server-name` with the password.

### Android Studio

-   [**Download and Install Android Studio**](https://developer.android.com/studio/install#linuxhttps://developer.android.com/studio/install#linux)
-   **Setting environment value `ANDROID_HOME`.**

```bash
// Using sed -i '1i{TEXT}' {FILE_NAME} can put text to the head of the target file.
$ sed -i '1iexport ANDROID_HOME={REMOTE_ANDROID_SDK_ROOT}' ~/.bashrc
```

Make sure you can build a sample project through commands without `local.properties` successfully, which you may not push to the remote.

## Local

### **Generate SSH key.**

```bash
$ ssh-keygen -t rsa -b 4096 -C "{REMOTE_MACHINE_USERNAME}"
// Change .pub permission, or get "UNPROTECTED PRIVATE KEY FILE!" error.
$ chmod 600 {REMOTE_MACHINE_USERNAME}.pub
```

### SSH config

-   **Append the following content to `~/.ssh/config`.**

```bash
Host {REMOTE_MACHINE_ALIAS}
      User {REMOTE_MACHINE_USERNAME}
      HostName {REMOTE_MACHINE_IP_OR_HOSTNAME}
      Port 22
      IdentityFile ~/.ssh/{SSH_PRIVATE_KEY_NAME}
      PreferredAuthentications publickey
      ControlMaster auto
      ControlPath /tmp/%r@%h:%p
      ControlPersist 1h
```

### Push public key

-   **Copy and push the public key to the remote through scp**.

```
$ scp <filename>.pub <username>@<host address>
// Loging the device with username/password, and find the .pub file
$ cat <filename.pub> > ~/.ssh/authorized_keys
// Change permission for read/write
$ chmod u+rw,go= .ssh/authorized_keys
```

**Note:** You can also use the [`remote_machine_setup.sh`](https://github.com/buildfoundation/mainframer/blob/v2.1.0/recipes/SETUP_REMOTE_MACHINE.md) to easy publish more keys with users.

### Make Android project ready

-   **Create a folder `./mainframer`** under the project root.
-   **Create a file `./mainframer/config`** with the following content.

```bash
remote_machine={REMOTE_MACHINE_ALIAS}
```

-   **Copy the all the ignore files** from the [sample project](https://github.com/buildfoundation/mainframer/tree/v2.1.0/samples/gradle-android) on the GitHub.
-   [**Download latest release version of mainframer.sh**](https://github.com/buildfoundation/mainframer/releases/tag/v2.1.0) and save it under the project’s root.

For more detail, check the [official document](https://github.com/buildfoundation/mainframer/blob/v2.1.0/docs/CONFIGURATION.mdhttps://github.com/buildfoundation/mainframer/blob/v2.1.0/docs/CONFIGURATION.md).

### Dry run

```bash
bash mainframer.sh echo "It works"
```

If settings are correct, the project will be synced under `~/mainframer/` on the remote, and the build log may contain information about the syncing process.

## What’s more

### mainframer-intellij-plugin

Once you’ve done the settings on both remote and local, you can use **[mainframer-intellij-plugin](https://github.com/elpassion/mainframer-intellij-plugin)** and skip the configuration part. The plugin will do the rest.

### Using Docker

If you are familiar with Docker, you can also check the [post](https://medium.com/@balachandarkm/speed-up-android-builds-with-mainframer-docker-container-in-a-powerful-remote-machine-ce7b9e122a49).

## Troubleshoot

### Network settings on the virtual machine

If you are using the virtual machine to set up the remote, you may need to set the network setting manually.

-   **Find the name of the netcard**

The name may diff. In this post, we will use “**enp0s3**“ as an example.

```bash
$ ip -c a
```

-   **Give the specific IP**

The virtual machine will be given an IP address. Start from Ubuntu 17.10, we need to use NetPlan to change the network setting. For more detail, please check the [office document](https://websiteforstudents.com/configure-static-ip-addresses-on-ubuntu-18-04-beta/).

```bash
// Create one if need.
$ sudo vi /etc/netplan/50-cloud-init.yaml

// In edit mode, input settings with the following format.
---
network:
    ethernets:
        enp0s3:
            addresses: [192.168.1.10/24]
            gateway4: 192.168.1.1
            nameservers:
              addresses: [8.8.8.8,8.8.4.4]
            dhcp4: no
    version: 2
---

// Do dry try
$ sudo netplan try
// If success will have the follow message, just hit ENTER to apply automatically.
Do you want to keep these settings?
...
 
// Apply manually
$ sudo netplan apply
```

### Passphrase for key

After set up the SSH server and deploy the local machine’s public key. You may encounter the request when you want to ssh the remote:

```bash
Enter passphrase for key '/home/{username}/.ssh/id_rsa':
```

If you really never ever set any passphrase for the SSH key, you can use:

```bash
$ ssh-add -K
```

### SDK location not found

If you use the ignore files inside the [sample project on the GitHub](https://github.com/buildfoundation/mainframer/tree/v2.1.0/samples/gradle-android). You may receive the following error message:

```bash
SDK location not found. Define location with sdk.dir in the local.properties file or with an ANDROID_HOME environment variable.
```

This may simply because you put the commands for setting the environment value at the end of `.bashrc`. And get ignore because:

```bash
# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac
```

## Reference

-   [https://github.com/buildfoundation/mainframer](https://github.com/buildfoundation/mainframer)
-   [https://github.com/elpassion/mainframer-intellij-plugin](https://github.com/elpassion/mainframer-intellij-plugin)
