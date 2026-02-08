# Run GitHub CI in Solaris ![Test](https://github.com/vmactions/solaris-vm/workflows/Test/badge.svg)

Powered by [AnyVM.org](https://anyvm.org)

Use this action to run your CI in Solaris.

The github workflow only supports Ubuntu, Windows and MacOS. But what if you need to use Solaris?


All the supported releases are here:



| Release | x86_64  |  Comments |
|---------|---------|-----------|
| 11.4    |  ✅     | Normal CBE |
| 11.4-gcc|  ✅     | CBE with default gcc/g++|
| 11.4-clang-19|  ✅     | CBE with llvm/clang 19 |
| 11.4-gcc-14|  ✅     | CBE with gcc/g++ 14 |

If you need native Sun stuido compiler, you need to download it here:

https://www.oracle.com/tools/developerstudio/downloads/developer-studio-jsp.html









## 1. Example: `test.yml`:

```yml

name: Test

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    name: A job to run test in Solaris
    env:
      MYTOKEN : ${{ secrets.MYTOKEN }}
      MYTOKEN2: "value2"
    steps:
    - uses: actions/checkout@v6
    - name: Test in Solaris
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        prepare: |
          pkgutil -y -i socat

        run: |
          if [ -n "test" ]; then
            echo "false"
          fi
          if [ "test" ]; then
            echo "test"
          fi
          pwd
          ls -lah
          whoami
          env
          psrinfo -vp
          cat /etc/release
          psrinfo -v
          echo "::memstat" | mdb -k
          echo "OK"




```


The latest major version is: `v1`, which is the most recommended to use. (You can also use the latest full version: `v1.3.0`)  


If you are migrating from the previous `v0`, please change the `runs-on: ` to `runs-on: ubuntu-latest`


The `envs: 'MYTOKEN MYTOKEN2'` is the env names that you want to pass into the vm.

The `run: xxxxx`  is the command you want to run in the vm.

The env variables are all copied into the VM, and the source code and directory are all synchronized into the VM.

The working dir for `run` in the VM is the same as in the Host machine.

All the source code tree in the Host machine are mounted into the VM.

All the `GITHUB_*` as well as `CI=true` env variables are passed into the VM.

So, you will have the same directory and same default env variables when you `run` the CI script.





## 2. Share code

The code is shared from the host to the VM via `rsync` by default, you can choose to use `sshfs` or `nfs` or `scp` to share code instead.


```yaml

...

    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        sync: sshfs  # or: nfs
        prepare: |
          pkgutil -y -i socat



...


```

You can also set `sync: no`, so the files will not be synced to the  VM.


When using `rsync` or `scp`,  you can define `copyback: false` to not copy files back from the VM in to the host.


```yaml

...

    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        sync: rsync
        copyback: false
        prepare: |
          pkgutil -y -i socat



...


```





## 3. NAT from host runner to the VM

You can add NAT port between the host and the VM.

```yaml
...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        nat: |
          "8080": "80"
          "8443": "443"
          udp:"8081": "80"
...
```


## 4. Set memory and cpu

The default memory of the VM is 6144MB, you can use `mem` option to set the memory size:

```yaml

...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        mem: 4096
...
```


The VM is using all the cpu cores of the host by default, you can use `cpu` option to change the cpu cores:

```yaml

...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        cpu: 3
...
```


## 5. Select release

It uses [the Solaris 11.4](conf/default.release.conf) by default, you can use `release` option to use another version of Solaris:

```yaml
...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        release: "11.4-gcc"
...
```


## 6. Select architecture

The vm is using x86_64(AMD64) by default, but you can use `arch` option to change the architecture:

```yaml
...
    runs-on: ubuntu-latest
    name: A job to run test in Solaris
    env:
      MYTOKEN : ${{ secrets.MYTOKEN }}
      MYTOKEN2: "value2"
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        release: "11.4-gcc"
        arch: aarch64
...
```

When you run with `aarch64`, the host runner should still be the normal `x86_64` runner: `runs-on: ubuntu-latest`

It's not recommended to use `ubuntu-24.04-arm` as runner, it's much more slower.



## 7. Custom shell

Support custom shell:

```yaml
...
    steps:
    - uses: actions/checkout@v6
    - name: Start VM
      id: vm
      uses: vmactions/solaris-vm@v1
      with:
        sync: nfs
    - name: Custom shell step 1
      shell: solaris {0}
      run: |
        cd $GITHUB_WORKSPACE;
        pwd
        echo "this is step 1, running inside the VM"
    - name: Custom shell step 2
      shell: solaris {0}
      run: |
        cd $GITHUB_WORKSPACE;
        pwd
        echo "this is step 2, running inside the VM"
...
```


## 8. Synchronize VM time

If the time in VM is not correct, You can use `sync-time` option to synchronize the VM time with NTP:

```yaml
...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        sync-time: true
...
```


## 9. Disable cache

By default, the action caches `apt` packages on the host and VM images/artifacts. You can use the `disableCache` option to disable this:

```yml
...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        disable-cache: true
...
```


## 10. Debug on error

If you want to debug the VM when the `prepare` or `run` step fails, you can set `debug-on-error: true`.

When a failure occurs, the action will enable a remote VNC link and wait for your interaction. You can then access the VM via VNC to debug. To continue or finish the action, you can run `touch ~/continue` inside the VM.

```yaml
...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        debug-on-error: true

...
```

You can also set the `vnc-password` parameter to set a custom password to protect the VNC link:

```yaml
...
    steps:
    - uses: actions/checkout@v6
    - name: Test
      id: test
      uses: vmactions/solaris-vm@v1
      with:
        debug-on-error: true
        vnc-password: ${{ secrets.VNC_PASSWORD }}

...
```

You will be asked to input the username and password when you access the VNC link. The username can be any string, the password is the value of the `vnc-password` parameter.


See more: [debug on error](https://github.com/vmactions/.github/wiki/debug%E2%80%90on%E2%80%90error)



# Under the hood

We use Qemu to run the Solaris VM.




# Upcoming features:

1. Support other architectures, eg: sparc64 or powerpc64.














